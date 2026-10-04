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
  fetchBank,
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
  fetchPeriods,
  fetchRisks,
  fetchWorkforce,
  hasCbzCredentials,
  setCbzAdminView,
} from './cbz_api';
import type {
  AuditEntry,
  BankInfo,
  CbzStoreState,
  Counterparty,
  EmissionRecord,
  FinancedPosition,
  FinancialInclusionRecord,
  GeospatialRecord,
  Incident,
  IngestionBatch,
  InsurancePolicy,
  ReportingPeriod,
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
  /** The bank this dashboard is scoped to; null until the first load finishes. */
  bank: BankInfo | null;
  periods: ReportingPeriod[];
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

interface ProviderProps {
  children: React.ReactNode;
  /** Set when a MAvHU admin views a bank: requests use the admin's token and ?bankId=. */
  adminView?: { token: string; bankId: number };
}

export function CbzDataProvider({ children, adminView }: ProviderProps) {
  // Only one provider is mounted at a time (bank portal or admin view), so it owns the
  // API client's scope and re-applies it before every load.
  const adminViewRef = useRef(adminView);
  adminViewRef.current = adminView;
  const [state, setState] = useState<CbzStoreState>(EMPTY_STATE);
  const [bank, setBank] = useState<BankInfo | null>(null);
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  // A refresh requested mid-load (e.g. right after sign-in) must still run, against the new token.
  const pendingRef = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (fetchingRef.current) {
      pendingRef.current = true;
      return;
    }
    fetchingRef.current = true;
    setCbzAdminView(adminViewRef.current ?? null);
    if (!hasCbzCredentials()) {
      // Signed out: drop whatever bank was loaded before; the API serves nothing anonymously.
      setState(EMPTY_STATE);
      setBank(null);
      setPeriods([]);
      setError(null);
      setLoading(false);
      fetchingRef.current = false;
      return;
    }
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
        bankInfo,
        periodRows,
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
        fetchBank(),
        fetchPeriods(),
      ]);
      setBank(bankInfo);
      setPeriods(periodRows);
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
    if (pendingRef.current) {
      pendingRef.current = false;
      await refresh();
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
        bank,
        periods,
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
