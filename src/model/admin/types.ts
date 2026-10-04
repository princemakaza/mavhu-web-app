// Shapes returned by the API's /admin endpoints (MAvHU admin console).

export interface AdminSession {
  token: string;
  userId: number;
  name: string;
  email: string;
}

export type BankStatus = 'onboarding' | 'active' | 'suspended';

export interface BankStats {
  id: number;
  name: string;
  country: string;
  email: string;
  phoneNumber: string | null;
  identifier: string;
  status: BankStatus;
  modules: string[];
  createdAt: string;
  entities: number;
  members: number;
  activeMembers: number;
  emissionRecords: number;
  drafts: number;
  inReview: number;
  signedOff: number;
  operationalTco2e: number;
  avgDataQuality: number | null;
  counterparties: number;
  financedExposureUsd: number;
  openIncidents: number;
  risks: number;
  highRisks: number;
  lockedPeriods: number;
  lastActivity: string | null;
}

export interface Overview {
  totals: {
    banks: number;
    activeBanks: number;
    onboardingBanks: number;
    entities: number;
    members: number;
    activeMembers: number;
    emissionRecords: number;
    inReview: number;
    drafts: number;
    signedOff: number;
    operationalTco2e: number;
    financedExposureUsd: number;
    openIncidents: number;
    highRisks: number;
    lockedPeriods: number;
    mavhuTeam: number;
  };
  banks: BankStats[];
}

export interface AdminEntity {
  code: string;
  bankId: number;
  name: string;
  segment: string;
  regulator: string;
  pcafApplicable: string;
  notes: string;
}

export interface AdminDepartment {
  id: string;
  entityCode: string;
  name: string;
  kind: string;
}

export interface BankDetail {
  id: number;
  name: string;
  country: string;
  email: string;
  phoneNumber: string | null;
  identifier: string;
  status: BankStatus;
  modules: string[];
  entities: AdminEntity[];
  departments: AdminDepartment[];
}

export type MemberRole = 'admin' | 'approver' | 'contributor' | 'reader' | 'auditor' | 'customer';

export interface AdminMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  entityCode: string;
  entityName: string;
  departmentId: string | null;
  role: MemberRole;
  isActive: boolean;
  bankId: number;
  bankName: string;
  createdAt: string;
}

export type TeamRole = 'MAVHU_ADMIN' | 'AUDITOR';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  isDeleted: boolean;
  createdAt: string;
  roles: string[];
}

export interface PeriodRow {
  id: number;
  bankId: number;
  bankName: string;
  period: string;
  status: 'open' | 'locked';
  lockedBy: string | null;
  lockedAt: string | null;
}

export interface AuditRow {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityCode: string | null;
  targetType: string;
  targetId: string | null;
  detail: string;
  bankId: number | null;
  bankName: string;
}

/** Dashboard modules a bank can be licensed for — same keys as the bank dashboard's tabs. */
export const DASHBOARD_MODULES: Array<{ key: string; label: string }> = [
  { key: 'snapshot', label: 'Group snapshot' },
  { key: 'portfolio', label: 'Financed emissions (PCAF A)' },
  { key: 'insurance', label: 'Insurance emissions (PCAF C)' },
  { key: 'risk', label: 'Risk heatmap & register' },
  { key: 'predictive', label: 'Predictive' },
  { key: 'workflow', label: 'Workflow & audit' },
  { key: 'entity', label: 'Entity view' },
  { key: 'data-entry', label: 'Data entry' },
  { key: 'members', label: 'Members & customers' },
];

export const MEMBER_ROLES: Array<{ key: MemberRole; label: string; hint: string }> = [
  { key: 'admin', label: 'Bank admin', hint: 'Everything in their bank, incl. members' },
  { key: 'approver', label: 'Approver', hint: 'Reviews and signs off data' },
  { key: 'contributor', label: 'Contributor', hint: 'Submits data for their subsidiary' },
  { key: 'reader', label: 'Reader', hint: 'Read-only dashboards' },
  { key: 'auditor', label: 'Auditor', hint: 'Read-only assurer (RFP F19/F38)' },
  { key: 'customer', label: 'Customer', hint: 'Borrower self-service data entry' },
];
