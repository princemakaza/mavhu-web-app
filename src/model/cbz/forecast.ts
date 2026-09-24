// Simple, auditable methods for the "Predictive analytics" tab.
// Kept intentionally explainable: linear regression + z-score anomaly flagging.
// Documented as "simplified" in the UI so we don't over-sell them.

export interface RegressionLine {
  slope: number;
  intercept: number;
}

export function linearRegression(values: number[]): RegressionLine {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXX += i * i;
    sumXY += i * values[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    return { slope: 0, intercept: values[0] ?? 0 };
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function projectSeries(history: number[], quarters: number): number[] {
  const { slope, intercept } = linearRegression(history);
  const forecast: number[] = [];
  for (let i = 0; i < quarters; i++) {
    const x = history.length + i;
    forecast.push(Math.max(0, intercept + slope * x));
  }
  return forecast;
}

export interface AnomalyFlag {
  index: number;
  value: number;
  z: number;
  flagged: boolean;
}

export function detectAnomalies(values: number[]): AnomalyFlag[] {
  if (values.length < 2) {
    return values.map((value, index) => ({ index, value, z: 0, flagged: false }));
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  return values.map((value, index) => {
    const z = stdev === 0 ? 0 : (value - mean) / stdev;
    return { index, value, z, flagged: Math.abs(z) > 2 };
  });
}
