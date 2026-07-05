import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, IconComponent],
  template: `
    <div class="public-layout">
      <!-- Top nav -->
      <nav class="public-nav" [class.scrolled]="scrolled()">
        <div class="public-nav__inner">
          <a routerLink="/" class="public-nav__logo">
            <dojo-icon name="belt" [size]="20"></dojo-icon> <span>Dojo Platform</span>
          </a>

          <!-- Desktop links -->
          <div class="public-nav__links">
            <a routerLink="/public/schedule" routerLinkActive="active">Schedule</a>
            <a routerLink="/public/pricing"  routerLinkActive="active">Pricing</a>
          </div>

          <div class="public-nav__actions">
            <ng-container *ngIf="!auth.isLoggedIn(); else loggedIn">
              <a routerLink="/auth/login"  class="btn btn--ghost btn--sm">Sign in</a>
              <a routerLink="/auth/signup" class="btn btn--primary btn--sm">Get started</a>
            </ng-container>
            <ng-template #loggedIn>
              <a [routerLink]="portalLink()" class="btn btn--primary btn--sm">
                My Portal →
              </a>
            </ng-template>
          </div>

          <!-- Mobile menu toggle -->
          <button class="mobile-menu-btn" (click)="menuOpen.set(!menuOpen())">
            {{ menuOpen() ? '✕' : '☰' }}
          </button>
        </div>

        <!-- Mobile dropdown -->
        <div class="mobile-menu" *ngIf="menuOpen()">
          <a routerLink="/public/schedule" (click)="menuOpen.set(false)"><dojo-icon name="calendar" [size]="14"></dojo-icon> Schedule</a>
          <a routerLink="/public/pricing"  (click)="menuOpen.set(false)"><dojo-icon name="ticket" [size]="14"></dojo-icon> Pricing</a>
          <a routerLink="/auth/login"      (click)="menuOpen.set(false)">Sign in</a>
          <a routerLink="/auth/signup" class="btn btn--primary btn--full" (click)="menuOpen.set(false)">Get started</a>
        </div>
      </nav>

      <!-- Page content -->
      <main class="public-main">
        <router-outlet />
      </main>

      <!-- Footer -->
      <footer class="public-footer">
        <div class="public-footer__inner">
          <div class="public-footer__brand">
            <div style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:8px"><dojo-icon name="belt" [size]="20"></dojo-icon> Dojo Platform</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
              Built for martial arts academies
            </div>
          </div>
          <div class="public-footer__links">
            <div class="footer-col">
              <div class="footer-col__title">Product</div>
              <a routerLink="/public/schedule">Schedule</a>
              <a routerLink="/public/pricing">Pricing</a>
              <a routerLink="/auth/signup">Get started</a>
            </div>
            <div class="footer-col">
              <div class="footer-col__title">Portals</div>
              <a routerLink="/auth/login">Admin login</a>
              <a routerLink="/auth/login">Coach login</a>
              <a routerLink="/auth/login">Parent login</a>
            </div>
          </div>
        </div>
        <div class="public-footer__bottom">
          <span>© {{ year }} Dojo Platform. All rights reserved.</span>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .public-layout { min-height:100vh; display:flex; flex-direction:column; }

    .public-nav {
      position:sticky; top:0; z-index:100;
      background:rgba(15,17,23,.85); backdrop-filter:blur(12px);
      border-bottom:1px solid transparent;
      transition:border-color .3s, background .3s;
      &.scrolled { border-bottom-color:var(--border); background:rgba(15,17,23,.95); }

      &__inner { max-width:1200px; margin:0 auto; padding:0 24px;
                 display:flex; align-items:center; gap:24px; height:64px; }
      &__logo  { display:flex; align-items:center; gap:8px; font-size:18px;
                 font-weight:700; color:var(--text); text-decoration:none;
                 span { color:var(--accent); } }
      &__links { display:flex; gap:24px; flex:1;
                 a { font-size:14px; color:var(--text-muted); text-decoration:none;
                     transition:color .15s;
                     &:hover, &.active { color:var(--text); } } }
      &__actions { display:flex; gap:8px; align-items:center; }
    }

    .mobile-menu-btn { display:none; background:none; border:none; font-size:20px;
                       color:var(--text); cursor:pointer; padding:4px; }
    .mobile-menu     { background:var(--surface); border-top:1px solid var(--border);
                       padding:16px 24px; display:flex; flex-direction:column; gap:12px;
                       a { color:var(--text-muted); text-decoration:none; font-size:14px;
                           padding:8px 0; border-bottom:1px solid var(--border); } }

    .public-main  { flex:1; }

    .public-footer {
      background:var(--surface); border-top:1px solid var(--border); margin-top:auto;
      &__inner { max-width:1200px; margin:0 auto; padding:48px 24px;
                 display:flex; gap:48px; flex-wrap:wrap; justify-content:space-between; }
      &__brand { flex:1; min-width:200px; }
      &__links { display:flex; gap:48px; flex-wrap:wrap; }
      &__bottom{ max-width:1200px; margin:0 auto; padding:16px 24px;
                 border-top:1px solid var(--border); font-size:12px; color:var(--text-muted); }
    }

    .footer-col { display:flex; flex-direction:column; gap:8px; min-width:120px;
      &__title { font-size:12px; font-weight:700; text-transform:uppercase;
                 letter-spacing:.06em; color:var(--text-muted); margin-bottom:4px; }
      a { font-size:13px; color:var(--text-muted); text-decoration:none;
          transition:color .15s; &:hover { color:var(--text); } }
    }

    @media (max-width: 768px) {
      .public-nav__links, .public-nav__actions { display:none; }
      .mobile-menu-btn { display:block; margin-left:auto; }
    }
  `]
})
export class PublicShellComponent {
  auth     = inject(AuthService);
  scrolled = signal(false);
  menuOpen = signal(false);
  year     = new Date().getFullYear();

  portalLink() {
    const role = this.auth.role();
    if (role === 'admin')  return '/admin/dashboard';
    if (role === 'coach')  return '/coach/dashboard';
    return '/parent/dashboard';
  }

  @HostListener('window:scroll')
  onScroll() { this.scrolled.set(window.scrollY > 20); }
}
