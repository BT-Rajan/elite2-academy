import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { initials } from '../../../core/utils';

@Component({
  selector: 'dojo-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="avatar" [class]="'avatar--' + size" [style.background]="bg">
      <img *ngIf="src" [src]="src" [alt]="name">
      <span *ngIf="!src">{{ initials(name) }}</span>
    </div>
  `,
  styles: [`
    .avatar { border-radius: 50%; display:flex; align-items:center; justify-content:center;
              font-weight:600; color:#fff; overflow:hidden; flex-shrink:0; }
    .avatar--xs  { width:28px; height:28px; font-size:11px; }
    .avatar--sm  { width:36px; height:36px; font-size:13px; }
    .avatar--md  { width:48px; height:48px; font-size:16px; }
    .avatar--lg  { width:64px; height:64px; font-size:22px; }
    .avatar--xl  { width:88px; height:88px; font-size:30px; }
    img { width:100%; height:100%; object-fit:cover; }
  `]
})
export class AvatarComponent {
  @Input() name = '';
  @Input() src?: string;
  @Input() size: 'xs'|'sm'|'md'|'lg'|'xl' = 'md';
  @Input() bg = '#3b82f6';
  initials = initials;
}
