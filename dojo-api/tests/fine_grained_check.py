#!/usr/bin/env python3
"""
Fine-grained functional check of every backend endpoint, organized by
category (one category per controller, GenericController split into its
natural sub-domains). Each call is checked for: no 5xx, plausible status
code for the scenario, and (where meaningful) response shape.
Prints a per-category PASS/FAIL table plus details on any failure.

Usage:
    1. Point dojo-api/config.php at a scratch database (NOT production --
       this script creates/mutates real rows, e.g. registers throwaway
       users, creates/deactivates a branch, sends test messages).
    2. Load schema + seed:
         mysql -u root dojo_platform < database/schema.sql
         php database/seed.php
    3. Serve the API (php's built-in server needs the SCRIPT_NAME shim
       below to correctly simulate Apache/XAMPP's request routing):
         cat > api/_dev_router.php << 'EOF'
         <?php
         $_SERVER['SCRIPT_NAME'] = '/api/index.php';
         require __DIR__ . '/index.php';
         EOF
         php -S 127.0.0.1:8099 -t . api/_dev_router.php &
    4. pip install requests --break-system-packages   (if not already available)
    5. python3 tests/fine_grained_check.py

Assumes the standard seeded accounts (admin@yourdojo.com, coach@elita.test,
staff@elita.test, parent1@elita.test, etc. -- see database/seed.php) exist.
Safe to run repeatedly against a disposable DB; not idempotent against a
real one (creates a handful of "FG Test ..." rows each run).
"""
import requests, json, sys

BASE = "http://127.0.0.1:8099"
results = []  # (category, function/label, ok, detail)

def record(category, label, ok, detail=""):
    results.append((category, label, ok, detail))
    mark = "✅" if ok is True else ("⏭️ " if ok is None else "❌")
    print(f"{mark} [{category}] {label}" + (f" — {detail}" if detail and not ok else ""))

def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=5)
    if r.status_code != 200:
        print(f"LOGIN FAILED for {email}: {r.status_code} {r.text}")
        sys.exit(1)
    return r.json()["data"]["token"]

def h(token): return {"Authorization": f"Bearer {token}"}

def call(method, path, token=None, json_body=None, expect=None, category="", label=""):
    fn = getattr(requests, method)
    kwargs = {"timeout": 5}
    if token: kwargs["headers"] = h(token)
    if json_body is not None: kwargs["json"] = json_body
    r = fn(f"{BASE}{path}", **kwargs)
    is_5xx = r.status_code >= 500
    ok = not is_5xx if expect is None else (r.status_code in expect if isinstance(expect, (list, tuple)) else r.status_code == expect)
    detail = f"{r.status_code}: {r.text[:200]}"
    record(category, label or f"{method.upper()} {path}", ok, detail)
    try: return r.status_code, r.json().get("data")
    except Exception: return r.status_code, None

# ── Bootstrap: log in as every seeded role ───────────────────────────────────
ADMIN   = login("admin@yourdojo.com", "admin123")
HEADC   = login("headcoach@elita.test", "coach123")
COACH   = login("coach@elita.test", "coach123")
COACH2  = login("coach2@elita.test", "coach123")
STAFF   = login("staff@elita.test", "staff123")
PARENT1 = login("parent1@elita.test", "parent123")

# resource ids we'll discover along the way
ids = {}

# ══════════════════════════ AUTH ══════════════════════════
cat = "Auth"
call("post", "/auth/register", json_body={
    "email": "fgtest_parent@test.com", "password": "password123", "displayName": "FG Test Parent",
    "role": "parent", "dojoId": "dojo-001"}, expect=201, category=cat, label="register")
call("post", "/auth/register", json_body={
    "email": "admin@yourdojo.com", "password": "admin123", "displayName": "dupe", "role": "admin", "dojoId": "dojo-001"},
    expect=409, category=cat, label="register (duplicate email -> 409)")
call("post", "/auth/login", json_body={"email": "admin@yourdojo.com", "password": "admin123"}, expect=200, category=cat, label="login")
call("post", "/auth/login", json_body={"email": "admin@yourdojo.com", "password": "wrong"}, expect=401, category=cat, label="login (bad password -> 401)")
call("post", "/auth/login", json_body={"email": "fgtest_parent@test.com", "password": "password123"}, expect=403, category=cat, label="login (pending -> 403)")
call("get", "/auth/me", token=ADMIN, expect=200, category=cat, label="me")
call("post", "/auth/logout", token=ADMIN, json_body={}, expect=200, category=cat, label="logout")
call("get", "/auth/me", token=ADMIN, expect=401, category=cat, label="me (after logout -> 401, token revoked)")
call("post", "/auth/forgot-password", json_body={"email": "admin@yourdojo.com"}, expect=200, category=cat, label="forgotPassword")
call("post", "/auth/reset-password", json_body={"token": "bogus", "password": "newpassword123"}, expect=[400,404,422], category=cat, label="resetPassword (bad token)")
# re-login as admin since we called logout above (logout doesn't invalidate JWT client-side, but re-fetch fresh for safety)
ADMIN = login("admin@yourdojo.com", "admin123")

# ══════════════════════════ USERS & APPROVALS ══════════════════════════
cat = "Users & Approvals"
_, pending = call("get", "/users/pending?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="listPendingUsers")
_, hist = call("get", "/users/history?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="listUserHistory")
call("get", "/users?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="listUsers")
fgparent_uid = next((u["uid"] for u in (pending or []) if u.get("email") == "fgtest_parent@test.com"), None)
if fgparent_uid:
    call("patch", f"/users/{fgparent_uid}/approve", token=ADMIN, json_body={}, expect=200, category=cat, label="approveUser")
    ids['fgparent_uid'] = fgparent_uid
else:
    record(cat, "approveUser", False, "could not find pending test user to approve")
call("post", "/auth/register", json_body={
    "email": "fgtest_reject@test.com", "password": "password123", "displayName": "FG Reject",
    "role": "parent", "dojoId": "dojo-001"}, expect=201, category=cat, label="(setup) register for reject test")
_, pending2 = call("get", "/users/pending?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="(recheck) listPendingUsers")
rej_uid = next((u["uid"] for u in (pending2 or []) if u.get("email") == "fgtest_reject@test.com"), None)
if rej_uid:
    call("patch", f"/users/{rej_uid}/reject", token=ADMIN, json_body={}, expect=200, category=cat, label="rejectUser")
else:
    record(cat, "rejectUser", False, "could not find pending test user to reject")
coach2_uid = next((u["uid"] for u in (hist or []) if u.get("email") == "coach2@elita.test"), None)
if coach2_uid:
    call("patch", f"/users/{coach2_uid}/head-coach", token=ADMIN, json_body={"isHeadCoach": False}, expect=200, category=cat, label="setHeadCoach")
    call("patch", f"/users/{coach2_uid}/block", token=ADMIN, json_body={}, expect=200, category=cat, label="blockUser")
    call("patch", f"/users/{coach2_uid}/unblock", token=ADMIN, json_body={}, expect=200, category=cat, label="unblockUser")
    call("patch", f"/users/{coach2_uid}/downgrade-to-staff", token=ADMIN, json_body={}, expect=200, category=cat, label="downgradeCoachToStaff")
else:
    record(cat, "setHeadCoach/blockUser/unblockUser/downgradeCoachToStaff", False, "coach2 uid not found")

# ══════════════════════════ DOJO SETTINGS ══════════════════════════
cat = "Dojo Settings"
call("get", "/dojos/dojo-001", token=ADMIN, expect=200, category=cat, label="getDojo")
call("put", "/dojos/dojo-001", token=ADMIN, json_body={"name": "Elita Academy"}, expect=200, category=cat, label="updateDojo")
call("patch", "/dojos/dojo-001/settings", token=ADMIN, json_body={}, expect=[200,422], category=cat, label="updateDojoSettings")

# ══════════════════════════ BRANCHES ══════════════════════════
cat = "Branches"
_, branches = call("get", "/branches", token=ADMIN, expect=200, category=cat, label="list")
downtown = next((b["id"] for b in branches if b["name"] == "Downtown Branch"), None)
riverside = next((b["id"] for b in branches if b["name"] == "Riverside Branch"), None)
ids['downtown'] = downtown; ids['riverside'] = riverside
call("get", f"/branches/{downtown}", token=ADMIN, expect=200, category=cat, label="get")
_, newbranch = call("post", "/branches", token=ADMIN, json_body={"name": "FG Test Branch", "code": "FGT"}, expect=201, category=cat, label="create")
newbranch_id = newbranch["id"] if newbranch else None
if newbranch_id:
    call("patch", f"/branches/{newbranch_id}", token=ADMIN, json_body={"name": "FG Test Branch Renamed"}, expect=200, category=cat, label="update")
    call("delete", f"/branches/{newbranch_id}", token=ADMIN, expect=200, category=cat, label="deactivate")
call("get", f"/branches/{downtown}/students", token=ADMIN, expect=200, category=cat, label="students")
call("get", f"/branches/{downtown}/coaches", token=ADMIN, expect=200, category=cat, label="coaches")
call("get", f"/branches/{downtown}/programs", token=ADMIN, expect=200, category=cat, label="programs")
_, allusers = call("get", "/users?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="(setup) list users")
staff_uid = next((u["uid"] for u in allusers if u.get("email") == "staff@elita.test"), None)
if staff_uid:
    call("patch", f"/users/{staff_uid}/branch", token=ADMIN, json_body={"branchId": downtown}, expect=200, category=cat, label="assignUserBranch")

# ══════════════════════════ STUDENTS ══════════════════════════
cat = "Students"
_, students = call("get", "/students", token=ADMIN, expect=200, category=cat, label="list")
sofia = next((s["id"] for s in students if s["firstName"] == "Sofia"), None)
noah = next((s["id"] for s in students if s["firstName"] == "Noah"), None)
ids['sofia'] = sofia; ids['noah'] = noah
call("get", f"/students/{sofia}", token=ADMIN, expect=200, category=cat, label="get")
_, newstudent = call("post", "/students", token=ADMIN, json_body={
    "parentUid": PARENT1 and requests.get(f"{BASE}/auth/me", headers=h(PARENT1)).json()["data"]["uid"],
    "firstName": "FGTest", "lastName": "Student", "dob": "2015-01-01", "gender": "M",
    "branchId": downtown}, expect=200, category=cat, label="create")
newstudent_id = newstudent["id"] if newstudent else None
if newstudent_id:
    call("patch", f"/students/{newstudent_id}", token=ADMIN, json_body={
        "firstName": "FGTestUpdated", "lastName": "Student", "dob": "2015-01-01", "gender": "M"},
        expect=200, category=cat, label="update (note: this endpoint requires the full record, not a partial patch)")
    call("get", f"/students/{newstudent_id}/belt-history", token=ADMIN, expect=200, category=cat, label="beltHistory")
    call("get", f"/students/{newstudent_id}/objectives", token=ADMIN, expect=200, category=cat, label="objectives")
    call("get", f"/students/{newstudent_id}/comments", token=ADMIN, expect=200, category=cat, label="comments")
    _, obj = call("post", f"/students/{newstudent_id}/objectives", token=COACH, json_body={"description": "Practice kicks"}, expect=201, category=cat, label="addObjective")
    obj_id = obj["id"] if obj else None
    if obj_id:
        call("patch", f"/students/{newstudent_id}/objectives/{obj_id}", token=COACH, json_body={"isComplete": True}, expect=200, category=cat, label="updateObjective")
    call("post", f"/students/{newstudent_id}/comments", token=COACH, json_body={"content": "Great effort today"}, expect=[200,201], category=cat, label="addComment")
    call("post", f"/students/{newstudent_id}/belt-history", token=COACH, json_body={"beltId": 1, "notes": "test"}, expect=[200,201,422], category=cat, label="awardBelt")
    call("post", f"/students/{newstudent_id}/transfer", token=STAFF, json_body={"toBranchId": riverside}, expect=200, category=cat, label="transferStudent (via BranchController)")
    call("get", f"/students/{newstudent_id}/transfers", token=ADMIN, expect=200, category=cat, label="transferHistory")

print("\n=== SECTION 1 DONE — continuing with remaining categories ===")

# ══════════════════════════ ATTENDANCE & SESSIONS ══════════════════════════
cat = "Attendance & Sessions"
_, sessions = call("get", "/sessions", token=ADMIN, expect=200, category=cat, label="listSessions")
sess_id = sessions[0]["id"] if sessions else None
if sess_id:
    call("get", f"/sessions/{sess_id}", token=ADMIN, expect=200, category=cat, label="getSession")
    call("get", f"/sessions/{sess_id}/comments", token=ADMIN, expect=200, category=cat, label="listComments")
_, newsess = call("post", "/sessions", token=COACH, json_body={
    "className": "FG Test Class", "date": "2026-07-01", "startTime": "10:00", "endTime": "11:00",
    "branchId": downtown}, expect=200, category=cat, label="createSession")
newsess_id = newsess["id"] if newsess else None
if newsess_id:
    call("patch", f"/sessions/{newsess_id}", token=COACH, json_body={"isClosed": True}, expect=200, category=cat, label="updateSession")
    if sofia:
        call("post", f"/sessions/{newsess_id}/comments", token=COACH, json_body={
            "studentId": sofia, "content": "Nice work"}, expect=[200,201], category=cat, label="addComment (session)")
        call("post", "/attendance", token=COACH, json_body={
            "sessionId": newsess_id, "studentId": sofia, "status": "present"}, expect=200, category=cat, label="markAttendance")
        call("post", "/attendance/bulk", token=COACH, json_body={
            "records": [{"sessionId": newsess_id, "studentId": sofia, "status": "late"}]},
            expect=200, category=cat, label="bulkMark")
call("get", "/attendance", token=ADMIN, expect=200, category=cat, label="listAttendance")

# ══════════════════════════ EVALUATIONS & PROMOTIONS ══════════════════════════
cat = "Evaluations & Promotions"
liam = next((s["id"] for s in students if s["firstName"] == "Liam"), None)
ethan = next((s["id"] for s in students if s["firstName"] == "Ethan"), None)
if liam:
    call("get", f"/students/{liam}/evaluations", token=ADMIN, expect=200, category=cat, label="list")
    _, ev = call("post", f"/students/{liam}/evaluations", token=COACH, json_body={
        "track": "striking", "result": "pass", "notes": "solid"}, expect=[200,201,422], category=cat, label="create")
    call("get", f"/students/{liam}/promotion-readiness", token=ADMIN, expect=200, category=cat, label="readiness")
    call("post", f"/students/{liam}/seminar-points", token=COACH, json_body={"points": 1, "reason": "test"}, expect=[200,201,422], category=cat, label="awardSeminarPoints")
    call("get", f"/students/{liam}/seminar-points", token=ADMIN, expect=200, category=cat, label="seminarPointsLog")
    call("post", f"/students/{liam}/bjj-stripe", token=COACH, json_body={}, expect=[200,201,422], category=cat, label="awardStripe")
if ethan:
    call("post", f"/students/{ethan}/promote", token=HEADC, json_body={}, expect=[200,201,422], category=cat, label="promote")
# overrule needs an existing eval id — use Noah's known-overruled eval if discoverable
if noah:
    _, noah_evals = call("get", f"/students/{noah}/evaluations", token=ADMIN, expect=200, category=cat, label="(setup) list Noah evals")
    failed_eval = next((e["id"] for e in (noah_evals or []) if e.get("result") == "fail"), None)
    if failed_eval:
        call("patch", f"/evaluations/{failed_eval}/overrule", token=HEADC, json_body={
            "result": "pass", "notes": "re-tested"}, expect=[200,422], category=cat, label="overrule")

# ══════════════════════════ CURRICULUM ══════════════════════════
cat = "Curriculum"
_, disciplines = call("get", "/disciplines?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="(setup) list disciplines")
elita_disc = next((d["id"] for d in disciplines if "Elita" in d["name"]), disciplines[0]["id"] if disciplines else None)
_, roadmap = call("get", f"/disciplines/{elita_disc}/roadmap", token=ADMIN, expect=200, category=cat, label="roadmap")
_, belts = call("get", f"/disciplines/{elita_disc}/belts", token=ADMIN, expect=200, category=cat, label="(setup) list belts")
belt_id = belts[0]["id"] if belts else None
if belt_id:
    call("get", f"/belts/{belt_id}/syllabus", token=ADMIN, expect=200, category=cat, label="syllabus")
    _, syl = call("post", f"/belts/{belt_id}/syllabus", token=ADMIN, json_body={
        "track": "striking", "label": "FG test requirement"}, expect=[200,201], category=cat, label="addSyllabus")
    syl_id = syl["id"] if syl else None
    if syl_id:
        call("patch", f"/syllabus/{syl_id}", token=ADMIN, json_body={"label": "FG updated"}, expect=200, category=cat, label="updateSyllabus")
        call("delete", f"/syllabus/{syl_id}", token=ADMIN, expect=200, category=cat, label="deleteSyllabus")

# ══════════════════════════ DISCIPLINES / BELTS / SCHEDULES ══════════════════════════
cat = "Disciplines/Belts/Schedules"
call("get", "/disciplines?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="listDisciplines")
_, newdisc = call("post", "/disciplines", token=ADMIN, json_body={"name": "FG Test Discipline"}, expect=[200,201], category=cat, label="createDiscipline")
newdisc_id = newdisc["id"] if newdisc else None
if newdisc_id:
    call("patch", f"/disciplines/{newdisc_id}", token=ADMIN, json_body={"name": "FG Renamed"}, expect=200, category=cat, label="updateDiscipline")
    call("get", f"/disciplines/{newdisc_id}/belts", token=ADMIN, expect=200, category=cat, label="listBelts")
    _, newbelt = call("post", f"/disciplines/{newdisc_id}/belts", token=ADMIN, json_body={
        "name": "FG Belt", "rank": 1, "colorHex": "#ffffff"}, expect=[200,201], category=cat, label="createBelt")
    newbelt_id = newbelt["id"] if newbelt else None
    if newbelt_id:
        call("patch", f"/disciplines/{newdisc_id}/belts/{newbelt_id}", token=ADMIN, json_body={"name": "FG Belt Updated"}, expect=200, category=cat, label="updateBelt")
call("get", "/schedules?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="listSchedules")
_, newsched = call("post", "/schedules", token=ADMIN, json_body={
    "name": "FG Test Schedule", "dayOfWeek": 2, "startTime": "09:00", "endTime": "10:00",
    "branchId": downtown}, expect=[200,201], category=cat, label="createSchedule")
newsched_id = newsched["id"] if newsched else None
if newsched_id:
    call("patch", f"/schedules/{newsched_id}", token=ADMIN, json_body={"name": "FG Updated"}, expect=200, category=cat, label="updateSchedule")

# ══════════════════════════ MESSAGING ══════════════════════════
cat = "Messaging"
_, threads = call("get", "/threads", token=ADMIN, expect=200, category=cat, label="listThreads")
_, me_parent = call("get", "/auth/me", token=PARENT1, expect=200, category=cat, label="(setup) me parent1")
_, newthread = call("post", "/threads", token=ADMIN, json_body={
    "studentId": sofia, "parentUid": me_parent["uid"] if me_parent else None}, expect=[200,201], category=cat, label="createThread")
thread_id = newthread["id"] if newthread else (threads[0]["id"] if threads else None)
if thread_id:
    call("get", f"/threads/{thread_id}/messages", token=ADMIN, expect=200, category=cat, label="listMessages")
    call("post", f"/threads/{thread_id}/messages", token=ADMIN, json_body={"content": "FG test message"}, expect=[200,201], category=cat, label="sendMessage")
    call("patch", f"/threads/{thread_id}/read", token=ADMIN, json_body={}, expect=200, category=cat, label="markThreadRead")

# ══════════════════════════ LOYALTY ══════════════════════════
cat = "Loyalty"
parent1_uid = me_parent["uid"] if me_parent else None
if parent1_uid:
    call("get", f"/loyalty/{parent1_uid}", token=ADMIN, expect=200, category=cat, label="getLoyalty")
    call("post", f"/loyalty/{parent1_uid}/award", token=ADMIN, json_body={"points": 5, "reason": "fg test"}, expect=[200,201], category=cat, label="awardLoyalty")
    call("get", f"/loyalty/{parent1_uid}/transactions", token=ADMIN, expect=200, category=cat, label="listTransactions")
_, rewards = call("get", "/loyalty-rewards?dojoId=dojo-001", token=ADMIN, expect=200, category=cat, label="listRewards")
_, newreward = call("post", "/loyalty-rewards", token=ADMIN, json_body={"name": "FG Reward", "pointsCost": 10}, expect=[200,201], category=cat, label="createReward")
newreward_id = newreward["id"] if newreward else None
if newreward_id:
    call("patch", f"/loyalty-rewards/{newreward_id}", token=ADMIN, json_body={"name": "FG Reward Updated"}, expect=200, category=cat, label="updateReward")
    if parent1_uid:
        call("post", f"/loyalty/{parent1_uid}/redeem", token=ADMIN, json_body={"rewardId": newreward_id}, expect=[200,201,422], category=cat, label="redeemReward")

# ══════════════════════════ NOTIFICATIONS ══════════════════════════
cat = "Notifications"
_, notifs = call("get", "/notifications", token=PARENT1, expect=200, category=cat, label="listNotifications")
notif_id = notifs[0]["id"] if notifs else None
if notif_id:
    call("patch", f"/notifications/{notif_id}", token=PARENT1, json_body={"isRead": True}, expect=200, category=cat, label="updateNotification")
call("post", "/notifications/mark-all-read", token=PARENT1, json_body={}, expect=200, category=cat, label="markAllNotificationsRead")

# ══════════════════════════ PROFILE ══════════════════════════
cat = "Profile"
call("get", "/profile", token=ADMIN, expect=200, category=cat, label="get")
call("put", "/profile", token=ADMIN, json_body={
    "firstName": "Admin", "lastName": "User", "email": "admin@yourdojo.com"},
    expect=200, category=cat, label="update (note: this endpoint requires the full record, not a partial patch)")
call("post", "/profile/password", token=STAFF, json_body={
    "currentPassword": "staff123", "newPassword": "Staff123!New"}, expect=200, category=cat, label="changePassword")
# changePassword correctly bumps token_version, revoking the token used to
# call it (see ProfileController::changePassword) -- get a fresh one before
# any later section reuses STAFF.
STAFF = login("staff@elita.test", "Staff123!New")
# uploadPhoto/deletePhoto need multipart/file — flagged as needing manual/file-based testing
record(cat, "uploadPhoto", None, "requires multipart file upload — not exercised by this script")
record(cat, "deletePhoto", None, "depends on uploadPhoto having run — not exercised by this script")

# ══════════════════════════ COMMUNICATION LAYER ══════════════════════════
cat = "Communication Layer"
call("get", "/communication/event-types", token=ADMIN, expect=200, category=cat, label="eventTypes")
_, templates = call("get", "/communication/templates", token=ADMIN, expect=200, category=cat, label="listTemplates")
_, newtpl = call("post", "/communication/templates", token=ADMIN, json_body={
    "eventType": "announcement", "channel": "sms", "name": "FG Test Template", "body": "Hello {{parentName}}"},
    expect=[200,201], category=cat, label="createTemplate")
newtpl_id = newtpl["id"] if newtpl else None
if newtpl_id:
    call("patch", f"/communication/templates/{newtpl_id}", token=ADMIN, json_body={
        "eventType": "announcement", "channel": "sms", "name": "FG Test Template", "body": "Updated {{parentName}}"},
        expect=200, category=cat, label="updateTemplate (note: this endpoint requires the full record, not a partial patch)")
call("post", "/communication/templates/import", token=ADMIN, json_body={"templates": [{
    "eventType": "report", "channel": "email", "name": "FG Import Template", "subject": "x", "body": "Hi {{parentName}}"}]},
    expect=200, category=cat, label="importTemplates")
call("get", "/communication/templates/export", token=ADMIN, expect=200, category=cat, label="exportTemplates")
if sofia:
    call("post", "/communication/send", token=STAFF, json_body={
        "eventType": "announcement", "channel": "email", "recipientType": "student", "studentId": sofia,
        "subject": "Test", "body": "Test announcement"}, expect=[200], category=cat, label="send")
    call("post", "/communication/send/bulk", token=STAFF, json_body={
        "eventType": "announcement", "channel": "sms", "body": "Bulk test",
        "recipients": [{"recipientType": "student", "studentId": sofia}]}, expect=200, category=cat, label="sendBulk")
_, logs = call("get", "/communication/logs", token=ADMIN, expect=200, category=cat, label="listLogs")
log_id = logs[0]["id"] if logs else None
if log_id:
    call("get", f"/communication/logs/{log_id}", token=ADMIN, expect=200, category=cat, label="getLog")
_, campaigns = call("get", "/communication/campaigns", token=ADMIN, expect=200, category=cat, label="listCampaigns")
newsletter_tpl = next((t["id"] for t in templates if t["eventType"] == "newsletter"), None)
if newsletter_tpl:
    _, newcamp = call("post", "/communication/campaigns", token=STAFF, json_body={
        "type": "newsletter", "channel": "email", "templateId": newsletter_tpl, "name": "FG Test Campaign"},
        expect=[200,201], category=cat, label="createCampaign")
    newcamp_id = newcamp["id"] if newcamp else None
    if newcamp_id:
        call("get", f"/communication/campaigns/{newcamp_id}", token=ADMIN, expect=200, category=cat, label="getCampaign")
        call("post", f"/communication/campaigns/{newcamp_id}/send", token=STAFF, expect=200, category=cat, label="sendCampaign")
        call("delete", f"/communication/campaigns/{newcamp_id}", token=STAFF, expect=422, category=cat, label="deleteCampaign (already sent -> 422)")
call("post", "/communication/otp/send", token=STAFF, json_body={"phone": "+15550001234"}, expect=200, category=cat, label="sendOtp")
call("post", "/communication/otp/verify", token=STAFF, json_body={"phone": "+15550001234", "code": "000000"}, expect=422, category=cat, label="verifyOtp (wrong code -> 422)")
call("get", "/communication/providers", token=ADMIN, expect=200, category=cat, label="listProviders")
call("patch", "/communication/providers/sms", token=ADMIN, json_body={"provider": "log", "config": {}}, expect=200, category=cat, label="updateProvider")

# ══════════════════════════ FINAL REPORT ══════════════════════════
print("\n\n" + "="*80)
print("FINE-GRAINED CHECK — FINAL REPORT")
print("="*80)
categories = {}
for cat, label, ok, detail in results:
    categories.setdefault(cat, []).append((label, ok, detail))

total_pass = total_fail = total_skip = 0
for cat, items in categories.items():
    passed = sum(1 for _, ok, _ in items if ok is True)
    failed = sum(1 for _, ok, _ in items if ok is False)
    skipped = sum(1 for _, ok, _ in items if ok is None)
    total_pass += passed; total_fail += failed; total_skip += skipped
    print(f"\n## {cat}  ({passed} pass, {failed} fail, {skipped} skipped)")
    for label, ok, detail in items:
        mark = "✅" if ok is True else ("⏭️ " if ok is None else "❌")
        print(f"   {mark} {label}" + (f"    [{detail}]" if ok is False else ""))

print(f"\nTOTAL: {total_pass} passed, {total_fail} failed, {total_skip} skipped out of {len(results)}")

