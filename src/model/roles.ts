export type RoleKey = 'admin' | 'auditor' | 'approver' | 'contributor' | 'reader';

export interface RoleDefinition {
  key: RoleKey;
  /** Role name as stored in the API's roles table. */
  apiName: string;
  label: string;
  summary: string;
  capabilities: string[];
  /** false = accounts are provisioned by Mavhu, so no sign-up screen exists for the role. */
  selfSignUp: boolean;
}

export const ROLES: RoleDefinition[] = [
  {
    key: 'admin',
    apiName: 'MAVHU_ADMIN',
    label: 'Mavhu Admin',
    summary: 'Mavhu Africa platform administrators managing clients, banks and access.',
    capabilities: ['Manage banks, customers and estates', 'Provision auditor and client accounts', 'Oversee platform-wide data'],
    selfSignUp: false,
  },
  {
    key: 'auditor',
    apiName: 'AUDITOR',
    label: 'Auditor',
    summary: 'Independent assurance with read access across all client data.',
    capabilities: ['View all emissions and satellite data', 'Review audit trails', 'Verify approved submissions'],
    selfSignUp: false,
  },
  {
    key: 'approver',
    apiName: 'ESG_APPROVER',
    label: 'ESG Approver',
    summary: 'Managers who review and approve submitted ESG data.',
    capabilities: ['Approve or reject emissions entries', 'Review contributor submissions', 'View ESG reports'],
    selfSignUp: true,
  },
  {
    key: 'contributor',
    apiName: 'ESG_CONTRIBUTOR',
    label: 'ESG Contributor',
    summary: 'Capture and submit emissions and ESG metrics for your estates.',
    capabilities: ['Record emissions activity data', 'Manage crop cycles', 'Submit data for approval'],
    selfSignUp: true,
  },
  {
    key: 'reader',
    apiName: 'ESG_READER',
    label: 'ESG Reader',
    summary: 'Read-only access to ESG metrics and reports.',
    capabilities: ['View ESG metrics', 'Browse emissions reports', 'Track carbon stock trends'],
    selfSignUp: true,
  },
];

export function findRole(key: string | undefined): RoleDefinition | undefined {
  return ROLES.find((role) => role.key === key);
}

export function findRoleByApiName(apiName: string): RoleDefinition | undefined {
  return ROLES.find((role) => role.apiName === apiName);
}
