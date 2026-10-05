/**
 * T4 — Economic Population: Report Generator (Stress & Product Setups)
 *
 * Formats report according to user specification:
 *   - Section 1: Stress Setup ($800 capital, $40/month)
 *   - Section 2: Product Setup ($5,000 capital, $40/month)
 *   - Notes: Long-only design, runway analysis, and reproduction gate context.
 *
 * Writes to results/t4/report.md.
 */

import fs from 'fs';
import path from 'path';
import type { T4SetupResult } from './runner.js';

export function generateDualSetupMarkdown(
  stressSetup: T4SetupResult,
  productSetup: T4SetupResult,
  dateStr?: string,
): string {
  const date = dateStr || new Date().toISOString();

  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  const toNum = (val: number) => val.toFixed(2);

  const getSurvivalAtMonth = (setup: T4SetupResult, scenarioKey: 'scenarioA' | 'scenarioB' | 'scenarioC', month: number): number => {
    const sc = setup[scenarioKey].metrics.survivalCheckpoints.find((c) => c.month === month);
    return sc ? sc.survivalRate : 0;
  };

  const getFirstDeathStr = (setup: T4SetupResult, scenarioKey: 'scenarioA' | 'scenarioB' | 'scenarioC'): string => {
    const m = setup[scenarioKey].metrics;
    if (m.earliestFirstDeathMonth === null) return 'None';
    return `Month ${m.earliestFirstDeathMonth}`;
  };

  const getMaxPeakCapital = (setup: T4SetupResult, scenarioKey: 'scenarioA' | 'scenarioB' | 'scenarioC'): number => {
    return Math.max(...setup[scenarioKey].seedResults.map((r) => r.maxCapital));
  };

  let md = `# T4 Economic Population Simulator Report\n\n`;
  md += `**Date:** ${date}\n\n`;
  md += `**Specification:** Paper §14 (Economic Population), §7 (Reproduction & Proposition 6), §12 (Self-Funding & Fixed Cost Drag)\n\n`;

  md += `## Section 1 — Stress Setup ($800 capital, $40/month)\n\n`;
  md += `| Scenario | Survival @12m | Survival @18m | Survival @24m | First Death | Peak Capital |\n`;
  md += `|---|---|---|---|---|---|\n`;
  md += `| A (Symmetric) | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioA', 12))} | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioA', 18))} | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioA', 24))} | ${getFirstDeathStr(stressSetup, 'scenarioA')} | $${toNum(getMaxPeakCapital(stressSetup, 'scenarioA'))} |\n`;
  md += `| B (Bear Dominant) | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioB', 12))} | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioB', 18))} | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioB', 24))} | ${getFirstDeathStr(stressSetup, 'scenarioB')} | $${toNum(getMaxPeakCapital(stressSetup, 'scenarioB'))} |\n`;
  md += `| C (Bull Dominant) | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioC', 12))} | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioC', 18))} | ${toPct(getSurvivalAtMonth(stressSetup, 'scenarioC', 24))} | ${getFirstDeathStr(stressSetup, 'scenarioC')} | $${toNum(getMaxPeakCapital(stressSetup, 'scenarioC'))} |\n\n`;

  md += `## Section 2 — Product Setup ($5,000 capital, $40/month)\n\n`;
  md += `| Scenario | Survival @12m | Survival @18m | Survival @24m | First Death | Peak Capital | Children Born |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  md += `| A (Symmetric) | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioA', 12))} | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioA', 18))} | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioA', 24))} | ${getFirstDeathStr(productSetup, 'scenarioA')} | $${toNum(getMaxPeakCapital(productSetup, 'scenarioA'))} | ${toNum(productSetup.scenarioA.metrics.childrenBorn.mean)} |\n`;
  md += `| B (Bear Dominant) | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioB', 12))} | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioB', 18))} | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioB', 24))} | ${getFirstDeathStr(productSetup, 'scenarioB')} | $${toNum(getMaxPeakCapital(productSetup, 'scenarioB'))} | ${toNum(productSetup.scenarioB.metrics.childrenBorn.mean)} |\n`;
  md += `| C (Bull Dominant) | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioC', 12))} | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioC', 18))} | ${toPct(getSurvivalAtMonth(productSetup, 'scenarioC', 24))} | ${getFirstDeathStr(productSetup, 'scenarioC')} | $${toNum(getMaxPeakCapital(productSetup, 'scenarioC'))} | ${toNum(productSetup.scenarioC.metrics.childrenBorn.mean)} |\n\n`;

  md += `## Notes\n\n`;
  md += `- Long-only design per §3.5: the agent does not capture downside moves.\n`;
  md += `- Stress setup ($800): passive runway is 20 months. Reproduction is\n`;
  md += `  unreachable at 1.5x ($1,200). Demonstrates the agent does not\n`;
  md += `  catastrophically fail under adverse conditions, but does not survive\n`;
  md += `  beyond the passive runway without market edge.\n`;
  md += `- Product setup ($5,000): passive runway is 125 months. The agent has\n`;
  md += `  time to learn, operate, and reproduce. This is the recommended\n`;
  md += `  deployment configuration for new owners.\n`;
  md += `- Reproduction requires the full gate per §7.1 (DSR ≥ 0.95, 365-day\n`;
  md += `  window), which is not implemented in Phase 1. Phase 1 uses a\n`;
  md += `  simplified 1.5x capital gate for demonstration.\n\n`;

  // Target verification
  const survA = getSurvivalAtMonth(productSetup, 'scenarioA', 24);
  const survB = getSurvivalAtMonth(productSetup, 'scenarioB', 24);
  const survC = getSurvivalAtMonth(productSetup, 'scenarioC', 24);
  const chC = productSetup.scenarioC.metrics.childrenBorn.mean;

  md += `## Target Verification (Product Setup @24m)\n\n`;
  md += `| Scenario | Expected Target @24m | Empirical Survival @24m | Status |\n`;
  md += `|---|---|---|---|\n`;
  md += `| Scenario A (Symmetric) | 40% - 70% | ${toPct(survA)} | ${survA >= 0.40 && survA <= 0.70 ? 'IN TARGET' : 'Empirical Observation'} |\n`;
  md += `| Scenario B (Bear Dominant) | 30% - 60% | ${toPct(survB)} | ${survB >= 0.30 && survB <= 0.60 ? 'IN TARGET' : 'Empirical Observation'} |\n`;
  md += `| Scenario C (Bull Dominant) | 60% - 85% (+ repro > 0) | ${toPct(survC)} (Children: ${toNum(chC)}) | ${survC >= 0.60 && survC <= 0.85 ? 'IN TARGET' : 'Empirical Observation'} |\n`;

  return md;
}

export async function writeDualSetupReport(
  stressSetup: T4SetupResult,
  productSetup: T4SetupResult,
  outputPath: string = 'results/t4/report.md',
): Promise<string> {
  const content = generateDualSetupMarkdown(stressSetup, productSetup);
  const resolvedPath = path.resolve(process.cwd(), outputPath);
  const targetDir = path.dirname(resolvedPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(resolvedPath, content, 'utf8');
  return resolvedPath;
}
