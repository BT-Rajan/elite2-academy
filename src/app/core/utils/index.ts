import { SkillKey } from '../models';

export const SKILL_LABELS: Record<SkillKey, string> = {
  technique:   'Technique',
  fitness:     'Fitness',
  discipline:  'Discipline',
  focus:       'Focus',
  attitude:    'Attitude',
  balance:     'Balance',
  reflex:      'Reflex',
  speed:       'Speed',
  flexibility: 'Flexibility',
};

export const SKILL_KEYS: SkillKey[] = Object.keys(SKILL_LABELS) as SkillKey[];

export const BELT_COLORS: Record<string, string> = {
  white: '#ffffff', yellow: '#fbbf24', orange: '#f97316',
  green: '#22c55e', blue: '#3b82f6', purple: '#a855f7',
  brown: '#92400e', red: '#ef4444', black: '#1f2937',
};

export const ATTENDANCE_LABELS: Record<string, { label: string; color: string }> = {
  present: { label: 'Present',  color: '#3f8f5c' },
  late:    { label: 'Late',     color: '#c17a2b' },
  excused: { label: 'Excused',  color: '#4a7a9c' },
  absent:  { label: 'Absent',   color: '#b4433b' },
};

export const LOYALTY_TIER_COLORS: Record<string, string> = {
  bronze:   '#cd7f32',
  silver:   '#c0c0c0',
  gold:     '#ffd700',
  platinum: '#e5e4e2',
};

export function calcAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function avgScore(skills: Partial<Record<SkillKey, number>>): number {
  const vals = Object.values(skills).filter((v): v is number => typeof v === 'number');
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
}
