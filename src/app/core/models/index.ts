// ─────────────────────────────────────────────────────────────────────────────
//  Central model definitions — import from here everywhere, never re-declare
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'coach' | 'parent' | 'staff';

export type Salutation = 'Mr' | 'Mrs' | 'Ms' | 'Mx' | 'Dr';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  salutation?: Salutation | string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: UserRole;
  isHeadCoach?: boolean;   // coaches only — can overrule evaluations & promotions
  avatarUrl?: string;
  dojoId: string;
  branchId?: string;       // home branch for coach/staff; unset for admin (dojo-wide access)
  createdAt: Date;
}

export interface AccountRecord {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  isActive?: boolean;
  isHeadCoach?: boolean;
  approvedAt?: Date | null;
}

/** @deprecated use AccountRecord */
export type PendingUser = AccountRecord;

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
  branchId: string;
  parentUid: string;
  firstName: string;
  lastName: string;
  dob: Date;
  gender: 'M' | 'F' | 'Other';
  avatarUrl?: string;
  disciplineId: string;
  currentBeltId: string;
  bjjStripes?: number;      // stripes earned toward the current belt
  seminarPoints?: number;   // accumulated toward the current belt's requirement
  enrolledAt: Date;
  mbClientId?: string;
  isActive: boolean;
  // Joined for display — returned by GET /students and /students/:id, not
  // stored on the row itself. Prefer these over disciplineId/currentBeltId
  // whenever showing a student in a list; the raw IDs aren't meaningful to look at.
  beltName?: string;
  colorHex?: string;
  disciplineName?: string;
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
  // Curriculum roadmap fields — used by multi-track programs (e.g. Elita's
  // integrated Kaju + Kickboxing + BJJ + Self-Defense "One Belt, One
  // Stripe, Three Arts" model). Optional so single-track disciplines can
  // leave them unset.
  kickboxingLevel?: string;         // e.g. "Beginner", "Intermediate", "Advanced", "Expert"
  bjjStripeLabel?: string;          // e.g. "1 × White", "Belt is marker", "None"
  seminarPointsRequired?: number;
  syllabus?: CurriculumSyllabusItem[];
}

export type CurriculumTrack = 'striking' | 'grappling' | 'selfdefense';

export interface CurriculumSyllabusItem {
  id: string;
  beltId: string;
  track: CurriculumTrack;
  title: string;
  description?: string;
  sortOrder: number;
}

export interface BeltHistory {
  id: string;
  studentId: string;
  beltId?: string;
  beltName: string;
  awardedBy: string;   // coach uid
  awardedAt: Date;
  notes?: string;
}

export type EvaluationResult = 'pass' | 'fail';

export interface StudentEvaluation {
  id: string;
  studentId: string;
  beltId: string;
  beltName?: string;
  track: CurriculumTrack;
  result: EvaluationResult;
  notes?: string;
  coachUid: string;
  coachName: string;
  evaluatedAt: Date;
  overruledBy?: string;
  overruledByName?: string;
  overruleResult?: EvaluationResult;
  overruleNotes?: string;
  overruledAt?: Date;
}

export interface TrackReadiness {
  evaluation: StudentEvaluation | null;
  effectiveResult: EvaluationResult | null;
}

export interface PromotionReadiness {
  isReady: boolean;
  tracks: Record<CurriculumTrack, TrackReadiness>;
  seminarPoints: number;
  seminarPointsRequired: number;
  bjjStripes: number;
  bjjStripesRequired: number;
  bjjStripeLabel?: string;
  currentBelt: Belt;
}

export interface SeminarPointsLogEntry {
  id: string;
  studentId: string;
  points: number;
  reason: string;
  awardedBy: string;
  awardedByName: string;
  awardedAt: Date;
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

// ─────────────────────────────────────────────────────────────────────────────
//  Branches (multi-location support)
// ─────────────────────────────────────────────────────────────────────────────
export interface Branch {
  id: string;
  dojoId: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Communication Layer — WhatsApp / SMS / Email integration
// ─────────────────────────────────────────────────────────────────────────────
export type CommEventType =
  | 'admission' | 'attendance' | 'evaluation' | 'promotion' | 'announcement'
  | 'otp' | 'email_campaign' | 'newsletter' | 'marketing_promo' | 'parent_engagement' | 'report';

export type CommChannel = 'whatsapp' | 'sms' | 'email' | 'chat';

export interface CommEventCatalogEntry {
  value: CommEventType;
  label: string;
  channels: CommChannel[];
}

export interface CommTemplate {
  id: string;
  dojoId: string;
  eventType: CommEventType;
  channel: CommChannel;
  name: string;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CommLogStatus = 'queued' | 'sent' | 'failed';
export type CommRecipientType = 'student' | 'parent' | 'user' | 'custom';

export interface CommLog {
  id: string;
  dojoId: string;
  branchId?: string;
  eventType: CommEventType;
  channel: CommChannel;
  templateId?: string;
  campaignId?: string;
  recipientType: CommRecipientType;
  recipientRef?: string;
  recipientName?: string;
  recipientAddress: string;
  subject?: string;
  body: string;
  status: CommLogStatus;
  provider?: string;
  providerMessageId?: string;
  error?: string;
  sentBy: string;
  sentAt?: Date;
  createdAt: Date;
}

export type CommCampaignType = 'email_campaign' | 'newsletter' | 'marketing_promo';
export type CommCampaignStatus = 'draft' | 'sending' | 'sent' | 'failed';

export interface CommCampaignRecipient {
  id: string;
  campaignId: string;
  parentUid?: string;
  recipientName?: string;
  recipientAddress: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  sentAt?: Date;
}

export interface CommCampaign {
  id: string;
  dojoId: string;
  branchId?: string;
  type: CommCampaignType;
  channel: 'email' | 'whatsapp';
  templateId: string;
  name: string;
  audienceFilter: { role?: string; branchId?: number; disciplineId?: number };
  status: CommCampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: Date;
  sentAt?: Date;
  recipients?: CommCampaignRecipient[];
}

export interface CommProviderConfig {
  channel: 'whatsapp' | 'sms' | 'email';
  provider: string;
  config: Record<string, string>;
  isActive: boolean;
  available: string[];
}
