# Dojo Platform — PHP REST API

Pure PHP backend for the Dojo Platform Angular app. Runs on XAMPP.

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
