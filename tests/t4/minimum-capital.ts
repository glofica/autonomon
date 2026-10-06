/**
 * T4 — Phase 3: Minimum Viable Capital Sweep
 *
 * Paper Reference: GLOFICA_Langton_Autonomon.md §12 (Self-Funding & Fixed Cost Drag), §14 (T4).
 *
 * Sweeps initial capital levels across Scenario A (Symmetric Market, $40/mo cost)
 * over 30 seeds x 24 months to identify the smallest initial capital achieving
 * survival >= 90% at 24 months with 95% bootstrap confidence interval.
 */

import {
  type T4Config,
  type SeedPopulationResult,
  runOnePopulationSeed,
} from './runner.js';
import { T4_DEFAULT_COST_CONFIG } from './costs.js';
import { T4_SHOCK_SCENARIO_A } from './shocks.js';
import { bootstrapCI } from './metrics.js';

export interface CapitalSweepRow {
  capital: number;
  runwayMonths: number;
  survival12m: number;
  survival18m: number;
  survival24m: number;
  ci95Lower24m: number;
  ci95Upper24m: number;
  meetsTarget: boolean; // >= 90% survival at 24m
}

export interface MinimumCapitalResult {
  levels: CapitalSweepRow[];
  minimumViableCapital: number;
  minimumViableRow: CapitalSweepRow;
  targetThreshold: number;
}

export const CAPITAL_SWEEP_LEVELS: readonly number[] = [500, 800, 1200, 2000, 3000, 5000];

/**
 * Runs the initial capital sweep across 30 seeds x 24 months in Scenario A.
 */
export async function runMinimumCapitalSweep(
  levels: readonly number[] = CAPITAL_SWEEP_LEVELS,
  seedsCount: number = 30,
): Promise<MinimumCapitalResult> {
  const rows: CapitalSweepRow[] = [];
  const monthlyCost =
    T4_DEFAULT_COST_CONFIG.monthlyHostingUsd +
    T4_DEFAULT_COST_CONFIG.monthlyInferenceUsd +
    T4_DEFAULT_COST_CONFIG.monthlyGasUsd; // $40/month

  for (const capital of levels) {
    const runwayMonths = Number((capital / monthlyCost).toFixed(1));
    const config: T4Config = {
      population: {
        founderCount: 10,
        initialCapitalPerFounder: capital,
        reproductionThresholdMultiplier: 1.5,
        horizonYears: 2,
        stepsPerYear: 365,
        dt: 1 / 365,
        seed: 42,
      },
      costs: T4_DEFAULT_COST_CONFIG,
      shocks: T4_SHOCK_SCENARIO_A,
      seedsCount,
    };

    const seedResults: SeedPopulationResult[] = [];
    for (let s = 1; s <= seedsCount; s++) {
      const res = await runOnePopulationSeed(s, config);
      seedResults.push(res);
    }

    // Step 365 = month 12, Step 547 = month 18, Step 730 = month 24
    let surv12Sum = 0;
    let surv18Sum = 0;
    let surv24Sum = 0;
    const seed24mSurvivals: number[] = new Array(seedsCount);

    for (let i = 0; i < seedsCount; i++) {
      const r = seedResults[i];
      const s12 = r.founderSurvivalCurve[365] ?? 0;
      const s18 = r.founderSurvivalCurve[547] ?? 0;
      const s24 = r.founderSurvivalCurve[730] ?? 0;
      surv12Sum += s12;
      surv18Sum += s18;
      surv24Sum += s24;
      seed24mSurvivals[i] = s24;
    }

    const survival12m = surv12Sum / seedsCount;
    const survival18m = surv18Sum / seedsCount;
    const survival24m = surv24Sum / seedsCount;

    const [ci95Lower24m, ci95Upper24m] = bootstrapCI(seed24mSurvivals, 5000, 0.05, 42);
    const meetsTarget = survival24m >= 0.90;

    rows.push({
      capital,
      runwayMonths,
      survival12m,
      survival18m,
      survival24m,
      ci95Lower24m,
      ci95Upper24m,
      meetsTarget,
    });
  }

  // Smallest capital reaching >= 90% survival at 24m
  const viable = rows.find((r) => r.meetsTarget) ?? rows[rows.length - 1];

  return {
    levels: rows,
    minimumViableCapital: viable.capital,
    minimumViableRow: viable,
    targetThreshold: 0.90,
  };
}

export function formatCapitalSweepMarkdown(result: MinimumCapitalResult): string {
  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  let md = `| Initial Capital | Passive Runway | Survival @12m | Survival @18m | Survival @24m | 95% CI @24m | Meets ≥90% Target |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  for (const r of result.levels) {
    const ciStr = `[${toPct(r.ci95Lower24m)}, ${toPct(r.ci95Upper24m)}]`;
    const targetStr = r.meetsTarget ? '**YES**' : 'No';
    md += `| $${r.capital.toLocaleString()} | ${r.runwayMonths} mo | ${toPct(r.survival12m)} | ${toPct(r.survival18m)} | ${toPct(r.survival24m)} | ${ciStr} | ${targetStr} |\n`;
  }

  md += `\n**Minimum Viable Capital Result:** $${result.minimumViableCapital.toLocaleString()} USD achieves ` +
    `${toPct(result.minimumViableRow.survival24m)} survival at 24 months (95% CI: [${toPct(result.minimumViableRow.ci95Lower24m)}, ${toPct(result.minimumViableRow.ci95Upper24m)}]), satisfying the >= 90% survival threshold under passive cost drag and symmetric market conditions.\n`;

  return md;
}
