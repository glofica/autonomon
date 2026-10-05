/**
 * T3 — Regime Change Adaptation Test Entry Point
 *
 * Usage:
 *   bun run tests/t3/run.ts
 */

import { runT3 } from './runner.js';

async function main() {
  console.log('Running T3: Regime Change Adaptation Test (Paper §14 & Proposition 8)...\n');
  const report = await runT3();

  console.log('=== Parameter Change at tau = 25,000 ===');
  console.log('  Phase 1 (t < 25k):  q = 0.80, driftBull = +0.08, driftBear = -0.08');
  console.log('  Phase 2 (t >= 25k): q = 0.30, driftBull = -0.10, driftBear = +0.10');

  console.log('\n=== Optimal Policy Ground Truth ===');
  console.log('  State        | Phase 1 pi*_1    | Phase 2 pi*_2');
  console.log('  -------------+------------------+------------------');
  for (const [state, a1] of Object.entries(report.viPhase1.optimalPolicy)) {
    const a2 = report.viPhase2.optimalPolicy[state];
    console.log(`  ${state.padEnd(12)} | ${a1.padEnd(16)} | ${a2}`);
  }

  console.log('\n=== Three-Arm Adaptation Comparison (Across 30 Seeds) ===');
  const { constant, diminishing, frozen } = report.metrics.arms;

  console.log(`  Constant Step (alpha = 0.10):`);
  console.log(`    Median Adaptation Delay:    ${constant.adaptationDelayMedian !== null ? constant.adaptationDelayMedian.toFixed(1) : 'Censored'} steps (95% CI: [${constant.adaptationDelayCi95[0].toFixed(1)}, ${constant.adaptationDelayCi95[1].toFixed(1)}]) [Threshold: < 5000]`);
  console.log(`    Mean Cumulative Regret:     ${constant.cumulativeRegretMean.toFixed(1)} (95% CI: [${constant.cumulativeRegretCi95[0].toFixed(1)}, ${constant.cumulativeRegretCi95[1].toFixed(1)}])`);
  console.log(`    Censored Runs:              ${constant.censoredCount} / ${constant.nSeeds} (${(constant.censoredRate * 100).toFixed(1)}%)`);

  console.log(`\n  Diminishing Step (alpha_n = n^-0.7):`);
  console.log(`    Median Adaptation Delay:    ${diminishing.adaptationDelayMedian !== null ? diminishing.adaptationDelayMedian.toFixed(1) : 'Censored'} steps (95% CI: [${diminishing.adaptationDelayCi95[0].toFixed(1)}, ${diminishing.adaptationDelayCi95[1].toFixed(1)}])`);
  console.log(`    Mean Cumulative Regret:     ${diminishing.cumulativeRegretMean.toFixed(1)} (95% CI: [${diminishing.cumulativeRegretCi95[0].toFixed(1)}, ${diminishing.cumulativeRegretCi95[1].toFixed(1)}])`);
  console.log(`    Censored Runs:              ${diminishing.censoredCount} / ${diminishing.nSeeds} (${(diminishing.censoredRate * 100).toFixed(1)}%)`);

  console.log(`\n  Frozen Baseline (alpha = 0):`);
  console.log(`    Median Adaptation Delay:    ${frozen.adaptationDelayMedian !== null ? frozen.adaptationDelayMedian.toFixed(1) : 'Censored'}`);
  console.log(`    Mean Cumulative Regret:     ${frozen.cumulativeRegretMean.toFixed(1)} (95% CI: [${frozen.cumulativeRegretCi95[0].toFixed(1)}, ${frozen.cumulativeRegretCi95[1].toFixed(1)}])`);
  console.log(`    Censored Runs:              ${frozen.censoredCount} / ${frozen.nSeeds} (${(frozen.censoredRate * 100).toFixed(1)}%) [Expected: 100%]`);

  console.log(`\n=== Verdict: ${report.passed ? 'PASS' : 'FAIL'} ===`);
  console.log(`Report written to: ${report.reportPath}`);

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('T3 execution failed with error:', err);
  process.exit(1);
});
