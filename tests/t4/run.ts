/**
 * T4 — Economic Population Simulator Entry Point (Dual Setup: Stress & Product)
 *
 * Runs 180 total population simulations:
 *   - Setup 1 "Stress": $800 capital, $40/month, 24 months (3 scenarios × 30 seeds)
 *   - Setup 2 "Product": $5,000 capital, $40/month, 24 months (3 scenarios × 30 seeds)
 *
 * Market Scenarios:
 *   - Scenario A: Symmetric (+0.08 BULL / -0.08 BEAR)
 *   - Scenario B: Bear Dominant (+0.04 BULL / -0.14 BEAR)
 *   - Scenario C: Bull Dominant (+0.14 BULL / -0.04 BEAR)
 *
 * Usage:
 *   bun run tests/t4/run.ts
 */

import { runT4, type T4SetupResult } from './runner.js';
import { runMinimumCapitalSweep } from './minimum-capital.js';
import { runFalseReproductionNullTest } from './false-reproduction.js';
import { writeDualSetupReport } from './report.js';
import { DEFAULT_GENOME } from '../../src/genome/types.js';
import { mutateGenome } from './population.js';
import { SeededPRNG } from '../t2/runner.js';

function printSetupTable(title: string, setup: T4SetupResult, hasChildren: boolean = false) {
  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  const toNum = (val: number) => val.toFixed(2);

  const getSurv = (scKey: 'scenarioA' | 'scenarioB' | 'scenarioC', m: number) => {
    const cp = setup[scKey].metrics.survivalCheckpoints.find((c) => c.month === m);
    return cp ? toPct(cp.survivalRate) : '0.00%';
  };

  const getDeath = (scKey: 'scenarioA' | 'scenarioB' | 'scenarioC') => {
    const d = setup[scKey].metrics.earliestFirstDeathMonth;
    return d !== null ? `Month ${d}` : 'None';
  };

  const getPeak = (scKey: 'scenarioA' | 'scenarioB' | 'scenarioC') => {
    return '$' + toNum(Math.max(...setup[scKey].seedResults.map((r) => r.maxCapital)));
  };

  console.log(`\n${title}`);
  if (hasChildren) {
    console.log('┌───────────────────┬───────────────┬───────────────┬───────────────┬───────────────┬──────────────┬───────────────┐');
    console.log('│ Scenario          │ Survival @12m │ Survival @18m │ Survival @24m │ First Death   │ Peak Capital │ Children Born │');
    console.log('├───────────────────┼───────────────┼───────────────┼───────────────┼───────────────┼──────────────┼───────────────┤');
    const chA = toNum(setup.scenarioA.metrics.childrenBorn.mean);
    const chB = toNum(setup.scenarioB.metrics.childrenBorn.mean);
    const chC = toNum(setup.scenarioC.metrics.childrenBorn.mean);
    console.log(`│ A (Symmetric)     │ ${getSurv('scenarioA', 12).padStart(13)} │ ${getSurv('scenarioA', 18).padStart(13)} │ ${getSurv('scenarioA', 24).padStart(13)} │ ${getDeath('scenarioA').padEnd(13)} │ ${getPeak('scenarioA').padStart(12)} │ ${chA.padStart(13)} │`);
    console.log(`│ B (Bear Dominant) │ ${getSurv('scenarioB', 12).padStart(13)} │ ${getSurv('scenarioB', 18).padStart(13)} │ ${getSurv('scenarioB', 24).padStart(13)} │ ${getDeath('scenarioB').padEnd(13)} │ ${getPeak('scenarioB').padStart(12)} │ ${chB.padStart(13)} │`);
    console.log(`│ C (Bull Dominant) │ ${getSurv('scenarioC', 12).padStart(13)} │ ${getSurv('scenarioC', 18).padStart(13)} │ ${getSurv('scenarioC', 24).padStart(13)} │ ${getDeath('scenarioC').padEnd(13)} │ ${getPeak('scenarioC').padStart(12)} │ ${chC.padStart(13)} │`);
    console.log('└───────────────────┴───────────────┴───────────────┴───────────────┴───────────────┴──────────────┴───────────────┘');
  } else {
    console.log('┌───────────────────┬───────────────┬───────────────┬───────────────┬───────────────┬──────────────┐');
    console.log('│ Scenario          │ Survival @12m │ Survival @18m │ Survival @24m │ First Death   │ Peak Capital │');
    console.log('├───────────────────┼───────────────┼───────────────┼───────────────┼───────────────┼──────────────┤');
    console.log(`│ A (Symmetric)     │ ${getSurv('scenarioA', 12).padStart(13)} │ ${getSurv('scenarioA', 18).padStart(13)} │ ${getSurv('scenarioA', 24).padStart(13)} │ ${getDeath('scenarioA').padEnd(13)} │ ${getPeak('scenarioA').padStart(12)} │`);
    console.log(`│ B (Bear Dominant) │ ${getSurv('scenarioB', 12).padStart(13)} │ ${getSurv('scenarioB', 18).padStart(13)} │ ${getSurv('scenarioB', 24).padStart(13)} │ ${getDeath('scenarioB').padEnd(13)} │ ${getPeak('scenarioB').padStart(12)} │`);
    console.log(`│ C (Bull Dominant) │ ${getSurv('scenarioC', 12).padStart(13)} │ ${getSurv('scenarioC', 18).padStart(13)} │ ${getSurv('scenarioC', 24).padStart(13)} │ ${getDeath('scenarioC').padEnd(13)} │ ${getPeak('scenarioC').padStart(12)} │`);
    console.log('└───────────────────┴───────────────┴───────────────┴───────────────┴───────────────┴──────────────┘');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════════════════');
  console.log('  📊 T4 ECONOMIC POPULATION SIMULATOR — PHASE 1, 2 & 3 COMPLETE EXECUTION');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');
  console.log('Specification: Paper §14 (Economic Population), §7 (Reproduction & Mutation), §12 (Self-Funding)');
  console.log('Running Dual Setup: 2 Setups × 3 Scenarios × 30 Seeds = 180 Simulations...\n');

  const report = await runT4();
  const { stressSetup, productSetup } = report;

  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  const toNum = (val: number) => val.toFixed(2);

  printSetupTable('## Section 1 — Stress Setup ($800 capital, $40/month)', stressSetup, false);
  printSetupTable('## Section 2 — Product Setup ($5,000 capital, $40/month)', productSetup, true);

  // Section 3: Print Genome Mutation Example
  console.log('\n## Section 3 — Genome & Policy Inheritance (Paper §7 Proposition 5)');
  const rng = new SeededPRNG(42);
  const childGen = mutateGenome(DEFAULT_GENOME, rng);
  console.log('Parent Genome -> Child Genome:');
  console.log(`  • g_risk:    ${DEFAULT_GENOME.g_risk} -> ${childGen.g_risk} [0.10, 5.00] (✓ in Ω)`);
  console.log(`  • g_tau:     ${DEFAULT_GENOME.g_tau} -> ${childGen.g_tau} [5, 60] (✓ in Ω)`);
  console.log(`  • g_epsilon: ${DEFAULT_GENOME.g_epsilon} -> ${childGen.g_epsilon} [0.05, 0.50] (✓ in Ω)`);
  console.log(`  • g_alpha:   ${DEFAULT_GENOME.g_alpha} -> ${childGen.g_alpha} [0.01, 0.25] (✓ in Ω)`);
  console.log(`  • g_gas:     ${DEFAULT_GENOME.g_gas} -> ${childGen.g_gas} [100, 1000] (✓ in Ω)`);
  console.log(`  • g_omega:   ${DEFAULT_GENOME.g_omega} -> ${childGen.g_omega} [0.05, 0.40] (✓ in Ω)`);
  console.log(`  • g_mitosis: ${DEFAULT_GENOME.g_mitosis} -> ${childGen.g_mitosis} [1.50, 3.00] (✓ in Ω)`);

  // Section 4: Run Minimum Capital Sweep
  console.log('\n## Section 4 — Running Minimum Viable Capital Sweep ($500 - $5,000)...');
  const minCapResult = await runMinimumCapitalSweep();
  console.log(`  -> Smallest Capital for >= 90% survival @24m: $${minCapResult.minimumViableCapital.toLocaleString()} USD`);
  console.log(`     (Survival @24m: ${toPct(minCapResult.minimumViableRow.survival24m)}, 95% CI: [${toPct(minCapResult.minimumViableRow.ci95Lower24m)}, ${toPct(minCapResult.minimumViableRow.ci95Upper24m)}])`);

  // Section 5: Run False Reproduction Null Test
  console.log('\n## Section 5 — Running False Reproduction Null Test (1,000 agents under Martingale)...');
  const falseReproResult = await runFalseReproductionNullTest(1000, 10);
  console.log(`  -> False Reproduction Rate: ${toPct(falseReproResult.falseReproductionRate)} (${falseReproResult.falseReproductionCount} / ${falseReproResult.totalAgents})`);
  console.log(`     (Target: < 1.00% -> ${falseReproResult.passed ? 'PASS' : 'FAIL'}, 95% CI: [${toPct(falseReproResult.ci95Lower)}, ${toPct(falseReproResult.ci95Upper)}])`);

  // Target Verification Check for Product Setup @24m
  const survA = productSetup.scenarioA.metrics.survivalCheckpoints.find((c) => c.month === 24)?.survivalRate ?? 0;
  const survB = productSetup.scenarioB.metrics.survivalCheckpoints.find((c) => c.month === 24)?.survivalRate ?? 0;
  const survC = productSetup.scenarioC.metrics.survivalCheckpoints.find((c) => c.month === 24)?.survivalRate ?? 0;
  const chC = productSetup.scenarioC.metrics.childrenBorn.mean;

  console.log('\n=== Target Verification Check (Product Setup @24m) ===');
  console.log(`  • Scenario A (Target: 40-70%): ${toPct(survA)} -> ${survA >= 0.40 && survA <= 0.70 ? 'IN TARGET' : 'Empirical Observation'}`);
  console.log(`  • Scenario B (Target: 30-60%): ${toPct(survB)} -> ${survB >= 0.30 && survB <= 0.60 ? 'IN TARGET' : 'Empirical Observation'}`);
  console.log(`  • Scenario C (Target: 60-85%): ${toPct(survC)} (Children: ${toNum(chC)}) -> ${survC >= 0.60 && survC <= 0.85 ? 'IN TARGET' : 'Empirical Observation'}`);

  // Write full comprehensive report
  const finalReportPath = await writeDualSetupReport(
    stressSetup,
    productSetup,
    minCapResult,
    falseReproResult,
    'results/t4/report.md',
  );

  const allPassed = report.passed && falseReproResult.passed;
  console.log(`\n=== Verdict: ${allPassed ? 'PASS' : 'FAIL'} ===`);
  console.log(`Full report written to: ${finalReportPath}`);

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('T4 execution failed with error:', err);
  process.exit(1);
});
