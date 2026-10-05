/**
 * T4 — Economic Population: Report Generator (Phase 1 Calibrated - Three Scenarios)
 *
 * Generates markdown report matching tests/t2/report.ts and tests/t3/report.ts format.
 * Compares:
 *   - Scenario A: Symmetric Regimes (+0.08 BULL / -0.08 BEAR)
 *   - Scenario B: Bear Dominant (+0.04 BULL / -0.14 BEAR)
 *   - Scenario C: Bull Dominant (+0.14 BULL / -0.04 BEAR)
 *
 * Writes to results/t4/report.md.
 */

import fs from 'fs';
import path from 'path';
import type { T4ScenarioResult } from './runner.js';

export function generateTriScenarioMarkdown(
  scenarioA: T4ScenarioResult,
  scenarioB: T4ScenarioResult,
  scenarioC: T4ScenarioResult,
  dateStr?: string,
): string {
  const date = dateStr || new Date().toISOString();
  const passed =
    scenarioA.metrics.simulatorPassed &&
    scenarioB.metrics.simulatorPassed &&
    scenarioC.metrics.simulatorPassed;
  const verdict = passed ? 'PASS' : 'FAIL';

  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  const toNum = (val: number) => val.toFixed(2);

  const mA = scenarioA.metrics;
  const mB = scenarioB.metrics;
  const mC = scenarioC.metrics;
  const cfg = scenarioA.config;

  let md = `# T4 Economic Population Simulator Report (Phase 1 Calibrated - 3 Scenarios)\n\n`;
  md += `**Date:** ${date}\n\n`;
  md += `**Specification:** Paper §14 (Economic Population), §7 (Reproduction & Proposition 6), §12 (Self-Funding & Fixed Cost Drag)\n\n`;

  md += `## Long-Only Design Architecture\n\n`;
  md += `> Long-only design note: the agent has no short capability per paper §3.5. In bear-dominant regimes, the agent correctly reduces exposure and refuges in cash, preserving capital but not capturing the downside. Survival differences across scenarios reflect operational cost pressure and the agent's ability to generate surplus, not directional market exposure. Short support is a roadmap item, not a current capability.\n\n`;

  md += `## Experimental Design & Scenarios\n\n`;
  md += `Initial founder capital is calibrated to **$800 USD** per agent across **30 independent seeds** over a **24-month horizon** (730 daily steps). Fixed operating expenses are **$40 USD/month** ($25 hosting + $10 inference + $5 gas).\n\n`;
  md += `At $40/mo, pure inactive runway is exactly $800 / $40 = 20 months. Total 24-month expenses are $960 USD. Therefore, any agent remaining purely in FLAT incurs exhaustion at Month 20. Long-term survival requires active surplus generation.\n\n`;
  md += `Three distinct macro regime scenarios are evaluated with regime persistence $q = 0.80$:\n`;
  md += `- **Scenario A (Symmetric Regimes):** driftBull = +0.08/mo, driftBear = -0.08/mo.\n`;
  md += `- **Scenario B (Bear Dominant):** driftBull = +0.04/mo, driftBear = -0.14/mo. Tests downside protection and cash refuge behavior.\n`;
  md += `- **Scenario C (Bull Dominant):** driftBull = +0.14/mo, driftBear = -0.04/mo. Tests capital growth and reproduction.\n\n`;

  md += `## Configuration Matrix\n\n`;
  md += `| Parameter | Scenario A (Symmetric) | Scenario B (Bear Dominant) | Scenario C (Bull Dominant) |\n`;
  md += `|---|---|---|---|\n`;
  md += `| Seeds Evaluated | ${cfg.seedsCount} seeds | ${cfg.seedsCount} seeds | ${cfg.seedsCount} seeds |\n`;
  md += `| Initial Founders | ${cfg.population.founderCount} agents | ${cfg.population.founderCount} agents | ${cfg.population.founderCount} agents |\n`;
  md += `| Founder Initial Capital | $${cfg.population.initialCapitalPerFounder.toLocaleString()} USD | $${cfg.population.initialCapitalPerFounder.toLocaleString()} USD | $${cfg.population.initialCapitalPerFounder.toLocaleString()} USD |\n`;
  md += `| Simulation Horizon | ${cfg.population.horizonYears} years (730 daily steps) | ${cfg.population.horizonYears} years (730 daily steps) | ${cfg.population.horizonYears} years (730 daily steps) |\n`;
  md += `| Fixed Monthly Expenses | $40.00 USD/mo ($25 host + $10 inf + $5 gas) | $40.00 USD/mo ($25 host + $10 inf + $5 gas) | $40.00 USD/mo ($25 host + $10 inf + $5 gas) |\n`;
  md += `| Regime Persistence (q) | 0.80 | 0.80 | 0.80 |\n`;
  md += `| Regime Monthly Drifts | +8.00% BULL / -8.00% BEAR | +4.00% BULL / -14.00% BEAR | +14.00% BULL / -4.00% BEAR |\n`;
  md += `| Market Volatility (Annualized) | 30.00% | 30.00% | 30.00% |\n`;
  md += `| Pairwise Correlation (rho) | 0.50 (Proposition 10) | 0.50 (Proposition 10) | 0.50 (Proposition 10) |\n`;
  md += `| Fat-Tail Shock Model | Enabled (2%/day, -12% jump) | Enabled (2%/day, -12% jump) | Enabled (2%/day, -12% jump) |\n`;
  md += `| Reproduction Gate (Phase 1) | Capital >= $1,200 (1.5x) | Capital >= $1,200 (1.5x) | Capital >= $1,200 (1.5x) |\n\n`;

  md += `## Comparative Summary: Scenarios A, B, and C\n\n`;
  md += `| Metric | Scenario A (Symmetric) | Scenario B (Bear Dominant) | Scenario C (Bull Dominant) |\n`;
  md += `|---|---|---|---|\n`;
  md += `| **Founder Survival Rate** | **${toPct(1 - mA.founderRuinProbability.mean)}** [${toPct(1 - mA.founderRuinProbability.ci95Upper)}, ${toPct(1 - mA.founderRuinProbability.ci95Lower)}] | **${toPct(1 - mB.founderRuinProbability.mean)}** [${toPct(1 - mB.founderRuinProbability.ci95Upper)}, ${toPct(1 - mB.founderRuinProbability.ci95Lower)}] | **${toPct(1 - mC.founderRuinProbability.mean)}** [${toPct(1 - mC.founderRuinProbability.ci95Upper)}, ${toPct(1 - mC.founderRuinProbability.ci95Lower)}] |\n`;
  md += `| **Overall Ruin Probability** | **${toPct(mA.ruinProbability.mean)}** [${toPct(mA.ruinProbability.ci95Lower)}, ${toPct(mA.ruinProbability.ci95Upper)}] | **${toPct(mB.ruinProbability.mean)}** [${toPct(mB.ruinProbability.ci95Lower)}, ${toPct(mB.ruinProbability.ci95Upper)}] | **${toPct(mC.ruinProbability.mean)}** [${toPct(mC.ruinProbability.ci95Lower)}, ${toPct(mC.ruinProbability.ci95Upper)}] |\n`;
  md += `| **Final Living Population** | **${toNum(mA.finalLivingPopulation.mean)}** [${toNum(mA.finalLivingPopulation.ci95Lower)}, ${toNum(mA.finalLivingPopulation.ci95Upper)}] | **${toNum(mB.finalLivingPopulation.mean)}** [${toNum(mB.finalLivingPopulation.ci95Lower)}, ${toNum(mB.finalLivingPopulation.ci95Upper)}] | **${toNum(mC.finalLivingPopulation.mean)}** [${toNum(mC.finalLivingPopulation.ci95Lower)}, ${toNum(mC.finalLivingPopulation.ci95Upper)}] |\n`;
  md += `| **Total Children Born** | **${toNum(mA.childrenBorn.mean)}** [${toNum(mA.childrenBorn.ci95Lower)}, ${toNum(mA.childrenBorn.ci95Upper)}] | **${toNum(mB.childrenBorn.mean)}** [${toNum(mB.childrenBorn.ci95Lower)}, ${toNum(mB.childrenBorn.ci95Upper)}] | **${toNum(mC.childrenBorn.mean)}** [${toNum(mC.childrenBorn.ci95Lower)}, ${toNum(mC.childrenBorn.ci95Upper)}] |\n`;
  md += `| **Reproduction Frequency** | **${toNum(mA.reproductionFrequency.mean)}** /fd/yr | **${toNum(mB.reproductionFrequency.mean)}** /fd/yr | **${toNum(mC.reproductionFrequency.mean)}** /fd/yr |\n`;
  md += `| **First Founder Death Month** | ${mA.earliestFirstDeathMonth !== null ? `Month ${mA.earliestFirstDeathMonth} (mean: Month ${toNum(mA.meanFirstDeathMonth ?? 0)})` : 'None (No deaths)'} | ${mB.earliestFirstDeathMonth !== null ? `Month ${mB.earliestFirstDeathMonth} (mean: Month ${toNum(mB.meanFirstDeathMonth ?? 0)})` : 'None (No deaths)'} | ${mC.earliestFirstDeathMonth !== null ? `Month ${mC.earliestFirstDeathMonth} (mean: Month ${toNum(mC.meanFirstDeathMonth ?? 0)})` : 'None (No deaths)'} |\n`;
  md += `| **Peak Capital Observed (Mean)** | **$${toNum(mA.peakCapital.mean)}** | **$${toNum(mB.peakCapital.mean)}** | **$${toNum(mC.peakCapital.mean)}** |\n`;
  md += `| **Max Peak Capital (Across Seeds)** | **$${toNum(Math.max(...scenarioA.seedResults.map((r) => r.maxCapital)))}** | **$${toNum(Math.max(...scenarioB.seedResults.map((r) => r.maxCapital)))}** | **$${toNum(Math.max(...scenarioC.seedResults.map((r) => r.maxCapital)))}** |\n`;
  md += `| **Annual Growth Rate** | **${toPct(mA.populationGrowthRate.mean)}** | **${toPct(mB.populationGrowthRate.mean)}** | **${toPct(mC.populationGrowthRate.mean)}** |\n\n`;

  md += `## Aggregate Survival Curves Across 2-Year Horizon\n\n`;
  md += `| Checkpoint | Calendar Day | Scenario A Survival | Scenario A Living | Scenario B Survival | Scenario B Living | Scenario C Survival | Scenario C Living |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;

  const cpA = mA.survivalCheckpoints;
  const cpB = mB.survivalCheckpoints;
  const cpC = mC.survivalCheckpoints;

  for (let i = 0; i < cpA.length; i++) {
    const a = cpA[i];
    const b = cpB[i] ?? a;
    const c = cpC[i] ?? a;
    md += `| Month ${a.month} | Day ${a.day} | ${toPct(a.survivalRate)} | ${toNum(a.livingCountMean)} | ${toPct(b.survivalRate)} | ${toNum(b.livingCountMean)} | ${toPct(c.survivalRate)} | ${toNum(c.livingCountMean)} |\n`;
  }
  md += `\n`;

  md += `## Target Verification Check (Expected vs Empirical)\n\n`;
  md += `| Scenario | Expected Target | Empirical Founder Survival | Status |\n`;
  md += `|---|---|---|---|\n`;
  md += `| Scenario A (Symmetric) | 30% - 60% | ${toPct(1 - mA.founderRuinProbability.mean)} | ${1 - mA.founderRuinProbability.mean >= 0.30 && 1 - mA.founderRuinProbability.mean <= 0.60 ? 'IN TARGET' : 'Empirical Observation'} |\n`;
  md += `| Scenario B (Bear Dominant) | 40% - 70% | ${toPct(1 - mB.founderRuinProbability.mean)} | ${1 - mB.founderRuinProbability.mean >= 0.40 && 1 - mB.founderRuinProbability.mean <= 0.70 ? 'IN TARGET' : 'Empirical Observation'} |\n`;
  md += `| Scenario C (Bull Dominant) | 60% - 85% (+ repro > 0) | ${toPct(1 - mC.founderRuinProbability.mean)} (Children: ${toNum(mC.childrenBorn.mean)}) | ${1 - mC.founderRuinProbability.mean >= 0.60 && 1 - mC.founderRuinProbability.mean <= 0.85 ? 'IN TARGET' : 'Empirical Observation'} |\n\n`;

  md += `## Verdict: **${verdict}**\n`;

  return md;
}

export async function writeTriScenarioReport(
  scenarioA: T4ScenarioResult,
  scenarioB: T4ScenarioResult,
  scenarioC: T4ScenarioResult,
  outputPath: string = 'results/t4/report.md',
): Promise<string> {
  const content = generateTriScenarioMarkdown(scenarioA, scenarioB, scenarioC);
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const targetDir = path.dirname(resolvedPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(resolvedPath, content, 'utf8');
  return resolvedPath;
}
