# Dojo Platform

Full-stack martial arts academy management platform built with Angular 17 + Firebase.

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Foundation — Auth, Design System, Shell layouts, Core services, All routes |
| 2 | 🔜 Next | Coach flow — Attendance, Session comments, Skill scoring, Student profiles |
| 3 | 🔜 | Parent portal — Child progress, Messaging, Notifications |
| 4 | 🔜 | Admin portal — Staff, Disciplines, Belt config, Reports |
| 5 | 🔜 | Public website — Schedule, Booking, Stripe payments |
| 6 | 🔜 | Loyalty program — Points engine, Rewards, Redemption |
| 7 | 🔜 | Polish — Testing, CI/CD, Firebase rules hardening |

## Setup

```bash
npm install
# Add your Firebase config to src/environments/environment.ts
ng serve
```

## Structure

```
src/app/
├── core/
│   ├── models/index.ts          # All TypeScript interfaces (single source of truth)
│   ├── services/                # Firebase services (all extend FirestoreBaseService)
│   ├── guards/                  # Auth + role guards
│   └── utils/index.ts           # Constants + pure functions
├── shared/
│   ├── components/              # Reusable UI components (Avatar, Badge, StatCard…)
│   └── pipes/                   # TimeAgo, Initials
├── layout/                      # Shell components (Admin, Coach, Parent)
└── features/
    ├── auth/                    # Login, Signup, Reset
    ├── admin/                   # Admin portal pages
    ├── coach/                   # Coach portal pages
    └── parent/                  # Parent portal pages
```
