# Dojo Platform — PHP REST API

Pure PHP backend for the Dojo Platform Angular app. Runs on XAMPP.

**Requires PHP 8.1+** (the code uses `never` return types and `array_is_list()`).
Check your XAMPP's PHP version with `php -v`.

## Setup

1. Copy this folder to `C:\xampp\htdocs\dojo-api\`
2. Create the database:
   ```bash
   mysql -u root dojo_platform < database/schema.sql
   ```
3. Seed the first admin:
   ```bash
   php database/seed.php
   ```
4. Edit `config.php` — set a strong `jwt_secret`
5. Test the API:
   ```
   GET http://localhost/dojo-api/api/health
   ```

## Default credentials
- Email: `admin@yourdojo.com`
- Password: `admin123`
- Dojo ID: `dojo-001`

## Config (`config.php`)
```php
'db_host'    => 'localhost',
'db_name'    => 'dojo_platform',
'db_user'    => 'root',
'db_pass'    => '',          // XAMPP default
'jwt_secret' => 'CHANGE_THIS',
'app_url'    => 'http://localhost:4200',
```

## Structure
```
api/index.php          ← Router (all routes defined here)
controllers/
  AuthController.php   ← register, login, logout, password reset
  StudentController.php← students, belt history, objectives
  AttendanceController.php ← sessions, comments, attendance, loyalty
  GenericController.php← disciplines, belts, schedules, threads,
                          messages, loyalty, notifications, users, dojos
core/
  Database.php         ← PDO singleton
  JWT.php              ← encode/decode HS256 tokens
  Response.php         ← JSON response helpers
  Mailer.php           ← PHP mail() wrapper + email templates
middleware/
  Auth.php             ← JWT validation + role check
database/
  schema.sql           ← Full MySQL schema (17 tables)
  seed.php             ← Creates first admin user
```

## Troubleshooting: "HTTP 0: Unknown Error" on login

This means the browser never got a response back from the API at all — it's
a network/CORS-layer failure, not a login-credentials problem. Check in order:

1. **Apache & MySQL running?** Open XAMPP Control Panel, confirm both are green.
2. **PHP 8.1+?** Run `php -v` in the XAMPP `php` folder. Older versions will
   fail to even load `Response.php`. `index.php` now checks this itself and
   returns a clear JSON error instead of silently failing.
3. **Correct folder/URL?** This folder must be at `C:\xampp\htdocs\dojo-api\`
   so that `http://localhost/dojo-api/api/health` returns
   `{"data":{"status":"ok",...}}`. If you get a 404 or the browser can't
   connect, the folder is in the wrong place or Apache isn't serving it.
4. **`.htaccess` being read?** In `httpd.conf` / `httpd-xampp.conf`, the
   `<Directory "C:/xampp/htdocs">` block needs `AllowOverride All` (XAMPP
   ships with this by default, but custom installs sometimes set it to
   `None`, which silently breaks the `/api/*` rewrite and all CORS headers
   with it — the exact combination that produces "HTTP 0" client-side).
   Also confirm `mod_rewrite` is uncommented in `httpd.conf`.
5. **`environment.ts` `apiUrl` matches where you actually put the API.** If
   you copied the folder somewhere other than `dojo-api`, update
   `src/environments/environment.ts` accordingly.

Once Apache/PHP/mod_rewrite are all correct, `/auth/login` will return a
real HTTP status (401 for bad credentials, 500 for a DB error, etc.)
instead of "HTTP 0", and the browser DevTools Network tab will show the
actual response.

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | — | Create account |
| POST | /auth/login | — | Get JWT token |
| POST | /auth/logout | JWT | Invalidate session |
| POST | /auth/forgot-password | — | Send reset email |
| POST | /auth/reset-password | — | Set new password |
| GET  | /students | JWT | List students |
| POST | /students | admin | Create student |
| GET  | /sessions | JWT | List sessions |
| POST | /sessions | coach | Create session |
| POST | /attendance | coach | Mark attendance |
| GET  | /disciplines | JWT | List disciplines |
| GET  | /schedules | — | Public schedule |
| GET  | /threads | JWT | List threads |
| POST | /threads/:id/messages | JWT | Send message |
| GET  | /loyalty/:uid | JWT | Get loyalty account |
| GET  | /notifications | JWT | List notifications |
