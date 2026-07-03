# Dojo Platform — Setup Guide

## Stack
- **Frontend**: Angular 17 + HttpClient (no Firebase)
- **Backend**: PHP REST API on XAMPP
- **Database**: MySQL
- **Auth**: JWT + bcrypt
- **Emails**: PHP mail()

---

## 1. Backend (PHP API on XAMPP)

You can install this **either** of two ways — the router now auto-detects
its own path, so both work without editing PHP code:

**Option A — whole repo copied to htdocs** (e.g. `C:\xampp\htdocs\elite2-academy\`):
API lives at `http://localhost/elite2-academy/dojo-api/api`

**Option B — just the `dojo-api/` folder copied to `C:\xampp\htdocs\dojo-api\`:**
API lives at `http://localhost/dojo-api/api`

Whichever you use, set `apiUrl` in `src/environments/environment.ts` to match.

```bash
# Create database
mysql -u root dojo_platform < database/schema.sql

# Seed a full test dataset: the Elita curriculum roadmap (8 belts ×
# Striking/Grappling/Self-Defense syllabus), a second plain single-track
# discipline, every role (admin/head coach/coach/staff/3 parents), 5
# students in varying states of progress, attendance history, coach
# notes, messaging, loyalty, and notifications. Safe to re-run.
php database/seed.php

# If you're adding the curriculum roadmap feature to an existing database
# instead of a fresh install, run this instead of schema.sql:
mysql -u root dojo_platform < database/migrate_curriculum_v1.sql
```

`seed.php` prints every test login (with passwords) when it finishes.

Edit `config.php`:
```php
'jwt_secret' => 'paste-a-64-char-random-string-here',
'app_url'    => 'http://localhost:4200',
```

Generate a secure JWT secret:
```bash
php -r "echo bin2hex(random_bytes(32));"
```

Test the API (adjust the path to match your install option above):
```
GET http://localhost/elite2-academy/dojo-api/api/health
→ {"data":{"status":"ok"}}
```

---

## 2. Frontend (Angular)

```bash
cd dojo-platform
npm install
ng serve
```

Visit `http://localhost:4200`

---

## 3. First login

- **Email**: `admin@yourdojo.com`
- **Password**: `admin123`
- **Dojo ID**: `dojo-001`

After login go to:
1. `/admin/disciplines` — add your disciplines and belts
2. `/admin/settings` — set your dojo name
3. Share dojo ID `dojo-001` with coaches/parents to sign up

---

## 4. Email (password reset)

XAMPP uses PHP's `mail()`. For local dev, install
[MailHog](https://github.com/mailhog/MailHog) or
[Mailtrap](https://mailtrap.io) and configure `php.ini`:

```ini
SMTP = smtp.mailtrap.io
smtp_port = 2525
sendmail_from = noreply@yourdojo.com
```

---

## 5. Production deployment

1. Upload `dojo-api/` to your server
2. Upload built Angular app (`dist/dojo-platform/browser/`) to web root
3. Update `config.php` with production DB credentials
4. Update `src/environments/environment.prod.ts` with production API URL
5. Build: `ng build --configuration=production`

---

## Environment files

`src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  // match whichever install option you used above
  apiUrl: 'http://localhost/elite2-academy/dojo-api/api',
};
```

`src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-domain.com/api',
};
```
