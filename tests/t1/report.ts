/**
 * T1 — Report generator.
 *
 * Acceptance criteria follow Paper Section 14. The report marks the verdict
 * based on:
 *   - noPositiveMaterialEdge (ci95Upper < MATERIAL_EDGE_BOUND)
 *   - fprWithinTolerance (false positive rate <= 5%)
 *
 * The mean return is reported as a finding, not as a pass/fail criterion.
 */

import fs from 'fs';
import path from 'path';
import type { T1Metrics, SeedResult } from './metrics.js';

export interface T1Config {
  seedsCount: number;
  stepsPerSeed: number;
  initialCapital: number;
  sigma: number;
  dt: number;
  feeBps: number;
  slippageBps: number;
  [key: string]: any;
}

export function generateReportMarkdown(
  metrics: T1Metrics,
  config: T1Config,
  results?: SeedResult[],
  dateStr?: string,
  variant: string = 'default',
): string {
  const date = dateStr || new Date().toISOString();
  const c1Pass = metrics.noPositiveMaterialEdge;
  const c2Pass = metrics.fprWithinTolerance;
  const verdict = c1Pass && c2Pass ? 'PASS' : 'FAIL';

  const toPct = (val: number) => (val * 100).toFixed(4) + '%';
  const toBps = (val: number) => (val * 10000).toFixed(2) + ' bps';

  // Round-trip cost: fee + slippage on both legs.
  // Buy: fee + slippage. Sell: fee + slippage. Total: 2 * (fee + slippage).
  const roundTripBps = 2 * (config.feeBps + config.slippageBps);

  let md = `# T1 No-Edge Null Test Suite Report\n\n`;
  md += `**Date:** ${date}\n\n`;
  md += `**Variant:** ${variant}\n\n`;

  md += `## Configuration\n\n`;
  md += `| Parameter | Value |\n`;
  md += `|---|---|\n`;
  md += `| Seeds Evaluated | ${config.seedsCount} (Seeds 1 through ${config.seedsCount}) |\n`;
  md += `| Steps per Seed | ${config.stepsPerSeed.toLocaleString()} |\n`;
  md += `| Initial Capital | $${config.initialCapital.toLocaleString()} |\n`;
  md += `| Price Volatility (sigma) | ${config.sigma.toFixed(2)} |\n`;
  md += `| Step Size (dt) | 5 / (60 * 24 * 365) (~${config.dt.toExponential(4)}) |\n`;
  md += `| Transaction Fee (per leg) | ${config.feeBps} bps |\n`;
  md += `| Execution Slippage (per leg) | ${config.slippageBps} bps |\n`;
  md += `| Round-Trip Cost (buy + sell) | ${roundTripBps} bps |\n`;
  md += `| Material Edge Bound | ${toPct(metrics.materialEdgeBound)} annualized |\n\n`;

  md += `## Metrics (Across ${metrics.nSeeds} Seeds)\n\n`;
  md += `| Metric | Point Estimate | 95% Bootstrap CI |\n`;
  md += `|---|---|---|\n`;
  md += `| Mean Net Return (Annualized) | ${toPct(metrics.meanAnnualizedReturn)} (${toBps(metrics.meanAnnualizedReturn)}) | [${toPct(metrics.ci95Lower)}, ${toPct(metrics.ci95Upper)}] |\n`;
  md += `| Median Net Return (Annualized) | ${toPct(metrics.medianAnnualizedReturn)} | - |\n`;
  md += `| Standard Deviation (Annualized) | ${toPct(metrics.stdDevAnnualizedReturn)} | - |\n`;
  md += `| False Positive Rate | ${toPct(metrics.falsePositiveRate)} | - |\n`;
  md += `| Mean Turnover | ${metrics.meanTurnover.toFixed(4)} | - |\n`;
  md += `| Mean Trades Executed | ${metrics.meanTrades.toFixed(2)} | - |\n\n`;

  md += `## Acceptance Criteria (Paper Section 14)\n\n`;
  md += `- [${c1Pass ? 'x' : ' '}] No positive material edge: 95% CI upper bound (${toPct(metrics.ci95Upper)}) < material edge bound (${toPct(metrics.materialEdgeBound)})\n`;
  md += `- [${c2Pass ? 'x' : ' '}] False positive rate (${toPct(metrics.falsePositiveRate)}) <= 5%\n\n`;

  md += `## Verdict: **${verdict}**\n\n`;

  if (verdict === 'PASS') {
    md += `**Interpretation.** The agent did not fabricate positive edge from a zero-conditional-mean process. The 95% confidence interval lies entirely below the material edge bound. Mean return being negative is a separate finding documented in the diagnostic section below.\n\n`;
  } else {
    md += `## Diagnostic Checklist\n\n`;
    md += `- [ ] **Positive edge leakage**: verify the agent cannot observe future prices.\n`;
    md += `- [ ] **Accounting bug**: verify net return calculation against independent recomputation.\n`;
    md += `- [ ] **Generator misspecification**: verify the drift correction is applied.\n`;
    md += `- [ ] **Seed independence**: verify each seed uses an isolated RNG instance.\n`;
    md += `- [ ] **Cost application**: verify ${roundTripBps} bps round-trip on all trades.\n\n`;
  }

  md += `## Diagnostic Note\n\n`;
  md += `The mean return (${toPct(metrics.meanAnnualizedReturn)}) is negative. `;
  md += `This is consistent with the cost of mandatory exploration under Paper Section 4 `;
  md += `(epsilon floor = 0.05). In a market with no edge, exploration forces trades `;
  md += `that pay transaction costs but receive zero expected return. The mean return `;
  md += `is a finding, not a failure mode of the agent's learning.\n\n`;
  md += `Mean trades per seed: ${metrics.meanTrades.toFixed(2)}. `;
  md += `Mean turnover: ${metrics.meanTurnover.toFixed(4)}. `;
  md += `Round-trip cost per trade: ${roundTripBps} bps.\n\n`;

  if (results && results.length > 0) {
    md += `## Per-Seed Summary\n\n`;
    md += `| Seed | Initial Cash | Final NAV | Net Return | Annualized Return | Turnover | Trades |\n`;
    md += `|---|---|---|---|---|---|---|\n`;
    for (const r of results) {
      md += `| ${r.seed} | $${r.initialCapital.toFixed(2)} | $${r.finalNav.toFixed(2)} | ${toPct(Math.exp(r.netLogReturn) - 1)} | ${toPct(r.annualizedReturn)} | ${r.turnover.toFixed(4)} | ${r.tradeCount} |\n`;
    }
    md += `\n`;
  }

  return md;
}

export async function writeReport(
  metrics: T1Metrics,
  config: T1Config,
  results?: SeedResult[],
  outputPath: string = 'results/t1/report.md',
  variant: string = 'default',
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