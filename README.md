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
├── controllers/                 # Auth, Student, Attendance, Curriculum, Evaluation, Generic CRUD
├── core/                        # Database, JWT, Mailer, Response helpers
├── middleware/                  # Auth middleware (role + Head Coach checks)
└── database/seed.php            # First-admin seed script
```

## Curriculum Roadmap

Disciplines can define a multi-track belt roadmap (e.g. Elita's integrated
Kajukenbo + Kickboxing + BJJ + Self-Defense program — "One Belt, One
Stripe, Three Arts"). Each belt can carry a Kickboxing level, a BJJ stripe
requirement, a required number of Self-Defense seminar points, and
per-track syllabus text.

- **Parents/students** see the full roadmap and their current position under
  the child's **Roadmap** tab.
- **Coaches** evaluate a student's Striking, Grappling, and Self-Defense
  readiness per track, award BJJ stripes and seminar points, and promote a
  student once all three tracks pass and seminar points are met.
- **Head Coaches** (a flag an Admin sets per coach under Staff & Members)
  can overrule any single coach's evaluation, and can force a promotion
  that doesn't yet meet all requirements — always with a documented reason.
- **Admins** configure the roadmap itself (belts + syllabus) under
  Disciplines & Belts.

See `dojo-api/database/seed_curriculum_elita.php` to seed the Elita
curriculum, and `dojo-api/database/migrate_curriculum_v1.sql` to add the
feature to an existing database.
