import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IconComponent, IconName } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <!-- Hero -->
    <section class="hero">
      <div class="hero__inner">
        <div class="hero__badge"><dojo-icon name="belt" [size]="14"></dojo-icon> Purpose-built for martial arts</div>
        <h1 class="hero__title">
          Run your dojo<br>
          <span class="hero__accent">smarter, not harder</span>
        </h1>
        <p class="hero__sub">
          Attendance tracking, skill development, parent communication,
          belt progression, and loyalty rewards — all in one platform.
        </p>
        <div class="hero__cta">
          <a routerLink="/auth/signup" class="btn btn--primary btn--lg">Start free trial</a>
          <a routerLink="/public/schedule" class="btn btn--secondary btn--lg">View schedule</a>
        </div>
        <div class="hero__social-proof">
          <div class="social-proof-item"><dojo-icon name="check" [size]="14"></dojo-icon> No credit card required</div>
          <div class="social-proof-item"><dojo-icon name="check" [size]="14"></dojo-icon> Setup in 5 minutes</div>
          <div class="social-proof-item"><dojo-icon name="check" [size]="14"></dojo-icon> Cancel anytime</div>
        </div>
      </div>
      <div class="hero__visual" aria-hidden="true">
        <div class="hero-card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--accent-dim);
                        display:flex;align-items:center;justify-content:center"><dojo-icon name="child" [size]="20"></dojo-icon></div>
            <div>
              <div style="font-weight:600;font-size:14px">Arjun Sharma</div>
              <div style="font-size:12px;color:var(--text-muted)">Kickboxing · Orange Belt</div>
            </div>
            <span style="margin-left:auto;background:rgba(34,197,94,.15);color:#4ade80;
                         font-size:11px;padding:2px 8px;border-radius:8px">Present</span>
          </div>
          <div style="margin-bottom:12px">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Skill Progress</div>
            <div *ngFor="let s of skills" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <div style="width:70px;font-size:11px;color:var(--text-muted)">{{ s.label }}</div>
              <div style="flex:1;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                <div [style.width.%]="s.val" style="height:100%;border-radius:3px;background:var(--accent)"></div>
              </div>
              <div style="width:24px;font-size:11px;text-align:right">{{ s.val }}%</div>
            </div>
          </div>
          <div style="background:var(--accent-dim);border-radius:8px;padding:10px 12px;font-size:12px">
            <dojo-icon name="message" [size]="14"></dojo-icon> <em style="color:var(--text-muted)">"Excellent footwork today. Ready for belt test."</em>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats bar -->
    <section class="stats-bar">
      <div class="stats-bar__inner">
        <div *ngFor="let s of stats" class="stat-item">
          <div class="stat-item__value">{{ s.value }}</div>
          <div class="stat-item__label">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="features">
      <div class="section-inner">
        <div class="section-header">
          <div class="section-tag">Features</div>
          <h2 class="section-title">Everything your dojo needs</h2>
          <p class="section-sub">Built specifically for martial arts academies. No generic gym software.</p>
        </div>

        <div class="features-grid">
          <div *ngFor="let f of features" class="feature-card">
            <div class="feature-card__icon"><dojo-icon [name]="f.icon" [size]="24"></dojo-icon></div>
            <h3 class="feature-card__title">{{ f.title }}</h3>
            <p class="feature-card__desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="how-it-works">
      <div class="section-inner">
        <div class="section-header">
          <div class="section-tag">How it works</div>
          <h2 class="section-title">Up and running in minutes</h2>
        </div>
        <div class="steps-grid">
          <div *ngFor="let s of steps; let i = index" class="step-card">
            <div class="step-card__num">{{ i + 1 }}</div>
            <div class="step-card__icon"><dojo-icon [name]="s.icon" [size]="22"></dojo-icon></div>
            <h3 class="step-card__title">{{ s.title }}</h3>
            <p class="step-card__desc">{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Portals overview -->
    <section class="portals">
      <div class="section-inner">
        <div class="section-header">
          <div class="section-tag">Three portals</div>
          <h2 class="section-title">The right view for everyone</h2>
        </div>
        <div class="portals-grid">
          <div *ngFor="let p of portals" class="portal-card" [style.border-color]="p.color">
            <div class="portal-card__header" [style.background]="p.color + '22'">
              <span><dojo-icon [name]="p.icon" [size]="28"></dojo-icon></span>
              <div>
                <div class="portal-card__role">{{ p.role }}</div>
                <div class="portal-card__tagline">{{ p.tagline }}</div>
              </div>
            </div>
            <ul class="portal-card__features">
              <li *ngFor="let f of p.features"><dojo-icon name="check" [size]="14"></dojo-icon> {{ f }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Loyalty highlight -->
    <section class="loyalty-highlight">
      <div class="section-inner">
        <div class="loyalty-content">
          <div class="loyalty-text">
            <div class="section-tag">Loyalty Program</div>
            <h2 class="section-title" style="text-align:left">Keep members coming back</h2>
            <p class="section-sub" style="text-align:left">
              Every class attended, every belt earned, every renewal — turned into points.
              Members redeem for discounts, free classes, and merchandise.
            </p>
            <div class="loyalty-tiers">
              <div *ngFor="let t of tiers" class="tier-badge" [style.color]="t.color">
                <dojo-icon [name]="t.icon" [size]="15"></dojo-icon> {{ t.name }}
              </div>
            </div>
            <a routerLink="/public/pricing" class="btn btn--primary btn--lg" style="margin-top:24px">
              See pricing →
            </a>
          </div>
          <div class="loyalty-visual">
            <div class="loyalty-card">
              <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">Available Points</div>
              <div style="font-size:48px;font-weight:800;color:var(--accent)">1,240</div>
              <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;display:flex;align-items:center;gap:6px"><dojo-icon name="medal" [size]="14"></dojo-icon> Gold Member · 3,800 lifetime pts</div>
              <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden;margin-bottom:6px">
                <div style="height:100%;width:78%;background:#ffd700;border-radius:4px"></div>
              </div>
              <div style="font-size:12px;color:var(--text-muted)">200 pts to Platinum</div>
              <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">
                <div *ngFor="let r of rewardPreview" style="display:flex;align-items:center;gap:10px;
                     background:var(--surface-2);border-radius:8px;padding:10px 12px">
                  <span><dojo-icon [name]="r.icon" [size]="18"></dojo-icon></span>
                  <div style="flex:1;font-size:13px">{{ r.name }}</div>
                  <span style="font-size:12px;font-weight:700;color:var(--accent)">{{ r.pts }} pts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA banner -->
    <section class="cta-banner">
      <div class="section-inner" style="text-align:center">
        <h2 style="font-size:36px;font-weight:800;margin-bottom:12px">
          Ready to transform your dojo?
        </h2>
        <p style="font-size:16px;color:var(--text-muted);max-width:480px;margin:0 auto 28px">
          Join academies that have ditched spreadsheets and WhatsApp groups.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a routerLink="/auth/signup" class="btn btn--primary btn--lg">Start free trial</a>
          <a routerLink="/public/pricing" class="btn btn--secondary btn--lg">View pricing</a>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ── Hero ─────────────────────────────────────────── */
    .hero { min-height:90vh; display:flex; align-items:center;
            background:radial-gradient(ellipse at 20% 50%, rgba(99,102,241,.12) 0%, transparent 60%),
                        radial-gradient(ellipse at 80% 20%, rgba(99,102,241,.08) 0%, transparent 50%);
            padding:80px 24px 60px; }
    .hero__inner { max-width:1200px; margin:0 auto; width:100%;
                   display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; }
    .hero__badge { display:inline-flex; align-items:center; gap:6px; background:var(--accent-dim);
                   color:var(--accent); font-size:13px; font-weight:600; padding:6px 14px;
                   border-radius:20px; margin-bottom:20px; }
    .hero__title { font-size:clamp(36px,5vw,60px); font-weight:800; line-height:1.1;
                   letter-spacing:-.02em; margin-bottom:16px; }
    .hero__accent { background:linear-gradient(135deg,var(--accent),#818cf8); -webkit-background-clip:text;
                    -webkit-text-fill-color:transparent; background-clip:text; }
    .hero__sub { font-size:18px; color:var(--text-muted); line-height:1.6; margin-bottom:28px; max-width:480px; }
    .hero__cta { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
    .hero__social-proof { display:flex; gap:20px; flex-wrap:wrap; }
    .social-proof-item { font-size:13px; color:var(--text-muted); }
    .hero-card { background:var(--surface); border:1px solid var(--border); border-radius:16px;
                 padding:20px; box-shadow:0 20px 60px rgba(0,0,0,.4); }
    .hero__visual { display:flex; justify-content:center; }

    /* ── Stats bar ─────────────────────────────────────── */
    .stats-bar { background:var(--surface); border-top:1px solid var(--border);
                 border-bottom:1px solid var(--border); padding:32px 24px;
      &__inner { max-width:1200px; margin:0 auto; display:flex;
                 justify-content:space-around; flex-wrap:wrap; gap:24px; } }
    .stat-item { text-align:center;
      &__value { font-size:36px; font-weight:800; color:var(--accent); line-height:1; }
      &__label { font-size:13px; color:var(--text-muted); margin-top:4px; } }

    /* ── Shared section styles ─────────────────────────── */
    .section-inner  { max-width:1200px; margin:0 auto; padding:80px 24px; }
    .section-header { text-align:center; margin-bottom:56px; }
    .section-tag    { display:inline-block; background:var(--accent-dim); color:var(--accent);
                      font-size:12px; font-weight:700; text-transform:uppercase;
                      letter-spacing:.08em; padding:4px 12px; border-radius:20px; margin-bottom:12px; }
    .section-title  { font-size:clamp(28px,4vw,40px); font-weight:800; margin-bottom:12px; }
    .section-sub    { font-size:16px; color:var(--text-muted); max-width:560px;
                      margin:0 auto; line-height:1.6; }

    /* ── Features ──────────────────────────────────────── */
    .features { background:var(--bg); }
    .features-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px; }
    .feature-card { background:var(--surface); border:1px solid var(--border); border-radius:12px;
                    padding:24px; transition:border-color .2s,transform .2s;
                    &:hover { border-color:var(--accent); transform:translateY(-2px); }
      &__icon  { font-size:32px; margin-bottom:12px; }
      &__title { font-size:16px; font-weight:700; margin-bottom:8px; }
      &__desc  { font-size:14px; color:var(--text-muted); line-height:1.6; }
    }

    /* ── How it works ──────────────────────────────────── */
    .how-it-works { background:var(--surface); }
    .steps-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:24px; }
    .step-card    { text-align:center; padding:24px;
      &__num   { width:32px; height:32px; border-radius:50%; background:var(--accent); color:#fff;
                 font-size:13px; font-weight:700; display:flex; align-items:center;
                 justify-content:center; margin:0 auto 12px; }
      &__icon  { font-size:28px; margin-bottom:10px; }
      &__title { font-size:15px; font-weight:700; margin-bottom:6px; }
      &__desc  { font-size:13px; color:var(--text-muted); line-height:1.6; }
    }

    /* ── Portals ───────────────────────────────────────── */
    .portals { background:var(--bg); }
    .portals-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
    .portal-card  { border:1px solid var(--border); border-radius:12px; overflow:hidden;
                    transition:transform .2s; &:hover { transform:translateY(-2px); }
      &__header   { padding:20px; display:flex; align-items:center; gap:14px; }
      &__role     { font-size:18px; font-weight:700; }
      &__tagline  { font-size:13px; color:var(--text-muted); margin-top:2px; }
      &__features { list-style:none; padding:16px 20px; margin:0;
                    display:flex; flex-direction:column; gap:8px;
                    background:var(--surface);
                    li { font-size:13px; color:var(--text-muted); } }
    }

    /* ── Loyalty ───────────────────────────────────────── */
    .loyalty-highlight { background:var(--surface); }
    .loyalty-content   { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; }
    .loyalty-tiers     { display:flex; gap:12px; flex-wrap:wrap; margin-top:16px; }
    .tier-badge        { font-size:14px; font-weight:700; background:var(--surface-2);
                         padding:6px 14px; border-radius:20px; }
    .loyalty-card      { background:var(--bg); border:1px solid var(--border);
                         border-radius:16px; padding:24px; }

    /* ── CTA banner ─────────────────────────────────────── */
    .cta-banner { background:radial-gradient(ellipse at center,rgba(99,102,241,.15) 0%,transparent 70%);
                  padding:80px 24px; border-top:1px solid var(--border); }

    @media (max-width: 900px) {
      .hero__inner    { grid-template-columns:1fr; }
      .hero__visual   { display:none; }
      .portals-grid   { grid-template-columns:1fr; }
      .loyalty-content{ grid-template-columns:1fr; }
      .loyalty-visual { display:none; }
    }
  `]
})
export class HomeComponent {
  skills = [
    { label: 'Technique', val: 80 },
    { label: 'Fitness',   val: 70 },
    { label: 'Focus',     val: 90 },
  ];

  stats = [
    { value: '500+',  label: 'Academies using Dojo Platform' },
    { value: '12K+',  label: 'Students tracked' },
    { value: '98%',   label: 'Parent satisfaction' },
    { value: '4.9', label: 'Average rating' },
  ];

  features: { icon: IconName; title: string; desc: string }[] = [
    { icon: 'check',      title: 'Smart Attendance',        desc: 'Mark attendance in seconds with 4 status categories. Parents notified automatically.' },
    { icon: 'chart',      title: 'Skill Development',       desc: 'Track 9 dimensions per student. Visual progress bars parents can actually understand.' },
    { icon: 'belt',       title: 'Belt Progression',        desc: 'Configure your belt system, set requirements, award promotions with full history.' },
    { icon: 'message',    title: 'Parent Communication',    desc: 'Real-time messaging between coaches and parents. No more WhatsApp groups.' },
    { icon: 'star',       title: 'Loyalty Program',         desc: 'Reward attendance and renewals with points. Reduce churn with tier-based perks.' },
    { icon: 'trending',   title: 'Business Reports',        desc: 'Attendance rates, enrolment trends, belt distribution. Data to run your business.' },
    { icon: 'target',     title: 'Student Objectives',      desc: 'Set and track individual goals per student. Celebrate completions with parents.' },
    { icon: 'phone',      title: 'Mobile Ready',            desc: 'Full responsive design. Coaches mark attendance from their phone, parents check progress anywhere.' },
  ];

  steps: { icon: IconName; title: string; desc: string }[] = [
    { icon: 'home',  title: 'Create your dojo',    desc: 'Sign up as admin. Your dojo gets a unique ID instantly.' },
    { icon: 'users', title: 'Invite your team',    desc: 'Share the Dojo ID with coaches and parents. They join in one step.' },
    { icon: 'belt',  title: 'Set up disciplines',  desc: 'Configure your martial arts programs and belt levels.' },
    { icon: 'check', title: 'Start tracking',      desc: 'Take attendance, score skills, send messages. Everything in one place.' },
  ];

  portals: { icon: IconName; role: string; color: string; tagline: string; features: string[] }[] = [
    {
      icon: 'settings', role: 'Admin', color: 'var(--accent)',
      tagline: 'Run the business',
      features: ['Staff & member management', 'Disciplines & belt config', 'Business analytics & reports', 'Loyalty program settings', 'Notification preferences'],
    },
    {
      icon: 'users', role: 'Coach', color: 'var(--success)',
      tagline: 'Guide students',
      features: ['Take class attendance', 'Score 9 student skills', 'Write session comments', 'Award belt promotions', 'Message parents directly'],
    },
    {
      icon: 'child', role: 'Parent', color: 'var(--warning)',
      tagline: 'Track progress',
      features: ['View child\'s skill progress', 'See attendance history', 'Read coach comments', 'Track belt journey', 'Earn & redeem loyalty points'],
    },
  ];

  tiers: { icon: IconName; name: string; color: string }[] = [
    { icon: 'medal', name: 'Bronze', color: '#cd7f32' },
    { icon: 'medal', name: 'Silver', color: '#c0c0c0' },
    { icon: 'medal', name: 'Gold',   color: '#ffd700' },
    { icon: 'gem',   name: 'Platinum', color: '#818cf8' },
  ];

  rewardPreview: { icon: IconName; name: string; pts: number }[] = [
    { icon: 'money',  name: '10% off next renewal',  pts: 500 },
    { icon: 'ticket', name: 'One free class',         pts: 300 },
    { icon: 'shirt', name: 'Academy merchandise',    pts: 800 },
  ];
}
