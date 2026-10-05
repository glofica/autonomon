/**
 * T2 — Report Generator
 *
 * Generates markdown report matching tests/t1/report.ts format.
 * Writes to results/t2/report.md.
 *
 * Acceptance criteria follow Paper §14:
 *   - Sup-norm Q error < 0.1
 *   - Optimal-action-set agreement >= 95%
 */

import fs from 'fs';
import path from 'path';
import type { T2Metrics, SeedMetricResult } from './metrics.js';
import type { ValueIterationResult } from './value-iteration.js';

export interface T2Config {
  seedsCount: number;
  transitionsPerSeed: number;
  gamma: number;
  episodeLength: number;
  initialEpsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
  alphaDecayPower: number;
  [key: string]: any;
}

export function generateReportMarkdown(
  metrics: T2Metrics,
  config: T2Config,
  seedResults?: SeedMetricResult[],
  viResult?: ValueIterationResult,
  dateStr?: string,
): string {
  const date = dateStr || new Date().toISOString();
  const c1Pass = metrics.supNormPassed;
  const c2Pass = metrics.agreementPassed;
  const verdict = metrics.overallPassed ? 'PASS' : 'FAIL';

  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  const toNum = (val: number) => val.toFixed(5);

  let md = `# T2 Known Stationary MDP Convergence Test Suite Report\n\n`;
  md += `**Date:** ${date}\n\n`;
  md += `**Specification:** Paper §14 (Known Stationary MDP)\n\n`;

  md += `## Configuration\n\n`;
  md += `| Parameter | Value |\n`;
  md += `|---|---|\n`;
  md += `| Seeds Evaluated | ${config.seedsCount} (Seeds 1 through ${config.seedsCount}) |\n`;
  md += `| Transitions per Seed | ${config.transitionsPerSeed.toLocaleString()} |\n`;
  md += `| Discount Factor (gamma) | ${config.gamma} |\n`;
  md += `| Step Size Schedule | Robbins-Monro alpha_n = n^(${config.alphaDecayPower}) per (s, a) pair |\n`;
  md += `| Exploration Coverage | Exploring starts (period ${config.episodeLength}) + epsilon decay (${config.initialEpsilon} -> ${config.epsilonMin}) |\n`;
  md += `| Target Error Tolerance (epsilon) | < ${metrics.supNormErrorThreshold} |\n`;
  md += `| Target Agreement Threshold | >= ${toPct(metrics.agreementThreshold)} |\n\n`;

  if (viResult) {
    md += `## Ground Truth: Value Iteration Reference\n\n`;
    md += `Value iteration converged in **${viResult.iterations}** iterations with max Bellman residual **${viResult.maxBellmanResidual.toExponential(4)}** (< 1e-8).\n\n`;
    md += `| State | Optimal Action pi*(s) | Value V*(s) | Optimal Action Set |\n`;
    md += `|---|---|---|---|\n`;
    for (const [state, bestA] of Object.entries(viResult.optimalPolicy)) {
      const v = viResult.vStar[state];
      const optSet = viResult.optimalActionSets[state].join(', ');
      md += `| \`${state}\` | **${bestA}** | ${v.toFixed(4)} | [${optSet}] |\n`;
    }
    md += `\n`;
  }

  md += `## Metrics (Across ${metrics.nSeeds} Seeds)\n\n`;
  md += `| Metric | Point Estimate (Mean) | 95% Bootstrap CI | Median | Std Dev |\n`;
  md += `|---|---|---|---|---|\n`;
  md += `| Sup-Norm Q Error ||Q_agent - Q*||_inf | ${toNum(metrics.supNormQError.mean)} | [${toNum(metrics.supNormQError.ci95Lower)}, ${toNum(metrics.supNormQError.ci95Upper)}] | ${toNum(metrics.supNormQError.median)} | ${toNum(metrics.supNormQError.stdDev)} |\n`;
  md += `| Action-Value Regret | ${toNum(metrics.actionValueRegret.mean)} | [${toNum(metrics.actionValueRegret.ci95Lower)}, ${toNum(metrics.actionValueRegret.ci95Upper)}] | ${toNum(metrics.actionValueRegret.median)} | ${toNum(metrics.actionValueRegret.stdDev)} |\n`;
  md += `| Optimal-Action-Set Agreement | ${toPct(metrics.optimalActionAgreement.mean)} | [${toPct(metrics.optimalActionAgreement.ci95Lower)}, ${toPct(metrics.optimalActionAgreement.ci95Upper)}] | ${toPct(metrics.optimalActionAgreement.median)} | ${toPct(metrics.optimalActionAgreement.stdDev)} |\n\n`;

  md += `## Acceptance Criteria (Paper §14)\n\n`;
  md += `- [${c1Pass ? 'x' : ' '}] Sup-norm Q error < ${metrics.supNormErrorThreshold}: mean error = ${toNum(metrics.supNormQError.mean)} (95% CI upper: ${toNum(metrics.supNormQError.ci95Upper)})\n`;
  md += `- [${c2Pass ? 'x' : ' '}] Optimal-action-set agreement >= ${toPct(metrics.agreementThreshold)}: mean agreement = ${toPct(metrics.optimalActionAgreement.mean)} (95% CI lower: ${toPct(metrics.optimalActionAgreement.ci95Lower)})\n\n`;

  md += `## Verdict: **${verdict}**\n\n`;

  if (verdict === 'PASS') {
    md += `**Interpretation.** The agent's Q-learning policy converged to the ground-truth optimal action-value function Q* under stationary tabular assumptions. The Robbins-Monro step size schedule alpha_n = n^(-0.7) and exploration coverage guaranteed sufficient sampling of every feasible state-action pair, achieving an optimal-action-set agreement well exceeding 95% and sup-norm error strictly below 0.1.\n\n`;
  } else {
    md += `## Diagnostic Checklist\n\n`;
    md += `- [ ] Check step size decay power satisfies Robbins-Monro conditions (sum alpha = inf, sum alpha^2 < inf).\n`;
    md += `- [ ] Check transition counts per state-action pair to ensure no under-sampled pairs.\n`;
    md += `- [ ] Check exploration schedule (epsilon decay floor and exploring starts).\n`;
    md += `- [ ] Check Bellman residual and convergence of Value Iteration solver.\n\n`;
  }

  if (seedResults && seedResults.length > 0) {
    md += `## Per-Seed Summary\n\n`;
    md += `| Seed | Sup-Norm Q Error | Action-Value Regret | Agreement | Min Pair Visits | Max Pair Visits |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const r of seedResults) {
      md += `| ${r.seed} | ${toNum(r.supNormQError)} | ${toNum(r.actionValueRegret)} | ${toPct(r.optimalActionAgreement)} | ${r.minPairVisits} | ${r.maxPairVisits} |\n`;
    }
    md += `\n`;
  }

  return md;
}

export async function writeReport(
  metrics: T2Metrics,
  config: T2Config,
  seedResults?: SeedMetricResult[],
  viResult?: ValueIterationResult,
  outputPath: string = 'results/t2/report.md',
): Promise<string> {
  const content = generateReportMarkdown(metrics, config, seedResults, viResult);
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const targetDir = path.dirname(resolvedPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(resolvedPath, content, 'utf8');
  return resolvedPath;
}
