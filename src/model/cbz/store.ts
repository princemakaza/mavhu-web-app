// LocalStorage-backed persistent store for the CBZ demo dashboard.
// This stands in for a REST API + Postgres schema in the demo: every read/write
// hits localStorage, but the surface (getEntities, addMember, etc.) is close to
// what the production API will expose so screens don't need rewriting later.

import { SEED } from './seed';
import type {
  AuditEntry,
  BankEntity,
  CbzStoreState,
  Counterparty,
  Department,
  EmissionRecord,
  FinancedPosition,
  IngestionBatch,
  InsurancePolicy,
  Member,
  RiskEntry,
} from './types';

const STORE_KEY = 'cbz.dashboard.store.v1';

type Listener = () => void;

function loadFromStorage(): CbzStoreState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(SEED);
    const parsed = JSON.parse(raw) as CbzStoreState;
    // If the schema on disk is missing any collection we've since added, fall
    // back to seed for that slice — cheap forward-compat without a migration.
    return {
      entities: parsed.entities?.length ? parsed.entities : SEED.entities,
      departments: parsed.departments ?? SEED.departments,
      members: parsed.members ?? SEED.members,
      counterparties: parsed.counterparties ?? SEED.counterparties,
      financedPositions: parsed.financedPositions ?? SEED.financedPositions,
      emissions: parsed.emissions ?? SEED.emissions,
      insurance: parsed.insurance ?? SEED.insurance,
      financialInclusion: parsed.financialInclusion ?? SEED.financialInclusion,
      workforce: parsed.workforce ?? SEED.workforce,
      incidents: parsed.incidents ?? SEED.incidents,
      risks: parsed.risks ?? SEED.risks,
      geospatial: parsed.geospatial ?? SEED.geospatial,
      ingestion: parsed.ingestion ?? SEED.ingestion,
      audit: parsed.audit ?? SEED.audit,
    };
  } catch {
    return structuredClone(SEED);
  }
}

class CbzStore {
  private state: CbzStoreState = loadFromStorage();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): CbzStoreState {
    return this.state;
  }

  reset(): void {
    this.state = structuredClone(SEED);
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch {
      // storage full or unavailable — keep in-memory copy only for this tab
    }
    this.listeners.forEach((listener) => listener());
  }

  private now(): string {
    return new Date().toISOString();
  }

  private nextId(prefix: string, collection: { id: string }[]): string {
    let max = 0;
    for (const item of collection) {
      const digits = item.id.replace(prefix, '').replace(/[^0-9]/g, '');
      const n = Number.parseInt(digits, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }

  private appendAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'> & { timestamp?: string }): void {
    const audit: AuditEntry = {
      id: this.nextId('AUDIT', this.state.audit),
      timestamp: entry.timestamp ?? this.now(),
      ...entry,
    };
    this.state.audit = [audit, ...this.state.audit];
  }

  // ---- Entities ----------------------------------------------------------
  addEntity(entity: BankEntity, actor: string): BankEntity {
    if (this.state.entities.some((e) => e.code === entity.code)) {
      throw new Error(`Entity code "${entity.code}" already exists.`);
    }
    this.state.entities = [...this.state.entities, entity];
    this.appendAudit({
      actor,
      action: 'CREATE_ENTITY',
      entityCode: entity.code,
      targetType: 'Bank',
      targetId: entity.code,
      detail: `Onboarded new subsidiary ${entity.name} (${entity.code})`,
    });
    this.persist();
    return entity;
  }

  // ---- Departments -------------------------------------------------------
  addDepartment(input: Omit<Department, 'id' | 'createdAt'>, actor: string): Department {
    const dept: Department = {
      id: this.nextId('DEPT', this.state.departments),
      createdAt: this.now(),
      ...input,
    };
    this.state.departments = [...this.state.departments, dept];
    this.appendAudit({
      actor,
      action: 'CREATE_DEPARTMENT',
      entityCode: dept.entityCode,
      targetType: 'Department',
      targetId: dept.id,
      detail: `Created department "${dept.name}" (${dept.kind}) under ${dept.entityCode}`,
    });
    this.persist();
    return dept;
  }

  // ---- Members -----------------------------------------------------------
  addMember(input: Omit<Member, 'id' | 'createdAt'>, actor: string): Member {
    if (this.state.members.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error(`A member with email ${input.email} already exists.`);
    }
    const member: Member = {
      id: this.nextId('USR', this.state.members),
      createdAt: this.now(),
      ...input,
    };
    this.state.members = [...this.state.members, member];
    this.appendAudit({
      actor,
      action: 'CREATE_MEMBER',
      entityCode: member.entityCode,
      targetType: 'Member',
      targetId: member.id,
      detail: `Onboarded ${member.role} ${member.fullName} to ${member.entityCode}`,
    });
    this.persist();
    return member;
  }

  // ---- Counterparties ----------------------------------------------------
  addCounterparty(input: Omit<Counterparty, 'id' | 'createdAt'>, actor: string): Counterparty {
    const cp: Counterparty = {
      id: this.nextId('CP', this.state.counterparties),
      createdAt: this.now(),
      ...input,
    };
    this.state.counterparties = [...this.state.counterparties, cp];
    this.appendAudit({
      actor,
      action: 'CREATE_COUNTERPARTY',
      entityCode: cp.subsidiary,
      targetType: 'Counterparty',
      targetId: cp.id,
      detail: `Registered counterparty ${cp.name} (${cp.assetClass}) under ${cp.subsidiary}`,
    });
    this.persist();
    return cp;
  }

  // ---- Financed positions ------------------------------------------------
  addFinancedPosition(input: Omit<FinancedPosition, 'id' | 'createdAt'>, actor: string): FinancedPosition {
    const pos: FinancedPosition = {
      id: this.nextId('FE', this.state.financedPositions),
      createdAt: this.now(),
      ...input,
    };
    this.state.financedPositions = [...this.state.financedPositions, pos];
    const cp = this.state.counterparties.find((c) => c.id === pos.counterpartyId);
    this.appendAudit({
      actor,
      action: 'CREATE_POSITION',
      entityCode: cp?.subsidiary ?? null,
      targetType: 'Counterparty',
      targetId: pos.counterpartyId,
      detail: `Added financed position ${pos.id}: US$${pos.outstandingAmountUsd.toLocaleString()} outstanding vs ${cp?.name ?? 'unknown counterparty'}`,
    });
    this.persist();
    return pos;
  }

  // ---- Emissions ---------------------------------------------------------
  addEmission(input: Omit<EmissionRecord, 'id' | 'submittedAt' | 'approvedAt' | 'approvedBy' | 'status'> & {
    status?: EmissionRecord['status'];
  }, actor: string): EmissionRecord {
    const record: EmissionRecord = {
      id: this.nextId(input.scope === 'scope1' ? 'S1' : input.scope === 'scope2' ? 'S2' : 'S3', this.state.emissions.filter((e) => e.scope === input.scope)),
      submittedAt: this.now(),
      approvedBy: null,
      approvedAt: null,
      status: input.status ?? 'draft',
      ...input,
    };
    this.state.emissions = [...this.state.emissions, record];
    this.appendAudit({
      actor,
      action: 'CREATE_EMISSION',
      entityCode: record.entityCode,
      targetType: 'EmissionRecord',
      targetId: record.id,
      detail: `Logged ${record.scope} ${record.datasetType} for ${record.entityCode}/${record.site} (${record.period}): ${record.emissionsTco2e.toFixed(3)} tCO2e`,
    });
    this.persist();
    return record;
  }

  advanceEmissionStatus(id: string, actor: string): EmissionRecord | null {
    const record = this.state.emissions.find((e) => e.id === id);
    if (!record) return null;
    const flow: EmissionRecord['status'][] = ['draft', 'in_review', 'approved', 'locked'];
    const idx = flow.indexOf(record.status);
    if (idx < 0 || idx === flow.length - 1) return record;
    const nextStatus = flow[idx + 1];
    const updated: EmissionRecord = {
      ...record,
      status: nextStatus,
      approvedBy: nextStatus === 'approved' || nextStatus === 'locked' ? actor : record.approvedBy,
      approvedAt: nextStatus === 'approved' || nextStatus === 'locked' ? this.now() : record.approvedAt,
    };
    this.state.emissions = this.state.emissions.map((e) => (e.id === id ? updated : e));
    this.appendAudit({
      actor,
      action: `WORKFLOW_${nextStatus.toUpperCase()}`,
      entityCode: record.entityCode,
      targetType: 'Workflow',
      targetId: id,
      detail: `Advanced ${id} from ${record.status} → ${nextStatus}`,
    });
    this.persist();
    return updated;
  }

  // ---- Ingestion batches -------------------------------------------------
  addIngestionBatch(input: Omit<IngestionBatch, 'id' | 'uploadedAt'>, actor: string): IngestionBatch {
    const batch: IngestionBatch = {
      id: this.nextId('BATCH', this.state.ingestion),
      uploadedAt: this.now(),
      ...input,
    };
    this.state.ingestion = [batch, ...this.state.ingestion];
    this.appendAudit({
      actor,
      action: 'INGEST',
      entityCode: batch.subsidiary,
      targetType: 'EmissionRecord',
      targetId: batch.id,
      detail: `Ingested "${batch.fileName}" via ${batch.channel} — ${batch.recordsProcessed} records, status ${batch.validationStatus}`,
    });
    this.persist();
    return batch;
  }

  // ---- Insurance ---------------------------------------------------------
  addInsurance(input: Omit<InsurancePolicy, 'id' | 'createdAt' | 'attributionFactor' | 'insuranceAssociatedEmissions'>, actor: string): InsurancePolicy {
    const attributionFactor = input.denominatorValueUsd
      ? input.grossWrittenPremiumUsd / input.denominatorValueUsd
      : 0.0699; // PCAF Part C fallback
    const insuranceAssociatedEmissions = attributionFactor * input.clientTotalEmissions;
    const policy: InsurancePolicy = {
      id: this.nextId('IE', this.state.insurance),
      createdAt: this.now(),
      attributionFactor,
      insuranceAssociatedEmissions,
      ...input,
    };
    this.state.insurance = [...this.state.insurance, policy];
    this.appendAudit({
      actor,
      action: 'CREATE_INSURANCE',
      entityCode: policy.subsidiary,
      targetType: 'InsurancePolicy',
      targetId: policy.id,
      detail: `Bound insurance policy ${policy.id} for ${policy.clientName} — ${policy.insuranceAssociatedEmissions.toFixed(2)} tCO2e attributed`,
    });
    this.persist();
    return policy;
  }

  // ---- Risks -------------------------------------------------------------
  addRisk(input: Omit<RiskEntry, 'id'>, actor: string): RiskEntry {
    const risk: RiskEntry = {
      id: this.nextId('RSK', this.state.risks),
      ...input,
    };
    this.state.risks = [...this.state.risks, risk];
    this.appendAudit({
      actor,
      action: 'CREATE_RISK',
      entityCode: risk.linkedEntity,
      targetType: 'RiskEntry',
      targetId: risk.id,
      detail: `Added ${risk.category} risk "${risk.title}" (L${risk.likelihood} × I${risk.impact})`,
    });
    this.persist();
    return risk;
  }
}

export const cbzStore = new CbzStore();

// A small helper hook-style function so React screens can subscribe cleanly.
export function useCbzStore(): CbzStoreState {
  // Read state up-front; React re-renders when the reducer below dispatches.
  // Implementation lives in a React file — this stub exists to keep types clean.
  return cbzStore.getState();
}
