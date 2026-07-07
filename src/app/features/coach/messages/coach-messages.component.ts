import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from '../../../core/services/message.service';
import { StudentService } from '../../../core/services/student.service';
import { MessageThread, Message, Student } from '../../../core/models';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-coach-messages',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule,
            PageHeaderComponent, AvatarComponent, EmptyStateComponent, TimeAgoPipe, IconComponent],
  template: `
    <dojo-page-header title="Messages" subtitle="Parent–coach communication"></dojo-page-header>

    <div class="messages-layout">
      <!-- Thread list -->
      <div class="thread-list card">
        <div class="card__header">
          <span class="card__title">Conversations</span>
          <button class="btn btn--primary btn--sm" (click)="showNewThread.set(true)">+ New</button>
        </div>

        <!-- New thread form -->
        <div *ngIf="showNewThread()" style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <select class="select mb-2" [(ngModel)]="newThreadStudentId">
            <option value="">Select student…</option>
            <option *ngFor="let s of students$ | async" [value]="s.id">
              {{ s.firstName }} {{ s.lastName }}
            </option>
          </select>
          <div style="display:flex;gap:6px">
            <button class="btn btn--primary btn--sm btn--full" (click)="createThread()">Start</button>
            <button class="btn btn--secondary btn--sm" (click)="showNewThread.set(false)"><dojo-icon name="close" [size]="14"></dojo-icon></button>
          </div>
        </div>

        <div *ngIf="threads$ | async as threads">
          <dojo-empty-state *ngIf="threads.length === 0" icon="message" title="No conversations yet"
            subtitle="Start a conversation with a parent."></dojo-empty-state>
          <div *ngFor="let t of threads"
            class="thread-item" [class.active]="activeThread()?.id === t.id"
            (click)="openThread(t)">
            <dojo-avatar [name]="t.studentId" size="sm"></dojo-avatar>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px">Student: {{ t.studentId }}</div>
              <div class="text-muted text-sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ t.lastMessage || 'No messages yet' }}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div class="text-dim text-sm">{{ t.lastAt | timeAgo }}</div>
              <span *ngIf="t.unreadCoach > 0" class="badge badge--danger">{{ t.unreadCoach }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Message pane -->
      <div class="message-pane card">
        <ng-container *ngIf="activeThread(); else noThread">
          <div class="card__header">
            <span class="card__title">Conversation</span>
          </div>
          <div class="messages-scroll" #scrollRef>
            <ng-container *ngIf="messages$ | async as msgs">
              <dojo-empty-state *ngIf="msgs.length === 0" icon="message" title="No messages yet"
                subtitle="Say hello to the parent!"></dojo-empty-state>
              <div *ngFor="let m of msgs" class="msg-bubble-wrap" [class.mine]="m.fromUid === myUid()">
                <div class="msg-bubble">
                  <div class="msg-sender">{{ m.fromName }}</div>
                  <div class="msg-text">{{ m.text }}</div>
                  <div class="msg-time">{{ m.sentAt | timeAgo }}</div>
                </div>
              </div>
            </ng-container>
          </div>
          <div class="message-input">
            <textarea class="textarea" rows="2" [(ngModel)]="messageText"
              placeholder="Write a message… (Enter to send)"
              (keydown.enter)="$event.preventDefault(); sendMessage()"></textarea>
            <button class="btn btn--primary" (click)="sendMessage()" [disabled]="!messageText.trim()">
              Send →
            </button>
          </div>
        </ng-container>
        <ng-template #noThread>
          <dojo-empty-state icon="message" title="Select a conversation"
            subtitle="Choose a thread from the left to start messaging.">
          </dojo-empty-state>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .messages-layout { display:grid; grid-template-columns:300px 1fr; gap:16px; height:calc(100vh - 200px); }
    .thread-list     { overflow-y:auto; }
    .thread-item     { display:flex; align-items:center; gap:10px; padding:12px 16px;
                       border-bottom:1px solid var(--border); cursor:pointer; transition:background .15s;
                       &:hover, &.active { background:var(--surface-2); } }
    .message-pane    { display:flex; flex-direction:column; overflow:hidden; }
    .messages-scroll { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px; }
    .msg-bubble-wrap { display:flex; &.mine { justify-content:flex-end; } }
    .msg-bubble      { max-width:70%; background:var(--surface-2); border-radius:12px;
                       padding:10px 14px; }
    .mine .msg-bubble{ background:var(--accent-dim); }
    .msg-sender      { font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:4px; }
    .msg-text        { font-size:14px; line-height:1.5; }
    .msg-time        { font-size:11px; color:var(--text-dim); margin-top:4px; text-align:right; }
    .message-input   { padding:12px 16px; border-top:1px solid var(--border);
                       display:flex; gap:8px; align-items:flex-end; }
    .message-input textarea { flex:1; }
    @media (max-width:768px) { .messages-layout { grid-template-columns:1fr; } }
  `]
})
export class CoachMessagesComponent implements OnInit {
  private auth  = inject(AuthService);
  private ms    = inject(MessageService);
  private sts   = inject(StudentService);
  private toast = inject(ToastService);

  threads$!:  Observable<MessageThread[]>;
  messages$?: Observable<Message[]>;
  students$!: Observable<Student[]>;

  activeThread     = signal<MessageThread | null>(null);
  showNewThread    = signal(false);
  newThreadStudentId = '';
  messageText      = '';
  myUid = () => this.auth.currentUser()?.uid ?? '';

  ngOnInit() {
    const user = this.auth.currentUser()!;
    this.threads$  = this.ms.threadsForCoach$(user.uid);
    this.students$ = this.sts.byDojo$(user.dojoId);
  }

  openThread(t: MessageThread) {
    this.activeThread.set(t);
    this.messages$ = this.ms.messages$(t.id);
    this.ms.markRead(t.id, 'coach').catch(() => {});
  }

  async createThread() {
    if (!this.newThreadStudentId) return;
    const user = this.auth.currentUser()!;
    try {
      await this.ms.create({
        dojoId: user.dojoId, studentId: this.newThreadStudentId,
        parentUid: 'pending', coachUid: user.uid,
        unreadParent: 0, unreadCoach: 0,
      });
      this.showNewThread.set(false);
      this.newThreadStudentId = '';
    } catch (e: any) {
      this.toast.error(e.message ?? 'Could not start conversation.');
    }
  }

  async sendMessage() {
    const t = this.activeThread();
    if (!t || !this.messageText.trim()) return;
    const user = this.auth.currentUser()!;
    const text = this.messageText.trim();
    try {
      await this.ms.send(t.id, {
        threadId: t.id, fromUid: user.uid,
        fromName: user.displayName, fromRole: 'coach',
        text, sentAt: new Date() as any,
      });
      this.messageText = '';
    } catch (e: any) {
      this.toast.error(e.message ?? 'Message failed to send. Try again.');
    }
  }
}
