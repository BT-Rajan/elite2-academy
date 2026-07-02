// ─────────────────────────────────────────────────────────────────────────────
//  Central model definitions — import from here everywhere, never re-declare
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'coach' | 'parent' | 'staff';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string;
  dojoId: string;
  createdAt: Date;
}

export interface Dojo {
  id: string;
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone: string;
  createdAt: Date;
}

export interface Student {
  id: string;
  dojoId: string;
  parentUid: string;
  firstName: string;
  lastName: string;
  dob: Date;
  gender: 'M' | 'F' | 'Other';
  avatarUrl?: string;
  disciplineId: string;
  currentBeltId: string;
  enrolledAt: Date;
  mbClientId?: string;
  isActive: boolean;
}

export interface Discipline {
  id: string;
  dojoId: string;
  name: string;
  description?: string;
  color: string;
}

export interface Belt {
  id: string;
  disciplineId: string;
  name: string;
  colorHex: string;
  sortOrder: number;
  minClasses: number;
  minScore: number;
}

export interface BeltHistory {
  id: string;
  studentId: string;
  beltId: string;
  beltName: string;
  awardedBy: string;   // coach uid
  awardedAt: Date;
  notes?: string;
}

export type SkillKey = 'technique' | 'fitness' | 'discipline' | 'focus' | 'attitude' | 'balance' | 'reflex' | 'speed' | 'flexibility';

export type SkillScores = Record<SkillKey, number>;   // 1–10

export interface SessionComment {
  id: string;
  sessionId: string;
  studentId: string;
  coachUid: string;
  coachName: string;
  comment: string;
  skills: Partial<SkillScores>;
  createdAt: Date;
}

export interface ClassSession {
  id: string;
  dojoId: string;
  classId: string;
  className: string;
  disciplineId: string;
  coachUid: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  isClosed: boolean;
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  markedBy: string;   // coach uid
  markedAt: Date;
}

export interface ClassSchedule {
  id: string;
  dojoId: string;
  name: string;
  disciplineId: string;
  coachUid: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  location: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  threadId: string;
  fromUid: string;
  fromName: string;
  fromRole: UserRole;
  text: string;
  sentAt: Date;
  readAt?: Date;
}

export interface MessageThread {
  id: string;
  dojoId: string;
  studentId: string;
  parentUid: string;
  coachUid: string;
  lastMessage?: string;
  lastAt?: Date;
  unreadParent: number;
  unreadCoach: number;
}

export interface LoyaltyAccount {
  id: string;           // parentUid
  dojoId: string;
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimePoints: number;
}

export type LoyaltyReason = 'attendance' | 'renewal' | 'referral' | 'promotion' | 'manual' | 'redemption';

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  amount: number;        // positive = earn, negative = redeem
  reason: LoyaltyReason;
  note?: string;
  createdAt: Date;
}

export interface LoyaltyReward {
  id: string;
  dojoId: string;
  name: string;
  description: string;
  pointsCost: number;
  type: 'discount' | 'free_class' | 'merchandise' | 'custom';
  discountPct?: number;
  isActive: boolean;
}

export interface Notification {
  id: string;
  uid: string;
  type: 'message' | 'attendance' | 'belt' | 'loyalty' | 'system';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
  link?: string;
}

export interface StudentObjective {
  id: string;
  studentId: string;
  beltId: string;
  description: string;
  isComplete: boolean;
  completedAt?: Date;
  setBy: string;   // coach uid
}
