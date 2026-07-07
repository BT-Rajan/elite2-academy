import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CommunicationService } from '../../core/services/communication.service';
import { StudentService } from '../../core/services/student.service';
import { BranchService } from '../../core/services/branch.service';
import { DisciplineService } from '../../core/services/discipline.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CommEventCatalogEntry, CommTemplate, CommLog, CommCampaign, CommProviderConfig,
  Student, Branch, Discipline, CommCampaignType,
} from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

type Tab = 'compose' | 'templates' | 'history' | 'campaigns' | 'providers';

interface TemplateFormState {
  id?: string;
  eventType: string;
  channel: string;
  name: string;
  subject?: string;
  body: string;
}

@Component({
  selector: 'app-communication-center',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent, EmptyStateComponent, BadgeComponent, IconComponent],
  template: `
    <dojo-page-header title="Communication Center" subtitle="Send WhatsApp, SMS & Email across every event, manage templates, and review send history"></dojo-page-header>

    <div class="tabs mb-6">
      <button class="tab-btn" [class.active]="tab() === 'compose'" (click)="tab.set('compose')">
        <dojo-icon name="message" [size]="14"></dojo-icon> Compose &amp; Send</button>
      <button class="tab-btn" *ngIf="canManageTemplates()" [class.active]="tab() === 'templates'" (click)="tab.set('templates')">
        <dojo-icon name="clipboard" [size]="14"></dojo-icon> Templates</button>
      <button class="tab-btn" [class.active]="tab() === 'history'" (click)="tab.set('history')">
        <dojo-icon name="inbox" [size]="14"></dojo-icon> History</button>
      <button class="tab-btn" *ngIf="canManageCampaigns()" [class.active]="tab() === 'campaigns'" (click)="tab.set('campaigns')">
        <dojo-icon name="target" [size]="14"></dojo-icon> Campaigns</button>
      <button class="tab-btn" *ngIf="canManageProviders()" [class.active]="tab() === 'providers'" (click)="tab.set('providers')">
        <dojo-icon name="settings" [size]="14"></dojo-icon> Providers</button>
    </div>

    <!-- ══════════════════════════ COMPOSE & SEND ══════════════════════════ -->
    <ng-container *ngIf="tab() === 'compose'">
      <div class="card" style="max-width:640px">
        <div class="card__header"><span class="card__title">Send a message</span></div>
        <div class="card__body">
          <div class="form-group">
            <label>Event</label>
            <select class="select" [(ngModel)]="composeEventType" (ngModelChange)="onEventChange()">
              <option value="">Choose an event…</option>
              <option *ngFor="let e of eventTypes()" [value]="e.value">{{ e.label }}</option>
            </select>
          </div>

          <div class="form-group" *ngIf="composeEventType">
            <label>Channel</label>
            <select class="select" [(ngModel)]="composeChannel" (ngModelChange)="onChannelChange()">
              <option value="">Choose a channel…</option>
              <option *ngFor="let c of channelsForEvent()" [value]="c">{{ channelLabel(c) }}</option>
            </select>
          </div>

          <ng-container *ngIf="composeEventType === 'parent_engagement'">
            <dojo-empty-state icon="message" title="In-app chat only"
              subtitle="Parent engagement isn't sent through external channels — use Messages to talk with a parent directly."></dojo-empty-state>
          </ng-container>

          <ng-container *ngIf="composeChannel && composeEventType !== 'parent_engagement'">
            <div class="form-group">
              <label>Template <span class="text-muted text-sm">(optional — leave blank to write an ad-hoc message)</span></label>
              <select class="select" [(ngModel)]="composeTemplateId" (ngModelChange)="onTemplateChange()">
                <option value="">Ad-hoc message (no template)</option>
                <option *ngFor="let t of templatesForEventChannel()" [value]="t.id">{{ t.name }}</option>
              </select>
            </div>

            <div class="form-group" *ngIf="composeChannel === 'email'">
              <label>Subject</label>
              <input class="input" [(ngModel)]="composeSubject" placeholder="Email subject">
            </div>

            <div class="form-group">
              <label>Body</label>
              <textarea class="textarea" rows="5" [(ngModel)]="composeBody"
                placeholder="Use {{ '{{studentName}}' }}, {{ '{{parentName}}' }}, {{ '{{dojoName}}' }}, etc."></textarea>
            </div>

            <div class="form-group" *ngIf="composeVariableNames().length > 0">
              <label>Template variables</label>
              <div style="display:flex;flex-direction:column;gap:8px">
                <div *ngFor="let v of composeVariableNames()" style="display:flex;align-items:center;gap:8px">
                  <span style="width:140px;font-size:12px;color:var(--text-muted);font-family:var(--font-mono)">{{ v }}</span>
                  <input class="input" [(ngModel)]="composeVariables[v]" [placeholder]="'Value for ' + v">
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Recipient</label>
              <div class="tabs" style="border-bottom:none;gap:8px;margin-bottom:10px">
                <button class="tab-btn" [class.active]="composeRecipientMode === 'student'" (click)="composeRecipientMode = 'student'">Student's parent</button>
                <button class="tab-btn" [class.active]="composeRecipientMode === 'custom'" (click)="composeRecipientMode = 'custom'">Custom address</button>
              </div>

              <select class="select" *ngIf="composeRecipientMode === 'student'" [(ngModel)]="composeStudentId">
                <option value="">Choose a student…</option>
                <option *ngFor="let s of students()" [value]="s.id">{{ s.firstName }} {{ s.lastName }}</option>
              </select>

              <div *ngIf="composeRecipientMode === 'custom'" style="display:flex;flex-direction:column;gap:8px">
                <input class="input" [(ngModel)]="composeCustomName" placeholder="Recipient name (optional)">
                <input class="input" [(ngModel)]="composeCustomAddress"
                  [placeholder]="composeChannel === 'email' ? 'name@example.com' : '+1 555 0100'">
              </div>
            </div>

            <button class="btn btn--primary btn--full" [disabled]="sending() || !canSubmitCompose()" (click)="submitSend()">
              <dojo-icon *ngIf="!sending()" name="message" [size]="14"></dojo-icon>
              {{ sending() ? 'Sending…' : 'Send' }}
            </button>

            <div *ngIf="lastResult() as r" class="mt-4"
              style="padding:12px;border-radius:8px;border:1px solid"
              [style.background]="r.status === 'sent' ? 'rgba(63,143,92,.12)' : 'rgba(180,67,59,.12)'"
              [style.border-color]="r.status === 'sent' ? 'var(--success)' : 'var(--danger)'"
              [style.color]="r.status === 'sent' ? 'var(--success)' : 'var(--danger)'">
              <strong style="display:inline-flex;align-items:center;gap:6px">
                <dojo-icon [name]="r.status === 'sent' ? 'check' : 'close'" [size]="14"></dojo-icon>
                {{ r.status === 'sent' ? 'Sent' : 'Failed' }}
              </strong>
              <div *ngIf="r.error" style="font-size:13px;margin-top:4px;color:var(--text)">{{ r.error }}</div>
            </div>
          </ng-container>
        </div>
      </div>
    </ng-container>

    <!-- ══════════════════════════ TEMPLATES ══════════════════════════ -->
    <ng-container *ngIf="tab() === 'templates' && canManageTemplates()">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn--primary" (click)="startNewTemplate()">+ New Template</button>
        <button class="btn btn--secondary" (click)="triggerImport()">⬆ Import JSON</button>
        <button class="btn btn--secondary" (click)="exportTemplates()">⬇ Export JSON</button>
        <input #fileInput type="file" accept="application/json" style="display:none" (change)="onImportFile($event)">
      </div>

      <div class="card mb-4" *ngIf="templateForm">
        <div class="card__header"><span class="card__title">{{ templateForm.id ? 'Edit Template' : 'New Template' }}</span></div>
        <div class="card__body">
          <div class="form-grid form-grid--2">
            <div class="form-group">
              <label>Event</label>
              <select class="select" [(ngModel)]="templateForm.eventType" (ngModelChange)="templateForm!.channel = ''">
                <option value="">Choose an event…</option>
                <option *ngFor="let e of eventTypes()" [value]="e.value">{{ e.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Channel</label>
              <select class="select" [(ngModel)]="templateForm.channel">
                <option value="">Choose a channel…</option>
                <option *ngFor="let c of channelsFor(templateForm.eventType)" [value]="c">{{ channelLabel(c) }}</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Name</label>
            <input class="input" [(ngModel)]="templateForm.name" placeholder="e.g. Welcome Email">
          </div>
          <div class="form-group" *ngIf="templateForm.channel === 'email'">
            <label>Subject</label>
            <input class="input" [(ngModel)]="templateForm.subject" placeholder="Email subject">
          </div>
          <div class="form-group">
            <label>Body</label>
            <textarea class="textarea" rows="5" [(ngModel)]="templateForm.body"
              placeholder="Use {{ '{{studentName}}' }}, {{ '{{parentName}}' }}, {{ '{{dojoName}}' }}, etc."></textarea>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn--primary" (click)="saveTemplate()">{{ templateForm.id ? 'Save Changes' : 'Create Template' }}</button>
            <button class="btn btn--ghost" (click)="templateForm = null">Cancel</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <span class="card__title">All Templates</span>
          <span class="text-muted text-sm">{{ templates().length }} total</span>
        </div>
        <dojo-empty-state *ngIf="templates().length === 0" icon="folder" title="No templates yet"
          subtitle="Create one above, or import a JSON file."></dojo-empty-state>
        <table *ngIf="templates().length > 0">
          <thead><tr><th>Name</th><th>Event</th><th>Channel</th><th>Variables</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let t of templates()">
              <td><strong>{{ t.name }}</strong><div *ngIf="t.subject" class="text-muted text-sm">{{ t.subject }}</div></td>
              <td><dojo-badge variant="info">{{ eventLabel(t.eventType) }}</dojo-badge></td>
              <td><dojo-badge>{{ channelLabel(t.channel) }}</dojo-badge></td>
              <td class="text-muted text-sm">{{ t.variables.join(', ') || '—' }}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn--ghost btn--sm" (click)="editTemplate(t)">Edit</button>
                <button class="btn btn--ghost btn--sm" (click)="removeTemplate(t)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>

    <!-- ══════════════════════════ HISTORY ══════════════════════════ -->
    <ng-container *ngIf="tab() === 'history'">
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <select class="select" style="width:auto" [(ngModel)]="historyEventType" (ngModelChange)="loadLogs()">
            <option value="">All events</option>
            <option *ngFor="let e of eventTypes()" [value]="e.value">{{ e.label }}</option>
          </select>
          <select class="select" style="width:auto" [(ngModel)]="historyChannel" (ngModelChange)="loadLogs()">
            <option value="">All channels</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
          <select class="select" style="width:auto" [(ngModel)]="historyStatus" (ngModelChange)="loadLogs()">
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div class="card">
        <dojo-empty-state *ngIf="logs().length === 0" icon="clipboard" title="No messages yet"
          subtitle="Sends will show up here as soon as you send one."></dojo-empty-state>
        <table *ngIf="logs().length > 0">
          <thead><tr><th>When</th><th>Event</th><th>Channel</th><th>Recipient</th><th>Status</th></tr></thead>
          <tbody>
            <tr *ngFor="let l of logs()">
              <td class="text-muted text-sm">{{ l.createdAt | date:'MMM d, h:mm a' }}</td>
              <td><dojo-badge variant="info">{{ eventLabel(l.eventType) }}</dojo-badge></td>
              <td><dojo-badge>{{ channelLabel(l.channel) }}</dojo-badge></td>
              <td>{{ l.recipientName || l.recipientAddress }}<div class="text-muted text-sm">{{ l.recipientAddress }}</div></td>
              <td>
                <dojo-badge [variant]="l.status === 'sent' ? 'success' : 'danger'">{{ l.status }}</dojo-badge>
                <div *ngIf="l.error" class="text-muted text-sm" style="max-width:220px">{{ l.error }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>

    <!-- ══════════════════════════ CAMPAIGNS ══════════════════════════ -->
    <ng-container *ngIf="tab() === 'campaigns' && canManageCampaigns()">
      <div class="card mb-4">
        <div class="card__header"><span class="card__title">New Campaign</span></div>
        <div class="card__body">
          <div class="form-grid form-grid--2">
            <div class="form-group">
              <label>Type</label>
              <select class="select" [(ngModel)]="campType" (ngModelChange)="campChannel = ''; campTemplateId = ''">
                <option value="email_campaign">Email Campaign</option>
                <option value="newsletter">Newsletter</option>
                <option value="marketing_promo">Promotions</option>
              </select>
            </div>
            <div class="form-group">
              <label>Channel</label>
              <select class="select" [(ngModel)]="campChannel" (ngModelChange)="campTemplateId = ''">
                <option value="">Choose a channel…</option>
                <option *ngFor="let c of channelsFor(campType)" [value]="c">{{ channelLabel(c) }}</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Template</label>
            <select class="select" [(ngModel)]="campTemplateId">
              <option value="">Choose a template…</option>
              <option *ngFor="let t of templatesFor(campType, campChannel)" [value]="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Campaign name</label>
            <input class="input" [(ngModel)]="campName" placeholder="e.g. July Newsletter">
          </div>
          <div class="form-grid form-grid--2">
            <div class="form-group">
              <label>Branch <span class="text-muted text-sm">(optional — leave blank for all branches)</span></label>
              <select class="select" [(ngModel)]="campBranchId">
                <option value="">All branches</option>
                <option *ngFor="let b of branches()" [value]="b.id">{{ b.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Discipline <span class="text-muted text-sm">(optional)</span></label>
              <select class="select" [(ngModel)]="campDisciplineId">
                <option value="">Any discipline</option>
                <option *ngFor="let d of disciplines()" [value]="d.id">{{ d.name }}</option>
              </select>
            </div>
          </div>
          <button class="btn btn--primary" [disabled]="!campType || !campChannel || !campTemplateId || !campName" (click)="createCampaign()">
            Create Draft
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card__header"><span class="card__title">Campaigns</span></div>
        <dojo-empty-state *ngIf="campaigns().length === 0" icon="bell" title="No campaigns yet"></dojo-empty-state>
        <table *ngIf="campaigns().length > 0">
          <thead><tr><th>Name</th><th>Type</th><th>Channel</th><th>Recipients</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let c of campaigns()">
              <td><strong>{{ c.name }}</strong></td>
              <td><dojo-badge variant="info">{{ eventLabel(c.type) }}</dojo-badge></td>
              <td><dojo-badge>{{ channelLabel(c.channel) }}</dojo-badge></td>
              <td>{{ c.sentCount }} / {{ c.totalRecipients }}{{ c.failedCount > 0 ? ' (' + c.failedCount + ' failed)' : '' }}</td>
              <td>
                <dojo-badge [variant]="c.status === 'sent' ? 'success' : c.status === 'failed' ? 'danger' : 'gray'">{{ c.status }}</dojo-badge>
              </td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn--primary btn--sm" *ngIf="c.status === 'draft'" (click)="sendCampaign(c)">Send Now</button>
                <button class="btn btn--ghost btn--sm" *ngIf="c.status === 'draft'" (click)="removeCampaign(c)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>

    <!-- ══════════════════════════ PROVIDERS ══════════════════════════ -->
    <ng-container *ngIf="tab() === 'providers' && canManageProviders()">
      <div class="form-grid form-grid--2">
        <div class="card" *ngFor="let p of providers()">
          <div class="card__header"><span class="card__title">{{ channelLabel(p.channel) }}</span></div>
          <div class="card__body">
            <div class="form-group">
              <label>Provider</label>
              <select class="select" [(ngModel)]="p.provider">
                <option *ngFor="let opt of p.available" [value]="opt">{{ opt }}</option>
              </select>
            </div>

            <ng-container *ngIf="p.provider === 'twilio'">
              <div class="form-group"><label>Account SID</label><input class="input" [(ngModel)]="p.config['accountSid']"></div>
              <div class="form-group"><label>Auth Token</label><input class="input" type="password" [(ngModel)]="p.config['authToken']"></div>
              <div class="form-group"><label>From Number</label><input class="input" [(ngModel)]="p.config['fromNumber']" placeholder="+15551234567"></div>
            </ng-container>

            <ng-container *ngIf="p.provider === 'whatsapp_cloud'">
              <div class="form-group"><label>Phone Number ID</label><input class="input" [(ngModel)]="p.config['phoneNumberId']"></div>
              <div class="form-group"><label>Access Token</label><input class="input" type="password" [(ngModel)]="p.config['accessToken']"></div>
              <div class="form-group"><label>API Version <span class="text-muted text-sm">(optional)</span></label><input class="input" [(ngModel)]="p.config['apiVersion']" placeholder="v19.0"></div>
            </ng-container>

            <div class="text-muted text-sm mb-2" *ngIf="p.provider === 'log'">
              Mock mode — messages are logged, not actually sent. Safe default until real credentials are configured.
            </div>
            <div class="text-muted text-sm mb-2" *ngIf="p.provider === 'smtp'">
              Uses this server's configured mail sending — no extra setup needed.
            </div>

            <button class="btn btn--primary" (click)="saveProvider(p)">Save</button>
          </div>
        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    .tabs     { display:flex; gap:4px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
    .tab-btn  { padding:8px 16px; font-size:13px; font-weight:500; border:none; background:none;
                color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent;
                margin-bottom:-1px; transition:color .15s,border-color .15s;
                display:inline-flex; align-items:center; gap:6px; }
    .tab-btn:hover  { color:var(--text); }
    .tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
  `]
})
export class CommunicationCenterComponent implements OnInit {
  private auth   = inject(AuthService);
  private comms  = inject(CommunicationService);
  private sts    = inject(StudentService);
  private branchSvc = inject(BranchService);
  private discSvc   = inject(DisciplineService);
  private toast  = inject(ToastService);

  tab = signal<Tab>('compose');

  role = computed(() => this.auth.currentUser()?.role);
  isHeadCoach = computed(() => !!this.auth.currentUser()?.isHeadCoach);
  canManageTemplates = computed(() => this.role() === 'admin' || this.role() === 'staff' || (this.role() === 'coach' && this.isHeadCoach()));
  canManageCampaigns = computed(() => this.canManageTemplates());
  canManageProviders = computed(() => this.role() === 'admin');

  eventTypes = signal<CommEventCatalogEntry[]>([]);
  templates  = signal<CommTemplate[]>([]);
  logs       = signal<CommLog[]>([]);
  campaigns  = signal<CommCampaign[]>([]);
  providers  = signal<CommProviderConfig[]>([]);
  students   = signal<Student[]>([]);
  branches   = signal<Branch[]>([]);
  disciplines = signal<Discipline[]>([]);

  // ── Compose state ──────────────────────────────────────────────────────────
  composeEventType = '';
  composeChannel = '';
  composeTemplateId = '';
  composeRecipientMode: 'student' | 'custom' = 'student';
  composeStudentId = '';
  composeCustomName = '';
  composeCustomAddress = '';
  composeSubject = '';
  composeBody = '';
  composeVariables: Record<string, string> = {};
  sending = signal(false);
  lastResult = signal<{ status: string; error?: string } | null>(null);

  channelsForEvent = computed(() => this.eventTypes().find(e => e.value === this.composeEventType)?.channels ?? []);
  templatesForEventChannel = computed(() =>
    this.templates().filter(t => t.eventType === this.composeEventType && t.channel === this.composeChannel));
  composeVariableNames = computed(() => {
    const t = this.templates().find(t => t.id === this.composeTemplateId);
    return t?.variables ?? [];
  });

  // ── Templates tab state ────────────────────────────────────────────────────
  templateForm: TemplateFormState | null = null;

  // ── History tab state ──────────────────────────────────────────────────────
  historyEventType = '';
  historyChannel = '';
  historyStatus = '';

  // ── Campaigns tab state ────────────────────────────────────────────────────
  campType: CommCampaignType = 'newsletter';
  campChannel = '';
  campTemplateId = '';
  campName = '';
  campBranchId = '';
  campDisciplineId = '';

  ngOnInit() {
    const dojoId = this.auth.currentUser()!.dojoId;
    this.comms.eventTypes$().subscribe(e => this.eventTypes.set(e));
    this.comms.templates$().subscribe(t => this.templates.set(t));
    this.sts.byDojo$(dojoId).subscribe(s => this.students.set(s));
    this.branchSvc.list$().subscribe(b => this.branches.set(b));
    this.discSvc.byDojo$(dojoId).subscribe(d => this.disciplines.set(d));
    this.loadLogs();
    if (this.canManageCampaigns()) this.comms.campaigns$().subscribe(c => this.campaigns.set(c));
    if (this.canManageProviders()) this.comms.providers$().subscribe(p => this.providers.set(p));
  }

  eventLabel(eventType: string): string { return this.eventTypes().find(e => e.value === eventType)?.label ?? eventType; }
  channelLabel(channel: string): string {
    return { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', chat: 'In-app Chat' }[channel as 'whatsapp'|'sms'|'email'|'chat'] ?? channel;
  }
  channelsFor(eventType: string | undefined): string[] { return this.eventTypes().find(e => e.value === eventType)?.channels ?? []; }
  templatesFor(eventType: string, channel: string): CommTemplate[] {
    return this.templates().filter(t => t.eventType === eventType && t.channel === channel);
  }

  // ── Compose ────────────────────────────────────────────────────────────────
  onEventChange() { this.composeChannel = ''; this.composeTemplateId = ''; this.lastResult.set(null); }
  onChannelChange() { this.composeTemplateId = ''; this.composeSubject = ''; this.composeBody = ''; this.lastResult.set(null); }
  onTemplateChange() {
    const t = this.templates().find(t => t.id === this.composeTemplateId);
    this.composeSubject = t?.subject ?? '';
    this.composeBody = t?.body ?? '';
    this.composeVariables = {};
    (t?.variables ?? []).forEach(v => this.composeVariables[v] = '');
  }

  canSubmitCompose(): boolean {
    if (!this.composeEventType || !this.composeChannel || !this.composeBody) return false;
    if (this.composeChannel === 'email' && !this.composeSubject) return false;
    if (this.composeRecipientMode === 'student') return !!this.composeStudentId;
    return !!this.composeCustomAddress;
  }

  async submitSend() {
    this.sending.set(true);
    this.lastResult.set(null);
    try {
      const payload: Record<string, any> = {
        eventType: this.composeEventType,
        channel: this.composeChannel,
        templateId: this.composeTemplateId || undefined,
        subject: this.composeTemplateId ? undefined : this.composeSubject,
        body: this.composeTemplateId ? undefined : this.composeBody,
        variables: this.composeVariables,
      };
      if (this.composeRecipientMode === 'student') {
        payload['recipientType'] = 'student';
        payload['studentId'] = this.composeStudentId;
      } else {
        payload['recipientType'] = 'custom';
        payload['name'] = this.composeCustomName;
        payload['address'] = this.composeCustomAddress;
      }
      const result = await this.comms.send(payload);
      this.lastResult.set(result);
      if (result.status === 'sent') {
        this.toast.success('Message sent.');
        this.loadLogs();
      } else {
        this.toast.error(result.error ?? 'Send failed.');
      }
    } catch (e: any) {
      this.toast.error(e.message ?? 'Send failed.');
    } finally {
      this.sending.set(false);
    }
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  startNewTemplate() { this.templateForm = { eventType: '', channel: '', name: '', subject: '', body: '' }; }
  editTemplate(t: CommTemplate) { this.templateForm = { id: t.id, eventType: t.eventType, channel: t.channel, name: t.name, subject: t.subject, body: t.body }; }

  async saveTemplate() {
    const f = this.templateForm!;
    if (!f.eventType || !f.channel || !f.name || !f.body) { this.toast.error('Event, channel, name, and body are required.'); return; }
    try {
      if (f.id) {
        await this.comms.updateTemplate(f.id, f as unknown as Partial<CommTemplate>);
        this.toast.success('Template updated.');
      } else {
        await this.comms.createTemplate(f as unknown as Partial<CommTemplate>);
        this.toast.success('Template created.');
      }
      this.templateForm = null;
      this.comms.templates$().subscribe(t => this.templates.set(t));
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not save template.');
    }
  }

  async removeTemplate(t: CommTemplate) {
    try {
      await this.comms.deleteTemplate(t.id);
      this.templates.update(list => list.filter(x => x.id !== t.id));
      this.toast.success('Template deleted.');
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not delete template.');
    }
  }

  triggerImport() {
    (document.querySelector('input[type=file]') as HTMLInputElement)?.click();
  }

  onImportFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const templates = parsed.templates ?? parsed;
        const result = await this.comms.importTemplates(templates);
        this.toast.success(`Imported ${result.imported}, updated ${result.updated} template(s).`);
        this.comms.templates$().subscribe(t => this.templates.set(t));
      } catch (e: any) {
        this.toast.error(e.message ?? 'Could not import — check the JSON matches the expected shape.');
      }
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }

  async exportTemplates() {
    try {
      const { templates } = await this.comms.exportTemplates();
      const blob = new Blob([JSON.stringify({ templates }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'communication-templates.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not export templates.');
    }
  }

  // ── History ────────────────────────────────────────────────────────────────
  loadLogs() {
    this.comms.logs$({
      eventType: this.historyEventType || undefined,
      channel: this.historyChannel || undefined,
      status: this.historyStatus || undefined,
    } as any).subscribe(l => this.logs.set(l));
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────
  async createCampaign() {
    try {
      await this.comms.createCampaign({
        type: this.campType, channel: this.campChannel as any, templateId: this.campTemplateId,
        name: this.campName,
        audienceFilter: { role: 'parent', ...(this.campDisciplineId ? { disciplineId: +this.campDisciplineId } : {}) },
        ...(this.campBranchId ? { branchId: this.campBranchId as any } : {}),
      });
      this.toast.success('Campaign draft created.');
      this.campName = ''; this.campTemplateId = '';
      this.comms.campaigns$().subscribe(c => this.campaigns.set(c));
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not create campaign.');
    }
  }

  async sendCampaign(c: CommCampaign) {
    try {
      await this.comms.sendCampaign(c.id);
      this.toast.success(`Campaign sent to ${c.totalRecipients} recipient(s).`);
      this.comms.campaigns$().subscribe(list => this.campaigns.set(list));
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not send campaign.');
    }
  }

  async removeCampaign(c: CommCampaign) {
    try {
      await this.comms.deleteCampaign(c.id);
      this.campaigns.update(list => list.filter(x => x.id !== c.id));
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not delete campaign.');
    }
  }

  // ── Providers ──────────────────────────────────────────────────────────────
  async saveProvider(p: CommProviderConfig) {
    try {
      await this.comms.updateProvider(p.channel, p.provider, p.config);
      this.toast.success(`${this.channelLabel(p.channel)} provider updated.`);
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not update provider.');
    }
  }
}
