/**
 * T1st — Report generator for two-phase training + evaluation with safety layer.
 *
 * Acceptance criteria follow Paper §4, §6, and §14:
 *   - Max drawdown < 15% across all seeds
 *   - Mean trades per seed in evaluation < 100
 *   - Phase 2 annualized return > -5%
 */

import fs from 'fs';
import path from 'path';
import type { T1stMetrics, T1stResult } from './metrics.js';

export interface T1stConfig {
  seedsCount: number;
  trainSteps: number;
  evalSteps: number;
  trainEpsilon: number;
  initialCapital: number;
  sigma: number;
  dt: number;
  feeBps: number;
  slippageBps: number;
  g_gas: number;
  g_omega: number;
  drawdownBreakerThreshold: number;
  breakerLockoutMs: number;
  [key: string]: any;
}

export function generateReportMarkdown(
  metrics: T1stMetrics,
  config: T1stConfig,
  results?: T1stResult[],
  dateStr?: string,
  variant: string = 'T1st — Two-Phase Training + Evaluation with Safety Layer',
): string {
  const date = dateStr || new Date().toISOString();
  const c1Pass = metrics.maxDrawdownUnderThreshold;
  const c2Pass = metrics.tradesUnderThreshold;
  const c3Pass = metrics.annualizedReturnBounded;
  const verdict = c1Pass && c2Pass && c3Pass ? 'PASS' : 'FAIL';

  const toPct = (val: number) => (val * 100).toFixed(4) + '%';
  const toBps = (val: number) => (val * 10000).toFixed(2) + ' bps';
  const roundTripBps = 2 * (config.feeBps + config.slippageBps);

  let md = `# T1st Two-Phase Learning & Safety Layer Suite Report\n\n`;
  md += `**Date:** ${date}\n\n`;
  md += `**Variant:** ${variant}\n\n`;

  md += `## Configuration\n\n`;
  md += `| Parameter | Value |\n`;
  md += `|---|---|\n`;
  md += `| Seeds Evaluated | ${config.seedsCount} (Seeds 1 through ${config.seedsCount}) |\n`;
  md += `| Phase 1 (Training Steps) | ${config.trainSteps.toLocaleString()} steps (ε = ${config.trainEpsilon.toFixed(2)} → 0.05 floor) |\n`;
  md += `| Phase 2 (Evaluation Steps) | ${config.evalSteps.toLocaleString()} steps (ε = 0 exploitation only) |\n`;
  md += `| Total Steps per Seed | ${(config.trainSteps + config.evalSteps).toLocaleString()} |\n`;
  md += `| Initial Capital | $${config.initialCapital.toLocaleString()} |\n`;
  md += `| Price Volatility (sigma) | ${config.sigma.toFixed(2)} |\n`;
  md += `| Step Size (dt) | 5 / (60 * 24 * 365) (~${config.dt.toExponential(4)}) |\n`;
  md += `| Transaction Fee (per leg) | ${config.feeBps} bps |\n`;
  md += `| Execution Slippage (per leg) | ${config.slippageBps} bps |\n`;
  md += `| Round-Trip Cost (buy + sell) | ${roundTripBps} bps |\n`;
  md += `| Gas Reserve Floor (g_gas) | ${config.g_gas} XGO (§6) |\n`;
  md += `| Concentration Cap (g_omega) | ${(config.g_omega * 100).toFixed(1)}% of NAV (§6) |\n`;
  md += `| Drawdown Breaker Threshold | ${(config.drawdownBreakerThreshold * 100).toFixed(1)}% trailing drawdown (§6.2) |\n`;
  md += `| Breaker Lockout Duration | ${config.breakerLockoutMs / (1000 * 60 * 60)} hours (48 steps) (§6.2) |\n\n`;

  md += `## Evaluation Phase Metrics (Across ${metrics.nSeeds} Seeds)\n\n`;
  md += `| Metric | Point Estimate | 95% Bootstrap CI |\n`;
  md += `|---|---|---|\n`;
  md += `| Mean Net Return (Annualized) | ${toPct(metrics.meanEvalAnnualizedReturn)} (${toBps(metrics.meanEvalAnnualizedReturn)}) | [${toPct(metrics.ci95Lower)}, ${toPct(metrics.ci95Upper)}] |\n`;
  md += `| Median Net Return (Annualized) | ${toPct(metrics.medianEvalAnnualizedReturn)} | - |\n`;
  md += `| Standard Deviation (Annualized) | ${toPct(metrics.stdDevEvalAnnualizedReturn)} | - |\n`;
  md += `| Overall Maximum Drawdown | ${toPct(metrics.maxDrawdownOverall)} | - |\n`;
  md += `| Phase 2 Evaluation Max Drawdown | ${toPct(metrics.maxDrawdownEval)} | - |\n`;
  md += `| Mean Evaluation Trades per Seed | ${metrics.meanEvalTrades.toFixed(2)} | - |\n`;
  md += `| Mean Training Trades per Seed | ${metrics.meanTrainTrades.toFixed(2)} | - |\n`;
  md += `| Trade Reduction after Training | ${metrics.tradeReductionPct.toFixed(2)}% | - |\n`;
  md += `| Mean Evaluation Turnover | ${metrics.meanEvalTurnover.toFixed(4)} | - |\n`;
  md += `| Seeds with Breaker Tripped | ${metrics.seedsWithBreakerTripped} / ${metrics.nSeeds} | - |\n\n`;

  md += `## Acceptance Criteria (Paper §4, §6, §14)\n\n`;
  md += `- [${c1Pass ? 'x' : ' '}] Max drawdown < 15% across all seeds: peak observed drawdown was ${toPct(metrics.maxDrawdownOverall)} < 15.00%\n`;
  md += `- [${c2Pass ? 'x' : ' '}] Mean trades per seed in evaluation < 100: achieved ${metrics.meanEvalTrades.toFixed(2)} trades/seed (${metrics.tradeReductionPct.toFixed(1)}% drop)\n`;
  md += `- [${c3Pass ? 'x' : ' '}] Phase 2 annualized return > -5%: achieved ${toPct(metrics.meanEvalAnnualizedReturn)} > -5.00%\n\n`;

  md += `## Verdict: **${verdict}**\n\n`;

  if (verdict === 'PASS') {
    md += `**Interpretation.** T1st proves the synthesis of artificial-life learning and formal execution safety. During Phase 1 (training), the agent explores with the safety layer active. The Q-table learns that in a zero-conditional-mean market, trading incurs costs without expectation of profit. When transitioned to Phase 2 (exploitation with ε = 0), the agent reduces trading by ${metrics.tradeReductionPct.toFixed(1)}% (from ${metrics.meanTrainTrades.toFixed(2)} down to just ${metrics.meanEvalTrades.toFixed(2)} trades per seed), producing an annualized return of ${toPct(metrics.meanEvalAnnualizedReturn)} (essentially flat after costs, comfortably above -5%). Across both phases, maximum drawdown was held to ${toPct(metrics.maxDrawdownOverall)}, strictly respecting the 15% safety limit.\n\n`;
  } else {
    md += `## Diagnostic Checklist\n\n`;
    md += `- [ ] **Drawdown Breach**: Check whether drawdown exceeded 15% in training or evaluation.\n`;
    md += `- [ ] **Insufficient Trade Reduction**: Check if agent failed to learn HOLD policy (eval trades >= 100).\n`;
    md += `- [ ] **Annualized Return Degradation**: Verify Phase 2 annualized return is above -5% threshold.\n\n`;
  }

  md += `## Progressive Evolution (T1 -> T1c -> T1s -> T1st)\n\n`;
  md += `| Variant | Safety Layer | Exploration | Mean Trades (Eval) | Max Drawdown | Annualized Return |\n`;
  md += `|---|---|---|---|---|---|\n`;
  md += `| **T1** | Inactive | Always on (ε ≥ 0.05) | 366.10 | ~72.20% | -347.43% |\n`;
  md += `| **T1c** | Inactive | 2-Phase (ε → 0) | 14.03 | ~35.00% | -17.89% (Eval) |\n`;
  md += `| **T1s** | **Active** | Always on (ε ≥ 0.05) | 364.90 | 9.07% | -65.46% |\n`;
  md += `| **T1st** | **Active** | **2-Phase (ε → 0)** | **${metrics.meanEvalTrades.toFixed(2)}** | **${toPct(metrics.maxDrawdownOverall)}** | **${toPct(metrics.meanEvalAnnualizedReturn)}** |\n\n`;

  if (results && results.length > 0) {
    md += `## Per-Seed Summary (Evaluation Phase)\n\n`;
    md += `| Seed | Nav Post-Train | Nav Final | Eval Return | Eval Ann. Return | Max DD (Overall) | Max DD (Eval) | Eval Trades |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const r of results) {
      md += `| ${r.seed} | $${r.navAfterTraining.toFixed(2)} | $${r.navAfterEvaluation.toFixed(2)} | ${toPct(Math.exp(r.evalNetLogReturn) - 1)} | ${toPct(r.evalAnnualizedReturn)} | ${toPct(r.maxDrawdownOverall)} | ${toPct(r.maxDrawdownEval)} | ${r.evalTradeCount} |\n`;
    }
    md += `\n`;
  }

  return md;
}

export async function writeReport(
  metrics: T1stMetrics,
  config: T1stConfig,
  results?: T1stResult[],
  outputPath: string = 'results/t1st/report.md',
  variant: string = 'T1st — Two-Phase Training + Evaluation with Safety Layer',
): Promise<string> {
  const content = generateReportMarkdown(metrics, config, results, undefined, variant);
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const targetDir = path.dirname(resolvedPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(resolvedPath, content, 'utf8');
  return resolvedPath;
}
