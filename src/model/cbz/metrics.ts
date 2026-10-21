// The platform metric catalogue: every ESG metric is computed once from approved data and tagged
// once against each framework it feeds ("framework coverage built once, reported many times").
// Targets, risk appetite and the disclosure centre all read values from here.

import { latestWorkforce, summariseInsurance, summarisePortfolio } from './calculators';
import type { CbzStoreState, EntityCode, RegisterItem } from './types';

export const FRAMEWORKS = ['IFRS S2', 'GRI', 'TCFD', 'SASB', 'PCAF', 'SDG', 'TNFD', 'RBZ', 'ZSE', 'EMA', 'IPEC', 'SECZim'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  'IFRS S2': 'IFRS S2 Climate-related Disclosures',
  GRI: 'GRI Standards',
  TCFD: 'TCFD recommendations (→ IFRS S2 index)',
  SASB: 'SASB Commercial Banks / Insurance',
  PCAF: 'PCAF Global GHG Standard (Parts A & C)',
  SDG: 'UN Sustainable Development Goals',
  TNFD: 'TNFD recommendations (LEAP)',
  RBZ: 'Reserve Bank of Zimbabwe: climate risk management',
  ZSE: 'Zimbabwe Stock Exchange: sustainability reporting',
  EMA: 'Environmental Management Agency returns',
  IPEC: 'Insurance & Pensions Commission',
  SECZim: 'Securities & Exchange Commission of Zimbabwe',
};

/** Local regulator references are mapping labels to be validated against each regulator's template. */
export const LOCAL_FRAMEWORKS: Framework[] = ['RBZ', 'ZSE', 'EMA', 'IPEC', 'SECZim'];

export interface MetricContext {
  state: CbzStoreState;
  /** 'GROUP' for the consolidated view, or one subsidiary code. */
  scope: EntityCode;
  /** YYYY, YYYY-Qn or YYYY-MM; null = trailing 12 months ending at the latest approved period. */
  period: string | null;
  registers: Partial<Record<string, RegisterItem[]>>;
}

export interface MetricDef {
  code: string;
  label: string;
  unit: string;
  pillar: 'Environmental' | 'Social' | 'Governance' | 'Economic';
  refs: Partial<Record<Framework, string>>;
  /** How the value is derived, shown next to it. */
  basis: string;
  compute: (ctx: MetricContext) => number | string | null;
  /** Records the value was computed from (shown as the source count). */
  sources?: (ctx: MetricContext) => number;
}

// ── Period handling ──────────────────────────────────────────────────────────

const QUARTER_OF = (month: number) => Math.ceil(month / 3);

/** Does a record's period (YYYY-MM, YYYY-Qn or YYYY) fall inside the selected period? */
export function periodIn(recordPeriod: string, selected: string): boolean {
  if (recordPeriod === selected) return true;
  const m = /^(\d{4})-(\d{2})$/.exec(recordPeriod);
  const q = /^(\d{4})-Q([1-4])$/.exec(recordPeriod);
  const year = recordPeriod.slice(0, 4);
  if (/^\d{4}$/.test(selected)) return year === selected;
  const sq = /^(\d{4})-Q([1-4])$/.exec(selected);
  if (sq && m) return m[1] === sq[1] && QUARTER_OF(Number(m[2])) === Number(sq[2]);
  if (sq && q) return q[1] === sq[1] && q[2] === sq[2];
  return false;
}

/** Months covered by a record's period, used to place it on a timeline. */
function lastMonthOf(period: string): string | null {
  if (/^\d{4}-\d{2}$/.test(period)) return period;
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) return `${q[1]}-${String(Number(q[2]) * 3).padStart(2, '0')}`;
  if (/^\d{4}$/.test(period)) return `${period}-12`;
  return null;
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const SIGNED_OFF = new Set(['approved', 'locked']);

/** Approved/locked emission records in scope and period (or the trailing 12 months). */
export function approvedEmissions(ctx: MetricContext) {
  const inScope = ctx.state.emissions.filter(
    (e) => SIGNED_OFF.has(e.status) && (ctx.scope === 'GROUP' || e.entityCode === ctx.scope),
  );
  if (ctx.period) return inScope.filter((e) => periodIn(e.period, ctx.period as string));
  const latest = inScope.map((e) => lastMonthOf(e.period)).filter(Boolean).sort().pop();
  if (!latest) return [];
  const from = addMonths(latest, -11);
  return inScope.filter((e) => {
    const end = lastMonthOf(e.period);
    return end !== null && end >= from && end <= latest;
  });
}

export function latestApprovedPeriod(state: CbzStoreState): string | null {
  return (
    state.emissions
      .filter((e) => SIGNED_OFF.has(e.status))
      .map((e) => lastMonthOf(e.period))
      .filter((p): p is string => Boolean(p))
      .sort()
      .pop() ?? null
  );
}

// ── Portfolio helpers ────────────────────────────────────────────────────────

function portfolio(ctx: MetricContext) {
  const cps = ctx.state.counterparties.filter((c) => ctx.scope === 'GROUP' || c.subsidiary === ctx.scope);
  const ids = new Set(cps.map((c) => c.id));
  const positions = ctx.state.financedPositions.filter((p) => ids.has(p.counterpartyId));
  return { cps, positions, summary: summarisePortfolio(cps, positions) };
}

/** Sectors treated as carbon-related assets (TCFD) / high transition risk. */
export const HIGH_TRANSITION_SECTORS = ['Mining', 'Energy', 'Oil & gas', 'Transport', 'Manufacturing', 'Sovereign', 'Consumer goods', 'Agri-processing'];

/** Renewable and green sectors are transition opportunities, not carbon-related assets. */
export function isHighTransition(sector: string): boolean {
  const s = sector.toLowerCase();
  if (/renewable|green|solar|hydro|wind/.test(s)) return false;
  return HIGH_TRANSITION_SECTORS.some((h) => s.includes(h.toLowerCase()));
}

function outstandingWhere(ctx: MetricContext, predicate: (cpSector: string, cp: CbzStoreState['counterparties'][number]) => boolean) {
  const { cps, positions } = portfolio(ctx);
  const byId = new Map(cps.map((c) => [c.id, c]));
  let match = 0;
  let total = 0;
  for (const p of positions) {
    const cp = byId.get(p.counterpartyId);
    if (!cp) continue;
    total += p.outstandingAmountUsd;
    if (predicate(cp.sector, cp)) match += p.outstandingAmountUsd;
  }
  return total > 0 ? match / total : null;
}

const sumTco2 = (ctx: MetricContext, scope: string, exclude?: RegExp) =>
  approvedEmissions(ctx)
    .filter((e) => e.scope === scope && !(exclude && exclude.test(e.datasetType)))
    .reduce((s, e) => s + Number(e.emissionsTco2e), 0);

const countTco2 = (ctx: MetricContext, scope: string) => approvedEmissions(ctx).filter((e) => e.scope === scope).length;

/** A disclosed total needs at least one approved record: no records means "not available", never zero. */
const reportedTco2 = (ctx: MetricContext, scope: string, exclude?: RegExp) => (countTco2(ctx, scope) ? sumTco2(ctx, scope, exclude) : null);

function registerRows(ctx: MetricContext, key: string) {
  return (ctx.registers[key] ?? []).filter((r) => ctx.scope === 'GROUP' || !r.entityCode || r.entityCode === ctx.scope);
}

function registerSum(ctx: MetricContext, key: string, field: string): number | null {
  const rows = registerRows(ctx, key).filter((r) => !ctx.period || periodIn(String(r.data.period ?? ''), ctx.period));
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + Number(r.data[field] ?? 0), 0);
}

// ── The catalogue ────────────────────────────────────────────────────────────

export const METRICS: MetricDef[] = [
  {
    code: 'GHG_SCOPE1',
    label: 'Gross Scope 1 GHG emissions',
    unit: 'tCO2e',
    pillar: 'Environmental',
    basis: 'Sum of approved Scope 1 records (GHG Protocol)',
    refs: { 'IFRS S2': '29(a)(i)(1)', GRI: '305-1', TCFD: 'Metrics & Targets (b)', SDG: '13.2', RBZ: 'CRM guideline: GHG metrics', ZSE: 'Sustainability guidance: emissions', EMA: 'Air emissions return' },
    compute: (ctx) => reportedTco2(ctx, 'scope1'),
    sources: (ctx) => countTco2(ctx, 'scope1'),
  },
  {
    code: 'GHG_SCOPE2',
    label: 'Gross Scope 2 GHG emissions (location-based)',
    unit: 'tCO2e',
    pillar: 'Environmental',
    basis: 'Sum of approved Scope 2 records, location-based',
    refs: { 'IFRS S2': '29(a)(i)(2), (a)(v)', GRI: '305-2', TCFD: 'Metrics & Targets (b)', SDG: '13.2', RBZ: 'CRM guideline: GHG metrics', ZSE: 'Sustainability guidance: emissions' },
    compute: (ctx) => reportedTco2(ctx, 'scope2'),
    sources: (ctx) => countTco2(ctx, 'scope2'),
  },
  {
    code: 'GHG_SCOPE3_OPS',
    label: 'Scope 3 operational (categories 1-14)',
    unit: 'tCO2e',
    pillar: 'Environmental',
    basis: 'Approved Scope 3 records excluding category 15',
    refs: { 'IFRS S2': '29(a)(i)(3), (a)(vi)', GRI: '305-3', TCFD: 'Metrics & Targets (b)' },
    compute: (ctx) => reportedTco2(ctx, 'scope3', /^Cat 15/i),
    sources: (ctx) => countTco2(ctx, 'scope3'),
  },
  {
    code: 'GHG_FINANCED',
    label: 'Financed emissions (Scope 3 category 15)',
    unit: 'tCO2e',
    pillar: 'Environmental',
    basis: 'PCAF Part A: Σ attribution factor × borrower emissions',
    refs: { 'IFRS S2': '29(a)(vi)(2)', GRI: '305-3', TCFD: 'Metrics & Targets (b)', SASB: 'FN-CB-410b.1', PCAF: 'Part A', RBZ: 'CRM guideline: portfolio emissions', ZSE: 'Sustainability guidance: financed emissions' },
    compute: (ctx) => portfolio(ctx).summary.totalFinancedEmissions,
    sources: (ctx) => portfolio(ctx).positions.length,
  },
  {
    code: 'PCAF_DQ',
    label: 'Financed emissions: weighted PCAF data-quality score',
    unit: 'score 1-5',
    pillar: 'Environmental',
    basis: 'Emissions-weighted average of position DQ scores',
    refs: { 'IFRS S2': '29(a)(vi)(2) measurement approach', PCAF: 'Part A §5 data quality', SASB: 'FN-CB-410b.4' },
    compute: (ctx) => portfolio(ctx).summary.weightedAvgDq || null,
    sources: (ctx) => portfolio(ctx).positions.length,
  },
  {
    code: 'FINANCED_INTENSITY',
    label: 'Financed emissions intensity',
    unit: 'tCO2e / US$m',
    pillar: 'Environmental',
    basis: 'Financed emissions ÷ outstanding (US$ millions)',
    refs: { 'IFRS S2': '29(a)(vi)(2)', TCFD: 'Metrics & Targets (b): intensity', SASB: 'FN-CB-410b.3', PCAF: 'Part A: economic intensity' },
    compute: (ctx) => {
      const s = portfolio(ctx).summary;
      return s.totalOutstandingUsd > 0 ? s.totalFinancedEmissions / (s.totalOutstandingUsd / 1e6) : null;
    },
  },
  {
    code: 'GHG_INSURANCE',
    label: 'Insurance-associated emissions',
    unit: 'tCO2e',
    pillar: 'Environmental',
    basis: 'PCAF Part C: Σ premium attribution × client emissions',
    refs: { 'IFRS S2': '29(a)(vi)(2) insurance', PCAF: 'Part C', IPEC: 'Climate risk return: underwriting emissions' },
    compute: (ctx) => {
      const p = ctx.state.insurance.filter((i) => ctx.scope === 'GROUP' || i.subsidiary === ctx.scope);
      return p.length ? summariseInsurance(p).totalEmissions : null;
    },
    sources: (ctx) => ctx.state.insurance.filter((i) => ctx.scope === 'GROUP' || i.subsidiary === ctx.scope).length,
  },
  {
    code: 'EXPOSURE_TOTAL',
    label: 'Lending and investment exposure in scope',
    unit: 'US$',
    pillar: 'Economic',
    basis: 'Outstanding amounts of financed positions',
    refs: { 'IFRS S2': '29(b)-(c) denominator', TCFD: 'Strategy (a)', SASB: 'FN-CB-410a.1' },
    compute: (ctx) => portfolio(ctx).summary.totalOutstandingUsd,
  },
  {
    code: 'HIGH_TRANSITION_SHARE',
    label: 'Exposure to carbon-related / high transition-risk sectors',
    unit: '% of exposure',
    pillar: 'Environmental',
    basis: `Share of outstanding in: ${HIGH_TRANSITION_SECTORS.join(', ')}`,
    refs: { 'IFRS S2': '29(b) transition risk', TCFD: 'Metrics & Targets: carbon-related assets', SASB: 'FN-CB-410a.1', RBZ: 'CRM guideline: concentration to climate-sensitive sectors' },
    compute: (ctx) => outstandingWhere(ctx, (sector) => isHighTransition(sector)),
  },
  {
    code: 'PHYSICAL_RISK_SHARE',
    label: 'Exposure to borrowers with high flood or drought risk',
    unit: '% of exposure',
    pillar: 'Environmental',
    basis: 'Borrowers flagged High in satellite/geospatial monitoring',
    refs: { 'IFRS S2': '29(c) physical risk', TCFD: 'Risk Management (a)', TNFD: 'LEAP: Assess', RBZ: 'CRM guideline: physical risk exposure' },
    compute: (ctx) => {
      const flagged = new Set(
        ctx.state.geospatial.filter((g) => g.floodRisk === 'High' || g.droughtStress === 'High').map((g) => g.linkedBorrowerName.toLowerCase()),
      );
      return outstandingWhere(ctx, (_s, cp) => flagged.has(cp.name.toLowerCase()));
    },
  },
  {
    code: 'SUSTAINABLE_SHARE',
    label: 'Taxonomy-aligned sustainable finance (green asset ratio)',
    unit: '% of exposure',
    pillar: 'Economic',
    basis: 'Outstanding tagged Aligned under AfDB / ICMA / local taxonomy',
    refs: { 'IFRS S2': '29(d)-(e) opportunities & capital deployment', TCFD: 'Strategy (a): opportunities', SDG: '13.a, 7.2', RBZ: 'Green finance reporting' },
    compute: (ctx) => outstandingWhere(ctx, (_s, cp) => cp.taxonomyStatus === 'Aligned'),
  },
  {
    code: 'MRV_COVERAGE',
    label: 'Agri exposure verified by MAvHU MRV',
    unit: '% of agri exposure',
    pillar: 'Environmental',
    basis: 'Agriculture outstanding linked to satellite-monitored land',
    refs: { PCAF: 'Part A: data-quality improvement plan', TNFD: 'LEAP: Locate', SDG: '15.1' },
    compute: (ctx) => {
      const agri = outstandingWhere(ctx, (sector) => /agri/i.test(sector));
      if (!agri) return null;
      const mrv = outstandingWhere(ctx, (sector, cp) => /agri/i.test(sector) && Boolean(cp.customerId || cp.mrvEnhanced));
      return mrv !== null ? mrv / agri : null;
    },
  },
  {
    code: 'ENERGY_KWH',
    label: 'Electricity consumed (own operations)',
    unit: 'kWh',
    pillar: 'Environmental',
    basis: 'Environmental resources register',
    refs: { GRI: '302-1', EMA: 'Resource use return', ZSE: 'Sustainability guidance: energy', SDG: '7.3' },
    compute: (ctx) => registerSum(ctx, 'resource-use', 'electricityKwh'),
    sources: (ctx) => registerRows(ctx, 'resource-use').length,
  },
  {
    code: 'WATER_M3',
    label: 'Water consumed (own operations)',
    unit: 'm³',
    pillar: 'Environmental',
    basis: 'Environmental resources register',
    refs: { GRI: '303-5', EMA: 'Water use return', SDG: '6.4' },
    compute: (ctx) => registerSum(ctx, 'resource-use', 'waterM3'),
  },
  {
    code: 'WASTE_T',
    label: 'Waste generated (own operations)',
    unit: 'tonnes',
    pillar: 'Environmental',
    basis: 'Environmental resources register',
    refs: { GRI: '306-3', EMA: 'Solid waste return', SDG: '12.5' },
    compute: (ctx) => registerSum(ctx, 'resource-use', 'wasteTonnes'),
  },
  {
    code: 'HEADCOUNT',
    label: 'Total workforce',
    unit: 'employees',
    pillar: 'Social',
    basis: 'Latest workforce record per subsidiary',
    refs: { GRI: '2-7', ZSE: 'Sustainability guidance: employees' },
    compute: (ctx) => {
      const w = latestWorkforce(ctx.state.workforce.filter((r) => ctx.scope === 'GROUP' || r.subsidiary === ctx.scope));
      return w.length ? w.reduce((s, r) => s + r.headcount, 0) : null;
    },
  },
  {
    code: 'FEMALE_SHARE',
    label: 'Women in the workforce',
    unit: '%',
    pillar: 'Social',
    basis: 'Headcount-weighted female share, latest period',
    refs: { GRI: '405-1', SDG: '5.5', ZSE: 'Sustainability guidance: diversity' },
    compute: (ctx) => {
      const w = latestWorkforce(ctx.state.workforce.filter((r) => ctx.scope === 'GROUP' || r.subsidiary === ctx.scope));
      const total = w.reduce((s, r) => s + r.headcount, 0);
      return total ? w.reduce((s, r) => s + r.femaleShare * r.headcount, 0) / total : null;
    },
  },
  {
    code: 'TRAINING_HOURS',
    label: 'Average training hours per employee',
    unit: 'hours',
    pillar: 'Social',
    basis: 'Headcount-weighted, latest period',
    refs: { GRI: '404-1', SDG: '4.4' },
    compute: (ctx) => {
      const w = latestWorkforce(ctx.state.workforce.filter((r) => ctx.scope === 'GROUP' || r.subsidiary === ctx.scope));
      const total = w.reduce((s, r) => s + r.headcount, 0);
      return total ? w.reduce((s, r) => s + r.avgTrainingHours * r.headcount, 0) / total : null;
    },
  },
  {
    code: 'LTI_RATE',
    label: 'Lost-time injury rate',
    unit: 'rate',
    pillar: 'Social',
    basis: 'Headcount-weighted, latest period',
    refs: { GRI: '403-9', SDG: '8.8' },
    compute: (ctx) => {
      const w = latestWorkforce(ctx.state.workforce.filter((r) => ctx.scope === 'GROUP' || r.subsidiary === ctx.scope));
      const total = w.reduce((s, r) => s + r.headcount, 0);
      return total ? w.reduce((s, r) => s + r.ltiRate * r.headcount, 0) / total : null;
    },
  },
  {
    code: 'FI_BENEFICIARIES',
    label: 'Financial inclusion beneficiaries',
    unit: 'people',
    pillar: 'Social',
    basis: 'Financial inclusion programmes',
    refs: { GRI: '203-2', SDG: '1.4, 8.10', RBZ: 'Financial inclusion return' },
    compute: (ctx) => {
      const rows = ctx.state.financialInclusion.filter((f) => (ctx.scope === 'GROUP' || f.subsidiary === ctx.scope) && (!ctx.period || periodIn(f.period, ctx.period)));
      return rows.length ? rows.reduce((s, r) => s + r.beneficiaryCount, 0) : null;
    },
  },
  {
    code: 'COMMUNITY_SPEND',
    label: 'Community investment',
    unit: 'US$',
    pillar: 'Social',
    basis: 'Community investment register',
    refs: { GRI: '201-1, 203-1', SDG: '17.17', ZSE: 'Sustainability guidance: community' },
    compute: (ctx) => registerSum(ctx, 'community-investment', 'spendUsd'),
  },
  {
    code: 'SUPPLIERS_SCREENED',
    label: 'Suppliers screened on ESG criteria',
    unit: '% of suppliers',
    pillar: 'Governance',
    basis: 'Supplier ESG register',
    refs: { GRI: '308-1, 414-1', SDG: '12.6' },
    compute: (ctx) => {
      const rows = registerRows(ctx, 'suppliers');
      return rows.length ? rows.filter((r) => r.data.esgScreened === true).length / rows.length : null;
    },
  },
  {
    code: 'INCIDENTS_OPEN',
    label: 'Open ESG and compliance incidents',
    unit: 'incidents',
    pillar: 'Governance',
    basis: 'Incident register, not closed',
    refs: { GRI: '2-27', ZSE: 'Sustainability guidance: compliance', SECZim: 'Material event disclosure', IPEC: 'Conduct incidents' },
    compute: (ctx) => ctx.state.incidents.filter((i) => (ctx.scope === 'GROUP' || i.subsidiary === ctx.scope) && i.status !== 'Closed').length,
  },
  {
    code: 'CLIMATE_RISKS_HIGH',
    label: 'Climate and ESG risks rated high (likelihood × impact ≥ 12)',
    unit: 'risks',
    pillar: 'Governance',
    basis: 'Risk register',
    refs: { 'IFRS S2': '10-12, 25', TCFD: 'Risk Management (b)', RBZ: 'CRM guideline: risk register', TNFD: 'LEAP: Assess' },
    compute: (ctx) =>
      ctx.state.risks.filter((r) => (ctx.scope === 'GROUP' || r.linkedEntity === ctx.scope) && r.likelihood * r.impact >= 12 && r.status !== 'Closed').length,
  },
  {
    code: 'TARGETS',
    label: 'Climate and ESG targets set',
    unit: 'narrative',
    pillar: 'Governance',
    basis: 'Targets register',
    refs: { 'IFRS S2': '33-36', TCFD: 'Metrics & Targets (c)', GRI: '3-3', SDG: '13.2' },
    compute: (ctx) => {
      const rows = registerRows(ctx, 'targets');
      return rows.length ? rows.map((r) => `${r.data.name} (${r.data.baselineYear}→${r.data.targetYear})`).join('; ') : null;
    },
  },
  {
    code: 'MATERIAL_TOPICS',
    label: 'Material topics (double materiality)',
    unit: 'narrative',
    pillar: 'Governance',
    basis: 'Materiality assessment; topics scoring ≥ 4 on either axis',
    refs: { GRI: '3-1, 3-2', 'IFRS S2': '(S1) materiality judgement', TNFD: 'LEAP: Evaluate' },
    compute: (ctx) => {
      const rows = registerRows(ctx, 'material-topics').filter((r) => Number(r.data.impactScore) >= 4 || Number(r.data.financialScore) >= 4);
      return rows.length ? rows.map((r) => String(r.data.topic)).join('; ') : null;
    },
  },
  {
    code: 'GOV_OVERSIGHT',
    label: 'Board oversight of climate-related risks',
    unit: 'narrative',
    pillar: 'Governance',
    basis: 'Narrative: not yet captured in the platform',
    refs: { 'IFRS S2': '6', TCFD: 'Governance (a)', RBZ: 'CRM guideline: governance', ZSE: 'Sustainability guidance: governance', SECZim: 'Corporate governance code' },
    compute: () => null,
  },
];

export const METRIC_BY_CODE = new Map(METRICS.map((m) => [m.code, m]));

/** The live metrics that targets and risk appetite can track (codes match the server's list). */
export const LIVE_METRIC_LABELS: Record<string, string> = {
  SCOPE12_TCO2E: 'Scope 1+2 emissions, trailing 12 months (tCO2e)',
  OPS_TCO2E: 'Operational Scope 1-3 emissions, trailing 12 months (tCO2e)',
  FINANCED_TCO2E: 'Financed emissions (tCO2e)',
  FINANCED_INTENSITY: 'Financed emissions intensity (tCO2e / US$m)',
  WEIGHTED_DQ: 'Weighted PCAF data-quality score',
  FEMALE_SHARE: 'Women in the workforce (share)',
  HIGH_TRANSITION_SHARE: 'Exposure to high transition-risk sectors (share)',
  SUSTAINABLE_SHARE: 'Taxonomy-aligned share of exposure',
  OPEN_INCIDENTS: 'Open ESG incidents',
  MANUAL: 'Manual value (entered on the target)',
};

/** Current value of a live metric (trailing 12 months for emission flows). Null = not measurable yet. */
export function liveMetric(code: string, state: CbzStoreState, scope: EntityCode = 'GROUP', registers: MetricContext['registers'] = {}): number | null {
  const ctx: MetricContext = { state, scope, period: null, registers };
  const num = (v: number | string | null) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  switch (code) {
    case 'SCOPE12_TCO2E':
      return sumTco2(ctx, 'scope1') + sumTco2(ctx, 'scope2');
    case 'OPS_TCO2E':
      return sumTco2(ctx, 'scope1') + sumTco2(ctx, 'scope2') + sumTco2(ctx, 'scope3', /^Cat 15/i);
    case 'FINANCED_TCO2E':
      return num(METRIC_BY_CODE.get('GHG_FINANCED')!.compute(ctx));
    case 'FINANCED_INTENSITY':
      return num(METRIC_BY_CODE.get('FINANCED_INTENSITY')!.compute(ctx));
    case 'WEIGHTED_DQ':
      return num(METRIC_BY_CODE.get('PCAF_DQ')!.compute(ctx));
    case 'FEMALE_SHARE':
      return num(METRIC_BY_CODE.get('FEMALE_SHARE')!.compute(ctx));
    case 'HIGH_TRANSITION_SHARE':
      return num(METRIC_BY_CODE.get('HIGH_TRANSITION_SHARE')!.compute(ctx));
    case 'SUSTAINABLE_SHARE':
      return num(METRIC_BY_CODE.get('SUSTAINABLE_SHARE')!.compute(ctx));
    case 'OPEN_INCIDENTS':
      return num(METRIC_BY_CODE.get('INCIDENTS_OPEN')!.compute(ctx));
    default:
      return null;
  }
}

/** Formats a metric value for display given its unit. */
export function formatMetric(value: number | string | null, unit: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (unit.startsWith('%') || unit === 'share') return `${(value * 100).toFixed(1)}%`;
  if (unit.startsWith('US$') && Math.abs(value) >= 1000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString('en-GB');
  return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
}
