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

@Component({
  selector: 'app-parent-messages',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, FormsModule,
            PageHeaderComponent, AvatarComponent, EmptyStateComponent, TimeAgoPipe],
  template: `
    <dojo-page-header title="Messages" subtitle="Talk directly with your child's coach"></dojo-page-header>

    <div class="messages-layout">
      <!-- Thread list -->
      <div class="thread-list card">
        <div class="card__header">
          <span class="card__title">Conversations</span>
          <span *ngIf="totalUnread() > 0" class="badge badge--danger">{{ totalUnread() }} new</span>
        </div>

        <div *ngIf="threads$ | async as threads">
          <dojo-empty-state *ngIf="threads.length === 0"
            icon="💬" title="No conversations yet"
            subtitle="Your coach will start a conversation when they have updates.">
          </dojo-empty-state>

          <div *ngFor="let t of threads"
            class="thread-item" [class.active]="activeThread()?.id === t.id"
            (click)="openThread(t)">
            <dojo-avatar [name]="'Coach'" size="sm"></dojo-avatar>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px">
                {{ childName(t.studentId) }}
              </div>
              <div class="text-muted text-sm"
                style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ t.lastMessage || 'No messages yet' }}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div class="text-dim text-sm">{{ t.lastAt | timeAgo }}</div>
              <span *ngIf="t.unreadParent > 0" class="badge badge--danger">{{ t.unreadParent }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Message pane -->
      <div class="message-pane card">
        <ng-container *ngIf="activeThread(); else noThread">
          <div class="card__header">
            <div>
              <span class="card__title">{{ childName(activeThread()!.studentId) }}</span>
              <div class="text-muted text-sm">Coach conversation</div>
            </div>
          </div>

          <div class="messages-scroll">
            <ng-container *ngIf="messages$ | async as msgs">
              <dojo-empty-state *ngIf="msgs.length === 0"
                icon="👋" title="Start the conversation"
                subtitle="Send a message to your child's coach.">
              </dojo-empty-state>

              <div *ngFor="let m of msgs"
                class="msg-bubble-wrap" [class.mine]="m.fromUid === myUid()">
                <div class="msg-bubble">
                  <div class="msg-sender">
                    {{ m.fromRole === 'parent' ? 'You' : 'Coach ' + m.fromName }}
                  </div>
                  <div class="msg-text">{{ m.text }}</div>
                  <div class="msg-time">{{ m.sentAt | timeAgo }}</div>
                </div>
              </div>
            </ng-container>
          </div>

          <div class="message-input">
            <textarea class="textarea" rows="2" [(ngModel)]="messageText"
              placeholder="Write a message to the coach…"
              (keydown.enter)="$event.preventDefault(); sendMessage()">
            </textarea>
            <button class="btn btn--primary" (click)="sendMessage()"
              [disabled]="!messageText.trim()">
              Send →
            </button>
          </div>
        </ng-container>

        <ng-template #noThread>
          <dojo-empty-state icon="💬"
            title="Select a conversation"
            subtitle="Your conversations with coaches appear on the left.">
          </dojo-empty-state>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .messages-layout { display:grid; grid-template-columns:300px 1fr; gap:16px;
                       height:calc(100vh - 200px); }
    .thread-list     { overflow-y:auto; }
    .thread-item     { display:flex; align-items:center; gap:10px; padding:12px 16px;
                       border-bottom:1px solid var(--border); cursor:pointer;
                       transition:background .15s;
                       &:hover, &.active { background:var(--surface-2); } }
    .message-pane    { display:flex; flex-direction:column; overflow:hidden; }
    .messages-scroll { flex:1; overflow-y:auto; padding:16px;
                       display:flex; flex-direction:column; gap:8px; }
    .msg-bubble-wrap { display:flex; &.mine { justify-content:flex-end; } }
    .msg-bubble      { max-width:70%; background:var(--surface-2);
                       border-radius:12px; padding:10px 14px; }
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
export class ParentMessagesComponent implements OnInit {
  private auth = inject(AuthService);
  private ms   = inject(MessageService);
  private sts  = inject(StudentService);

  threads$!:  Observable<MessageThread[]>;
  messages$?: Observable<Message[]>;

  activeThread  = signal<MessageThread | null>(null);
  messageText   = '';
  myUid         = () => this.auth.currentUser()?.uid ?? '';

  private childNames = new Map<string, string>();
  totalUnread = signal(0);

  ngOnInit() {
    const uid = this.auth.currentUser()!.uid;
    this.threads$ = this.ms.threadsForParent$(uid);

    // Pre-load child names and count unread
    this.sts.byParent$(uid).subscribe(children => {
      children.forEach(c => this.childNames.set(c.id, `${c.firstName} ${c.lastName}`));
    });

    this.threads$.subscribe(threads => {
      this.totalUnread.set(threads.reduce((sum, t) => sum + (t.unreadParent ?? 0), 0));
    });
  }

  childName(studentId: string): string {
    return this.childNames.get(studentId) ?? 'Your child';
  }

  openThread(t: MessageThread) {
    this.activeThread.set(t);
    this.messages$ = this.ms.messages$(t.id);
    this.ms.markRead(t.id, 'parent');
  }

  async sendMessage() {
    const t = this.activeThread();
    if (!t || !this.messageText.trim()) return;
    const user = this.auth.currentUser()!;
    await this.ms.send(t.id, {
      threadId: t.id, fromUid: user.uid,
      fromName: user.displayName, fromRole: 'parent',
      text: this.messageText.trim(), sentAt: new Date() as any,
    });
    this.messageText = '';
  }
}
