import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  apiAddCounterparty,
  apiAddEmission,
  apiAddFinancedPosition,
  apiAddIncident,
  apiAddIngestionBatch,
  apiAddInsurance,
  apiAddRisk,
  apiAdvanceEmission,
  apiAppendAudit,
  fetchAudit,
  fetchCounterparties,
  fetchDepartments,
  fetchEmissions,
  fetchEntities,
  fetchFinancedPositions,
  fetchFinancialInclusion,
  fetchGeospatial,
  fetchIncidents,
  fetchIngestion,
  fetchInsurance,
  fetchMembers,
  fetchRisks,
  fetchWorkforce,
} from './cbz_api';
import type {
  AuditEntry,
  CbzStoreState,
  Counterparty,
  EmissionRecord,
  FinancedPosition,
  FinancialInclusionRecord,
  GeospatialRecord,
  Incident,
  IngestionBatch,
  InsurancePolicy,
  RiskEntry,
  WorkforceRecord,
} from './types';

// PostgreSQL returns NUMERIC/DECIMAL as strings — coerce known numeric fields.
const n = (v: unknown) => (v === null || v === undefined ? (v as never) : Number(v));

function normalizeEmissions(rows: EmissionRecord[]): EmissionRecord[] {
  return rows.map((r) => ({
    ...r,
    activityData: n(r.activityData),
    emissionFactorKgPerUnit: n(r.emissionFactorKgPerUnit),
    emissionsKgCo2e: n(r.emissionsKgCo2e),
    emissionsTco2e: n(r.emissionsTco2e),
    dataQuality: n(r.dataQuality) as EmissionRecord['dataQuality'],
  }));
}

function normalizeCounterparties(rows: Counterparty[]): Counterparty[] {
  return rows.map((r) => ({
    ...r,
    totalEmissionsTco2e: n(r.totalEmissionsTco2e),
    dqScore: n(r.dqScore) as Counterparty['dqScore'],
  }));
}

function normalizeFinancedPositions(rows: FinancedPosition[]): FinancedPosition[] {
  return rows.map((r) => ({ ...r, outstandingAmountUsd: n(r.outstandingAmountUsd) }));
}

function normalizeInsurance(rows: InsurancePolicy[]): InsurancePolicy[] {
  return rows.map((r) => ({
    ...r,
    grossWrittenPremiumUsd: n(r.grossWrittenPremiumUsd),
    denominatorValueUsd: r.denominatorValueUsd !== null ? n(r.denominatorValueUsd) : null,
    clientTotalEmissions: n(r.clientTotalEmissions),
    attributionFactor: n(r.attributionFactor),
    insuranceAssociatedEmissions: n(r.insuranceAssociatedEmissions),
    dqScore: n(r.dqScore) as InsurancePolicy['dqScore'],
  }));
}

function normalizeWorkforce(rows: WorkforceRecord[]): WorkforceRecord[] {
  return rows.map((r) => ({
    ...r,
    headcount: n(r.headcount),
    femaleShare: n(r.femaleShare),
    avgTrainingHours: n(r.avgTrainingHours),
    ltiRate: n(r.ltiRate),
    voluntaryTurnover: n(r.voluntaryTurnover),
    localHireShare: n(r.localHireShare),
  }));
}

function normalizeFinancialInclusion(rows: FinancialInclusionRecord[]): FinancialInclusionRecord[] {
  return rows.map((r) => ({
    ...r,
    beneficiaryCount: n(r.beneficiaryCount),
    femaleShare: n(r.femaleShare),
    totalDisbursedUsd: n(r.totalDisbursedUsd),
    repaymentRate: n(r.repaymentRate),
  }));
}

function normalizeGeospatial(rows: GeospatialRecord[]): GeospatialRecord[] {
  return rows.map((r) => ({
    ...r,
    ndvi: r.ndvi !== null ? n(r.ndvi) : null,
    areaHa: n(r.areaHa),
  }));
}

function normalizeRisks(rows: RiskEntry[]): RiskEntry[] {
  return rows.map((r) => ({
    ...r,
    likelihood: n(r.likelihood) as RiskEntry['likelihood'],
    impact: n(r.impact) as RiskEntry['impact'],
  }));
}

const EMPTY_STATE: CbzStoreState = {
  entities: [],
  departments: [],
  members: [],
  counterparties: [],
  financedPositions: [],
  emissions: [],
  insurance: [],
  financialInclusion: [],
  workforce: [],
  incidents: [],
  risks: [],
  geospatial: [],
  ingestion: [],
  audit: [],
};

interface CbzDataContextValue {
  state: CbzStoreState;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addCounterparty: (body: Partial<Counterparty>) => Promise<Counterparty>;
  addFinancedPosition: (body: Partial<FinancedPosition>) => Promise<FinancedPosition>;
  addEmission: (body: Partial<EmissionRecord>) => Promise<EmissionRecord>;
  advanceEmission: (id: string, actorId?: string) => Promise<EmissionRecord>;
  addInsurance: (body: Partial<InsurancePolicy>) => Promise<InsurancePolicy>;
  addIncident: (body: Partial<Incident>) => Promise<Incident>;
  addRisk: (body: Partial<RiskEntry>) => Promise<RiskEntry>;
  addIngestionBatch: (body: Partial<IngestionBatch>) => Promise<IngestionBatch>;
  appendAudit: (body: Partial<AuditEntry>) => Promise<AuditEntry>;
}

const CbzDataContext = createContext<CbzDataContextValue | null>(null);

export function CbzDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CbzStoreState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [
        entities,
        departments,
        members,
        counterparties,
        financedPositions,
        emissions,
        insurance,
        financialInclusion,
        workforce,
        incidents,
        risks,
        geospatial,
        ingestion,
        audit,
      ] = await Promise.all([
        fetchEntities(),
        fetchDepartments(),
        fetchMembers(),
        fetchCounterparties(),
        fetchFinancedPositions(),
        fetchEmissions(),
        fetchInsurance(),
        fetchFinancialInclusion(),
        fetchWorkforce(),
        fetchIncidents(),
        fetchRisks(),
        fetchGeospatial(),
        fetchIngestion(),
        fetchAudit(),
      ]);
      setState({
        entities,
        departments,
        members,
        counterparties: normalizeCounterparties(counterparties),
        financedPositions: normalizeFinancedPositions(financedPositions),
        emissions: normalizeEmissions(emissions),
        insurance: normalizeInsurance(insurance),
        financialInclusion: normalizeFinancialInclusion(financialInclusion),
        workforce: normalizeWorkforce(workforce),
        incidents,
        risks: normalizeRisks(risks),
        geospatial: normalizeGeospatial(geospatial),
        ingestion,
        audit,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCounterparty = async (body: Partial<Counterparty>) => {
    const result = await apiAddCounterparty(body);
    await refresh();
    return result;
  };

  const addFinancedPosition = async (body: Partial<FinancedPosition>) => {
    const result = await apiAddFinancedPosition(body);
    await refresh();
    return result;
  };

  const addEmission = async (body: Partial<EmissionRecord>) => {
    const result = await apiAddEmission(body);
    await refresh();
    return result;
  };

  const advanceEmission = async (id: string, actorId?: string) => {
    const result = await apiAdvanceEmission(id, actorId);
    await refresh();
    return result;
  };

  const addInsurance = async (body: Partial<InsurancePolicy>) => {
    const result = await apiAddInsurance(body);
    await refresh();
    return result;
  };

  const addIncident = async (body: Partial<Incident>) => {
    const result = await apiAddIncident(body);
    await refresh();
    return result;
  };

  const addRisk = async (body: Partial<RiskEntry>) => {
    const result = await apiAddRisk(body);
    await refresh();
    return result;
  };

  const addIngestionBatch = async (body: Partial<IngestionBatch>) => {
    const result = await apiAddIngestionBatch(body);
    await refresh();
    return result;
  };

  const appendAudit = async (body: Partial<AuditEntry>) => {
    const result = await apiAppendAudit(body);
    await refresh();
    return result;
  };

  return (
    <CbzDataContext.Provider
      value={{
        state,
        loading,
        error,
        refresh,
        addCounterparty,
        addFinancedPosition,
        addEmission,
        advanceEmission,
        addInsurance,
        addIncident,
        addRisk,
        addIngestionBatch,
        appendAudit,
      }}
    >
      {children}
    </CbzDataContext.Provider>
  );
}

export function useCbzData(): CbzDataContextValue {
  const ctx = useContext(CbzDataContext);
  if (!ctx) throw new Error('useCbzData must be used within <CbzDataProvider>');
  return ctx;
}
