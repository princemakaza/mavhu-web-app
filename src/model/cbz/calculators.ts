// PCAF asset-class calculator + Insurance-associated calculator.
// These match the developer guide almost verbatim — the same functions will be
// lifted server-side later. The math does not change; only where it runs.

import { ASSET_CLASS_DENOMINATOR } from './types';
import type { Counterparty, FinancedPosition, InsurancePolicy, WorkforceRecord } from './types';

/** Workforce is reported per subsidiary per quarter; headcount must come from each subsidiary's latest quarter only. */
export function latestWorkforce(rows: WorkforceRecord[]): WorkforceRecord[] {
  const latest = new Map<string, WorkforceRecord>();
  for (const row of rows) {
    const current = latest.get(row.subsidiary);
    if (!current || row.period > current.period) latest.set(row.subsidiary, row);
  }
  return [...latest.values()];
}

export interface PcafResult {
  attributionFactor: number;
  financedEmissionsTco2e: number;
  dataQualityScore: number;
  denominatorField: string;
  denominatorValueUsd: number;
}

export function calculatePcaf(counterparty: Counterparty, outstandingAmountUsd: number): PcafResult {
  const denomField = ASSET_CLASS_DENOMINATOR[counterparty.assetClass];
  const denominator = counterparty.financials[denomField];
  if (!denominator || denominator <= 0) {
    // Return a zero attribution rather than throwing — the UI can flag the
    // missing input, matching how the real API responds with a validation code.
    return {
      attributionFactor: 0,
      financedEmissionsTco2e: 0,
      dataQualityScore: counterparty.dqScore,
      denominatorField: denomField,
      denominatorValueUsd: 0,
    };
  }
  const attributionFactor = outstandingAmountUsd / denominator;
  return {
    attributionFactor,
    financedEmissionsTco2e: attributionFactor * counterparty.totalEmissionsTco2e,
    dataQualityScore: counterparty.dqScore,
    denominatorField: denomField,
    denominatorValueUsd: denominator,
  };
}

export interface PortfolioSummary {
  positions: number;
  totalOutstandingUsd: number;
  totalFinancedEmissions: number;
  weightedAvgDq: number;
}

export function summarisePortfolio(
  counterparties: Counterparty[],
  positions: FinancedPosition[],
): PortfolioSummary {
  const byId = new Map(counterparties.map((c) => [c.id, c]));
  let outstanding = 0;
  let emissions = 0;
  let dqNumerator = 0;
  for (const position of positions) {
    const cp = byId.get(position.counterpartyId);
    if (!cp) continue;
    const result = calculatePcaf(cp, position.outstandingAmountUsd);
    outstanding += position.outstandingAmountUsd;
    emissions += result.financedEmissionsTco2e;
    dqNumerator += result.financedEmissionsTco2e * result.dataQualityScore;
  }
  return {
    positions: positions.length,
    totalOutstandingUsd: outstanding,
    totalFinancedEmissions: emissions,
    weightedAvgDq: emissions > 0 ? dqNumerator / emissions : 0,
  };
}

export function summariseInsurance(policies: InsurancePolicy[]) {
  const totalPremium = policies.reduce((sum, p) => sum + p.grossWrittenPremiumUsd, 0);
  const totalEmissions = policies.reduce((sum, p) => sum + p.insuranceAssociatedEmissions, 0);
  const weightedDq =
    totalEmissions > 0
      ? policies.reduce((sum, p) => sum + p.insuranceAssociatedEmissions * p.dqScore, 0) / totalEmissions
      : 0;
  return { totalPremium, totalEmissions, weightedDq, count: policies.length };
}
