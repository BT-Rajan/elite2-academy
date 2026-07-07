import { Routes } from '@angular/router';
import { roleGuard, approvalsGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'public', pathMatch: 'full' },

  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    path: 'auth',
    children: [
      { path: 'login',  loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'signup', loadComponent: () => import('./features/auth/signup/signup.component').then(m => m.SignupComponent) },
      { path: 'reset',  loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
    ]
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./layout/admin-shell/admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',   loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
      { path: 'students',    loadComponent: () => import('./features/coach/student-detail/student-list.component').then(m => m.StudentListComponent) },
      { path: 'students/:id',loadComponent: () => import('./features/coach/student-detail/student-detail.component').then(m => m.StudentDetailComponent) },
      { path: 'staff',       loadComponent: () => import('./features/admin/staff/staff.component').then(m => m.StaffComponent) },
      { path: 'approvals',   canActivate: [approvalsGuard], loadComponent: () => import('./features/admin/approvals/approvals.component').then(m => m.PendingApprovalsComponent) },
      { path: 'branches',    loadComponent: () => import('./features/admin/branches/branches.component').then(m => m.BranchesComponent) },
      { path: 'disciplines', loadComponent: () => import('./features/admin/disciplines/disciplines.component').then(m => m.DisciplinesComponent) },
      { path: 'reports',     loadComponent: () => import('./features/admin/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'communication', loadComponent: () => import('./features/communication/communication-center.component').then(m => m.CommunicationCenterComponent) },
      { path: 'settings',    loadComponent: () => import('./features/admin/settings/admin-settings.component').then(m => m.AdminSettingsComponent) },
      { path: 'profile',     loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
    ]
  },

  // ── Coach ─────────────────────────────────────────────────────────────────
  {
    path: 'coach',
    canActivate: [roleGuard('coach', 'admin')],
    loadComponent: () => import('./layout/coach-shell/coach-shell.component').then(m => m.CoachShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',     loadComponent: () => import('./features/coach/dashboard/coach-dashboard.component').then(m => m.CoachDashboardComponent) },
      { path: 'attendance',    loadComponent: () => import('./features/coach/attendance/attendance.component').then(m => m.AttendanceComponent) },
      { path: 'attendance/:id',loadComponent: () => import('./features/coach/attendance/attendance.component').then(m => m.AttendanceComponent) },
      { path: 'students',      loadComponent: () => import('./features/coach/student-detail/student-list.component').then(m => m.StudentListComponent) },
      { path: 'students/:id',  loadComponent: () => import('./features/coach/student-detail/student-detail.component').then(m => m.StudentDetailComponent) },
      { path: 'messages',      loadComponent: () => import('./features/coach/messages/coach-messages.component').then(m => m.CoachMessagesComponent) },
      { path: 'approvals',     canActivate: [approvalsGuard], loadComponent: () => import('./features/admin/approvals/approvals.component').then(m => m.PendingApprovalsComponent) },
      { path: 'communication', loadComponent: () => import('./features/communication/communication-center.component').then(m => m.CommunicationCenterComponent) },
      { path: 'branches',      loadComponent: () => import('./features/admin/branches/branches.component').then(m => m.BranchesComponent) },
      { path: 'profile',       loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
    ]
  },

  // ── Parent ────────────────────────────────────────────────────────────────
  {
    path: 'parent',
    canActivate: [roleGuard('parent')],
    loadComponent: () => import('./layout/parent-shell/parent-shell.component').then(m => m.ParentShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',       loadComponent: () => import('./features/parent/dashboard/parent-dashboard.component').then(m => m.ParentDashboardComponent) },
      { path: 'progress',        loadComponent: () => import('./features/parent/child-progress/child-progress.component').then(m => m.ChildProgressComponent) },
      { path: 'progress/:id',    loadComponent: () => import('./features/parent/child-progress/child-progress.component').then(m => m.ChildProgressComponent) },
      { path: 'messages',        loadComponent: () => import('./features/parent/messages/parent-messages.component').then(m => m.ParentMessagesComponent) },
      { path: 'loyalty',         loadComponent: () => import('./features/parent/loyalty/loyalty.component').then(m => m.LoyaltyComponent) },
      { path: 'notifications',   loadComponent: () => import('./features/parent/notifications/notifications.component').then(m => m.NotificationsComponent) },
      { path: 'profile',         loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
    ]
  },

  // ── Staff ─────────────────────────────────────────────────────────────────
  {
    path: 'staff',
    canActivate: [roleGuard('staff', 'admin')],
    loadComponent: () => import('./layout/staff-shell/staff-shell.component').then(m => m.StaffShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',     loadComponent: () => import('./features/staff/dashboard/staff-dashboard.component').then(m => m.StaffDashboardComponent) },
      { path: 'students',      loadComponent: () => import('./features/staff/students/staff-students.component').then(m => m.StaffStudentsComponent) },
      { path: 'schedule',      loadComponent: () => import('./features/staff/schedule/staff-schedule.component').then(m => m.StaffScheduleComponent) },
      { path: 'approvals',     canActivate: [approvalsGuard], loadComponent: () => import('./features/admin/approvals/approvals.component').then(m => m.PendingApprovalsComponent) },
      { path: 'communication', loadComponent: () => import('./features/communication/communication-center.component').then(m => m.CommunicationCenterComponent) },
      { path: 'branches',      loadComponent: () => import('./features/admin/branches/branches.component').then(m => m.BranchesComponent) },
      { path: 'notifications', loadComponent: () => import('./features/parent/notifications/notifications.component').then(m => m.NotificationsComponent) },
      { path: 'profile',       loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
    ]
  },

  // ── Public website ───────────────────────────────────────────────────────
  {
    path: 'public',
    loadComponent: () => import('./layout/public-shell/public-shell.component').then(m => m.PublicShellComponent),
    children: [
      { path: '',         loadComponent: () => import('./features/public/home/home.component').then(m => m.HomeComponent) },
      { path: 'schedule', loadComponent: () => import('./features/public/schedule/schedule.component').then(m => m.PublicScheduleComponent) },
      { path: 'pricing',  loadComponent: () => import('./features/public/pricing/pricing.component').then(m => m.PricingComponent) },
    ]
  },

  { path: '**', redirectTo: 'auth/login' }
];
