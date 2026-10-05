/**
 * T4 — Economic Population Simulator Entry Point (Phase 1 Skeleton)
 *
 * Usage:
 *   bun run tests/t4/run.ts
 */

import { runT4 } from './runner.js';

async function main() {
  console.log('Running T4: Economic Population Simulator — Phase 1 Skeleton (Paper §14)...\n');
  const report = await runT4();

  console.log('=== Aggregate Survival Curve (Across 30 Seeds) ===');
  for (const cp of report.metrics.survivalCheckpoints) {
    console.log(`  Month ${cp.month.toString().padStart(2)} (Day ${cp.day.toString().padStart(3)}): Founder Survival = ${(cp.survivalRate * 100).toFixed(1)}%, Living Population = ${cp.livingCountMean.toFixed(1)} agents`);
  }

  console.log('\n=== Population Statistics Across 30 Seeds ===');
  const m = report.metrics;
  console.log(`  Founder Ruin Probability:      ${(m.founderRuinProbability.mean * 100).toFixed(2)}% (95% CI: [${(m.founderRuinProbability.ci95Lower * 100).toFixed(2)}%, ${(m.founderRuinProbability.ci95Upper * 100).toFixed(2)}%])`);
  console.log(`  Overall Ruin Probability:      ${(m.ruinProbability.mean * 100).toFixed(2)}% (95% CI: [${(m.ruinProbability.ci95Lower * 100).toFixed(2)}%, ${(m.ruinProbability.ci95Upper * 100).toFixed(2)}%])`);
  console.log(`  Final Living Population:       ${m.finalLivingPopulation.mean.toFixed(1)} agents (95% CI: [${m.finalLivingPopulation.ci95Lower.toFixed(1)}, ${m.finalLivingPopulation.ci95Upper.toFixed(1)}])`);
  console.log(`  Total Children Born:           ${m.childrenBorn.mean.toFixed(1)} (95% CI: [${m.childrenBorn.ci95Lower.toFixed(1)}, ${m.childrenBorn.ci95Upper.toFixed(1)}])`);
  console.log(`  Reproduction Frequency:        ${m.reproductionFrequency.mean.toFixed(2)} children/founder/yr (95% CI: [${m.reproductionFrequency.ci95Lower.toFixed(2)}, ${m.reproductionFrequency.ci95Upper.toFixed(2)}])`);
  console.log(`  Annual Population Growth:      ${(m.populationGrowthRate.mean * 100).toFixed(2)}% (95% CI: [${(m.populationGrowthRate.ci95Lower * 100).toFixed(2)}%, ${(m.populationGrowthRate.ci95Upper * 100).toFixed(2)}%])`);

  console.log(`\n=== Verdict: ${report.passed ? 'PASS' : 'FAIL'} ===`);
  console.log(`Report written to: ${report.reportPath}`);

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('T4 execution failed with error:', err);
  process.exit(1);
});
