import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/auth/login']);
};

export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return () => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    const role   = auth.role();
    if (role && roles.includes(role)) return true;
    return router.createUrlTree(['/auth/login']);
  };
}

// Account Approvals: admin and staff always have access; a coach needs
// Head Coach status (regular coaches can't act on anything there — see
// GenericController::listPendingUsers/listUserHistory, which enforce the
// same rule server-side regardless of what this guard does).
export const approvalsGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const user   = auth.currentUser();
  const allowed = !!user && (
    user.role === 'admin' || user.role === 'staff' ||
    (user.role === 'coach' && !!user.isHeadCoach)
  );
  if (allowed) return true;
  return router.createUrlTree([{
    admin: '/admin/dashboard', staff: '/staff/dashboard',
    coach: '/coach/dashboard', parent: '/parent/dashboard',
  }[user?.role ?? 'coach'] ?? '/auth/login']);
};
