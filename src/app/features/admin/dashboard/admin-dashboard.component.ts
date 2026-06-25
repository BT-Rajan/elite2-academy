import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StudentService } from '../../../core/services/student.service';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, StatCardComponent, LoadingComponent],
  template: `
    <dojo-page-header title="Admin Dashboard" subtitle="Business overview"></dojo-page-header>

    <div class="stat-grid stat-grid--4 mb-6">
      <dojo-stat-card icon="🧒" [value]="stats().students" label="Active Students"></dojo-stat-card>
      <dojo-stat-card icon="👥" [value]="stats().coaches"  label="Coaches"></dojo-stat-card>
      <dojo-stat-card icon="📅" [value]="stats().sessions" label="Sessions this week"></dojo-stat-card>
      <dojo-stat-card icon="⭐" [value]="stats().points"   label="Points awarded today"></dojo-stat-card>
    </div>

    <div class="form-grid form-grid--2">
      <div class="card">
        <div class="card__header"><span class="card__title">Quick Actions</span></div>
        <div class="card__body" style="display:flex;flex-direction:column;gap:8px">
          <a routerLink="/admin/staff"      class="btn btn--secondary btn--full">👥 Manage Staff</a>
          <a routerLink="/admin/students"   class="btn btn--secondary btn--full">🧒 View Students</a>
          <a routerLink="/admin/disciplines"class="btn btn--secondary btn--full">🥋 Disciplines & Belts</a>
          <a routerLink="/admin/reports"    class="btn btn--secondary btn--full">📊 Reports</a>
          <a routerLink="/admin/settings"   class="btn btn--secondary btn--full">⚙ Settings</a>
        </div>
      </div>
      <div class="card">
        <div class="card__header"><span class="card__title">Getting Started</span></div>
        <div class="card__body">
          <ol style="padding-left:18px;color:var(--text-muted);font-size:14px;line-height:2">
            <li>Add your disciplines and belt levels</li>
            <li>Create coach accounts</li>
            <li>Have parents register and add children</li>
            <li>Configure the loyalty program</li>
            <li>Set up your class schedule</li>
          </ol>
        </div>
      </div>
    </div>
  `
})
export class AdminDashboardComponent {
  stats = signal({ students: 0, coaches: 0, sessions: 0, points: 0 });
}
