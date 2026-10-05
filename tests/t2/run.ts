/**
 * T2 — Known Stationary MDP Convergence Test Entry Point
 *
 * Usage:
 *   bun run tests/t2/run.ts
 */

import { runT2 } from './runner.js';

async function main() {
  console.log('Running T2: Known Stationary MDP Convergence Test (Paper §14)...\n');
  const report = await runT2();

  console.log('=== Sanity Checks ===');
  for (const check of report.sanityChecks.checks) {
    console.log(`${check.passed ? '✓ OK' : '✗ FAIL'} ${check.name}: ${check.message}`);
  }

  console.log('\n=== Ground Truth Optimal Policy (Value Iteration) ===');
  for (const [state, action] of Object.entries(report.viResult.optimalPolicy)) {
    console.log(`  ${state} -> ${action} (V* = ${report.viResult.vStar[state].toFixed(4)})`);
  }

  console.log('\n=== T2 Metrics (Across 30 Seeds) ===');
  console.log(`  Sup-norm Q Error:            ${report.metrics.supNormQError.mean.toFixed(5)} (95% CI: [${report.metrics.supNormQError.ci95Lower.toFixed(5)}, ${report.metrics.supNormQError.ci95Upper.toFixed(5)}]) [Threshold: < ${report.metrics.supNormErrorThreshold}]`);
  console.log(`  Action-Value Regret:         ${report.metrics.actionValueRegret.mean.toFixed(5)} (95% CI: [${report.metrics.actionValueRegret.ci95Lower.toFixed(5)}, ${report.metrics.actionValueRegret.ci95Upper.toFixed(5)}])`);
  console.log(`  Optimal-Action Agreement:    ${(report.metrics.optimalActionAgreement.mean * 100).toFixed(2)}% (95% CI: [${(report.metrics.optimalActionAgreement.ci95Lower * 100).toFixed(2)}%, ${(report.metrics.optimalActionAgreement.ci95Upper * 100).toFixed(2)}%]) [Threshold: >= ${(report.metrics.agreementThreshold * 100).toFixed(2)}%]`);

  console.log(`\n=== Verdict: ${report.passed ? 'PASS' : 'FAIL'} ===`);
  console.log(`Report written to: ${report.reportPath}`);

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('T2 execution failed with error:', err);
  process.exit(1);
});
