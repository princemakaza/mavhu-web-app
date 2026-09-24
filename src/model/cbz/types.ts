// Domain types for the CBZ ESG platform. Field names mirror the RFP data dictionary
// (entityId / period / metricCode / value / unit / method / dataQuality / sourceRef / status)
// so the same records can be posted to the real REST API later without renaming.

export type EntityCode =
  | 'CBZBANK'
  | 'CBZCAP'
  | 'DATVEST'
  | 'CBZAGRO'
  | 'CBZPROP'
  | 'CBZINS'
  | 'CBZLIFE'
  | 'CBZRISK'
  | 'CBZRED'
  | 'GROUP';

export interface BankEntity {
  code: EntityCode;
  name: string;
  segment: string;
  regulator: string;
  pcafApplicable: string;
  notes: string;
}

export type DepartmentKind =
  | 'Commercial Banking'
  | 'Investment Banking'
  | 'Asset Management'
  | 'Agribusiness'
  | 'Property'
  | 'Short-term Insurance'
  | 'Life Assurance'
  | 'Risk Advisory'
  | 'Microfinance';

export interface Department {
  id: string;
  entityCode: EntityCode;
  name: string;
  kind: DepartmentKind;
  headOfDept: string;
  email: string;
  createdAt: string;
}

export interface Member {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  entityCode: EntityCode;
  departmentId: string | null;
  role: 'admin' | 'contributor' | 'approver' | 'reader' | 'customer';
  createdAt: string;
}

export type AssetClass =
  | 'business_loans_unlisted_equity'
  | 'business_loans_listed'
  | 'project_finance'
  | 'commercial_real_estate'
  | 'mortgages'
  | 'motor_vehicle_loans'
  | 'listed_equity_corporate_bonds'
  | 'sovereign_debt'
  | 'sub_sovereign_debt'
  | 'use_of_proceeds';

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  business_loans_unlisted_equity: 'Business loans & unlisted equity',
  business_loans_listed: 'Business loans — listed borrower',
  project_finance: 'Project finance',
  commercial_real_estate: 'Commercial real estate',
  mortgages: 'Mortgages',
  motor_vehicle_loans: 'Motor vehicle loans',
  listed_equity_corporate_bonds: 'Listed equity & corporate bonds',
  sovereign_debt: 'Sovereign debt',
  sub_sovereign_debt: 'Sub-sovereign debt',
  use_of_proceeds: 'Use of proceeds structures',
};

// Which financial denominator each asset class uses — the core PCAF asset-class-aware trick.
export const ASSET_CLASS_DENOMINATOR: Record<AssetClass, keyof CounterpartyFinancials> = {
  business_loans_unlisted_equity: 'totalEquityDebt',
  business_loans_listed: 'evic',
  project_finance: 'projectTotalCost',
  commercial_real_estate: 'propertyValue',
  mortgages: 'propertyValue',
  motor_vehicle_loans: 'vehicleValue',
  listed_equity_corporate_bonds: 'evic',
  sovereign_debt: 'gdpPpp',
  sub_sovereign_debt: 'regionalGdpPpp',
  use_of_proceeds: 'uopStructureValue',
};

export interface CounterpartyFinancials {
  totalEquityDebt?: number;
  evic?: number;
  projectTotalCost?: number;
  propertyValue?: number;
  vehicleValue?: number;
  gdpPpp?: number;
  regionalGdpPpp?: number;
  uopStructureValue?: number;
  totalRevenue?: number;
}

export interface Counterparty {
  id: string;
  name: string;
  sector: string;
  listedStatus: 'Listed' | 'Unlisted' | 'Sovereign' | 'Sub-sovereign' | 'n/a';
  assetClass: AssetClass;
  subsidiary: EntityCode;
  financials: CounterpartyFinancials;
  totalEmissionsTco2e: number;
  dqScore: 1 | 2 | 3 | 4 | 5;
  mrvEnhanced: boolean;
  createdAt: string;
}

export interface FinancedPosition {
  id: string;
  counterpartyId: string;
  outstandingAmountUsd: number;
  period: string;
  createdAt: string;
}

export type Scope = 'scope1' | 'scope2' | 'scope3';

export interface EmissionRecord {
  id: string;
  entityCode: EntityCode;
  site: string;
  period: string; // e.g. "2026-08" or "2026-Q3"
  scope: Scope;
  datasetType: string; // e.g. "Fleet fuel", "Backup generator", "Cat 1"
  fuelType?: string;
  activityData: number;
  unit: string; // "litres" | "kWh" | "kg" | "tonnes" | "US$" | "m2" | "pax-km" | "employees"
  emissionFactorKgPerUnit: number;
  emissionsKgCo2e: number;
  emissionsTco2e: number;
  method: 'measured' | 'calculated' | 'estimated' | 'spend-based' | 'activity-based';
  dataQuality: 1 | 2 | 3 | 4 | 5;
  status: 'draft' | 'in_review' | 'approved' | 'locked';
  sourceRef: string;
  submittedBy: string;
  submittedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface InsurancePolicy {
  id: string;
  segment:
    | 'Commercial lines'
    | 'Personal motor - individual data'
    | 'Personal motor - PCAF fallback factor'
    | 'Project insurance'
    | 'Treaty reinsurance';
  subsidiary: EntityCode;
  clientId: string;
  clientName: string;
  sector: string;
  grossWrittenPremiumUsd: number;
  denominatorType: string;
  denominatorValueUsd: number | null;
  clientTotalEmissions: number;
  attributionFactor: number;
  insuranceAssociatedEmissions: number;
  dqScore: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}

export interface FinancialInclusionRecord {
  id: string;
  subsidiary: EntityCode;
  programme: string;
  beneficiaryCount: number;
  femaleShare: number;
  totalDisbursedUsd: number;
  geography: string;
  sdgAlignment: string;
  repaymentRate: number;
  period: string;
}

export interface WorkforceRecord {
  id: string;
  subsidiary: EntityCode;
  period: string;
  headcount: number;
  femaleShare: number;
  avgTrainingHours: number;
  ltiRate: number;
  voluntaryTurnover: number;
  localHireShare: number;
}

export interface Incident {
  id: string;
  subsidiary: EntityCode;
  dateReported: string;
  category: 'Environmental' | 'Social' | 'Governance' | 'Compliance';
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Closed';
  correctiveAction: string;
  closureDate: string | null;
}

export interface RiskEntry {
  id: string;
  title: string;
  category: 'Physical' | 'Transition' | 'Liability' | 'Opportunity';
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  owner: string;
  status: 'Identified' | 'Mitigating' | 'Monitoring' | 'Closed';
  linkedEntity: EntityCode | 'GROUP';
}

export interface GeospatialRecord {
  id: string;
  linkedBorrowerName: string;
  subsidiary: EntityCode;
  district: string;
  coordinates: string;
  passDate: string;
  dataSource: 'Sentinel-2' | 'Landsat-9' | 'MODIS';
  ndvi: number | null;
  landUse: string;
  areaHa: number;
  deforestationFlag: 'No' | 'Possible - flagged for review' | 'Confirmed';
  floodRisk: 'Low' | 'Medium' | 'High';
  droughtStress: 'Low' | 'Medium' | 'High';
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityCode: EntityCode | 'GROUP' | null;
  targetType:
    | 'EmissionRecord'
    | 'Counterparty'
    | 'Member'
    | 'Department'
    | 'Workflow'
    | 'InsurancePolicy'
    | 'Incident'
    | 'RiskEntry'
    | 'Bank'
    | 'Auth';
  targetId: string | null;
  detail: string;
}

export interface IngestionBatch {
  id: string;
  fileName: string;
  channel: 'File Ingester (manual upload)' | 'Satellite Data Ingester' | 'Ingestion API (manual)' | 'Manual form entry';
  subsidiary: EntityCode;
  uploadedAt: string;
  recordsProcessed: number;
  validationStatus: 'Success' | 'Partial' | 'Failure';
  errorDetails: string;
  notificationSent: boolean;
}

// Snapshot of the entire persistent store shape.
export interface CbzStoreState {
  entities: BankEntity[];
  departments: Department[];
  members: Member[];
  counterparties: Counterparty[];
  financedPositions: FinancedPosition[];
  emissions: EmissionRecord[];
  insurance: InsurancePolicy[];
  financialInclusion: FinancialInclusionRecord[];
  workforce: WorkforceRecord[];
  incidents: Incident[];
  risks: RiskEntry[];
  geospatial: GeospatialRecord[];
  ingestion: IngestionBatch[];
  audit: AuditEntry[];
}

export interface CbzSession {
  memberId: string;
  fullName: string;
  email: string;
  entityCode: EntityCode; // scopes what the session can see/edit
  role: Member['role'];
  loginAt: string;
}
