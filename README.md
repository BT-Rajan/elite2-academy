# Dojo Platform

Full-stack martial arts academy management platform — Angular 17 frontend + PHP REST API backend (MySQL, JWT auth).

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Foundation — Auth, Design System, Shell layouts, Core services, All routes |
| 2 | ✅ Done | Coach flow — Attendance, Session comments, Skill scoring, Student profiles |
| 3 | ✅ Done | Parent portal — Child progress, Messaging, Notifications |
| 4 | ✅ Done | Admin portal — Staff, Disciplines, Belt config, Reports |
| 5 | ✅ Done | Public website — Schedule, Booking, Pricing |
| 6 | ✅ Done | Loyalty program — Points engine, Rewards, Redemption |
| 7 | 🔜 Next | Polish — Automated testing, CI/CD |

## Setup

See [SETUP.md](SETUP.md) for full backend + frontend setup instructions.

```bash
npm install
ng serve
```

## Structure

```
src/app/
├── core/
│   ├── models/index.ts          # All TypeScript interfaces (single source of truth)
│   ├── services/                # HTTP services (all extend BaseHttpService -> dojo-api)
│   ├── guards/                  # Auth + role guards
│   └── utils/index.ts           # Constants + pure functions
├── shared/
│   ├── components/              # Reusable UI components (Avatar, Badge, StatCard…)
│   └── pipes/                   # TimeAgo, Initials
├── layout/                      # Shell components (Admin, Coach, Parent, Public)
└── features/
    ├── auth/                    # Login, Signup, Reset
    ├── admin/                   # Admin portal pages
    ├── coach/                   # Coach portal pages
    ├── parent/                  # Parent portal pages
    └── public/                  # Public marketing site (Home, Pricing, Schedule)

dojo-api/                        # PHP REST API backend (see SETUP.md)
├── api/index.php                # Router / entry point
├── controllers/                 # Auth, Student, Attendance, Generic CRUD
├── core/                        # Database, JWT, Mailer, Response helpers
├── middleware/                  # Auth middleware
└── database/seed.php            # First-admin seed script
```
