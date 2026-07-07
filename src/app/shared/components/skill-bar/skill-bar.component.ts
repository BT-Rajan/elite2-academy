import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dojo-skill-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skill-row">
      <div class="skill-label">{{ label }}</div>
      <div class="skill-track">
        <div class="skill-fill" [style.width.%]="(score/10)*100" [style.background]="color"></div>
      </div>
      <div class="skill-score">{{ score }}/10</div>
    </div>
  `,
  styles: [`
    .skill-row   { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
    .skill-label { width:90px; font-size:13px; color:var(--text-muted); flex-shrink:0; }
    .skill-track { flex:1; height:8px; background:var(--surface-2); border-radius:4px; overflow:hidden; }
    .skill-fill  { height:100%; border-radius:4px; transition:width .4s ease; }
    .skill-score { width:36px; font-size:12px; font-weight:600; color:var(--text); text-align:right; }
  `]
})
export class SkillBarComponent {
  @Input() label = '';
  @Input() score = 0;
  @Input() color = 'var(--info)';
}
