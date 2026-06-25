import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dojo-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-wrap" [class.loading-overlay]="overlay">
      <div class="spinner"></div>
      <div *ngIf="label" class="loading-label">{{ label }}</div>
    </div>
  `,
  styles: [`
    .loading-wrap { display:flex; flex-direction:column; align-items:center;
                    justify-content:center; padding:32px; gap:12px; }
    .loading-overlay { position:absolute; inset:0; background:rgba(0,0,0,.4);
                       z-index:100; border-radius:inherit; }
    .spinner { width:36px; height:36px; border:3px solid var(--border);
               border-top-color:var(--accent); border-radius:50%;
               animation:spin .7s linear infinite; }
    .loading-label { font-size:14px; color:var(--text-muted); }
    @keyframes spin { to { transform:rotate(360deg); } }
  `]
})
export class LoadingComponent {
  @Input() label?: string;
  @Input() overlay = false;
}
