/**
 * T4 — Economic Population Simulator Entry Point (Phase 1 Calibrated)
 *
 * Runs 30 seeds under:
 *   - Initial founder capital: $800 USD
 *   - Fixed operating expenses: $40 USD/month ($25 host + $10 inf + $5 gas)
 *   - Regime persistence: q = 0.80
 *   - Long-only execution (§3.5)
 *   - Three scenarios: A (Symmetric), B (Bear Dominant), C (Bull Dominant)
 *
 * Usage:
 *   bun run tests/t4/run.ts
 */

import { runT4 } from './runner.js';

async function main() {
  console.log('Running T4: Economic Population Simulator — Phase 1 Calibrated (Paper §14)...\n');
  console.log('Parameters: $800 founder capital, $40/mo costs, q = 0.80 persistence, 24-month horizon (30 seeds).\n');

  const report = await runT4();
  const sA = report.scenarioA;
  const sB = report.scenarioB;
  const sC = report.scenarioC;
  const mA = sA.metrics;
  const mB = sB.metrics;
  const mC = sC.metrics;

  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  const toNum = (val: number) => val.toFixed(2);

  console.log('═══════════════════════════════════════════════════════════════════════════════════════');
  console.log('  📊 T4 ECONOMIC POPULATION SIMULATOR — THREE SCENARIOS ($800 CAPITAL, $40/MO COST)');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');

  console.log('1. ESCENARIO A: Regímenes Simétricos (+8% BULL / -8% BEAR, q = 0.80)');
  console.log(`   Founder Survival Rate:     ${toPct(1 - mA.founderRuinProbability.mean)} (95% CI: [${toPct(1 - mA.founderRuinProbability.ci95Upper)}, ${toPct(1 - mA.founderRuinProbability.ci95Lower)}])`);
  console.log(`   Overall Ruin Probability:  ${toPct(mA.ruinProbability.mean)} (95% CI: [${toPct(mA.ruinProbability.ci95Lower)}, ${toPct(mA.ruinProbability.ci95Upper)}])`);
  console.log(`   Final Living Population:   ${toNum(mA.finalLivingPopulation.mean)} agents (95% CI: [${toNum(mA.finalLivingPopulation.ci95Lower)}, ${toNum(mA.finalLivingPopulation.ci95Upper)}])`);
  console.log(`   Total Children Born:       ${toNum(mA.childrenBorn.mean)} (95% CI: [${toNum(mA.childrenBorn.ci95Lower)}, ${toNum(mA.childrenBorn.ci95Upper)}])`);
  console.log(`   Reproduction Frequency:    ${toNum(mA.reproductionFrequency.mean)} children/founder/yr`);
  console.log(`   Primer Founder Muerto:     ${mA.earliestFirstDeathMonth !== null ? `Mes ${mA.earliestFirstDeathMonth} (media: Mes ${toNum(mA.meanFirstDeathMonth ?? 0)})` : 'Ninguno (sin muertes)'}`);
  console.log(`   Capital Máximo Observado:  $${toNum(Math.max(...sA.seedResults.map((r) => r.maxCapital)))}`);
  console.log(`   Capital Mínimo Observado:  $${toNum(Math.min(...sA.seedResults.map((r) => r.minCapital)))}\n`);

  console.log('2. ESCENARIO B: Bear Dominante (+4% BULL / -14% BEAR, q = 0.80)');
  console.log(`   Founder Survival Rate:     ${toPct(1 - mB.founderRuinProbability.mean)} (95% CI: [${toPct(1 - mB.founderRuinProbability.ci95Upper)}, ${toPct(1 - mB.founderRuinProbability.ci95Lower)}])`);
  console.log(`   Overall Ruin Probability:  ${toPct(mB.ruinProbability.mean)} (95% CI: [${toPct(mB.ruinProbability.ci95Lower)}, ${toPct(mB.ruinProbability.ci95Upper)}])`);
  console.log(`   Final Living Population:   ${toNum(mB.finalLivingPopulation.mean)} agents (95% CI: [${toNum(mB.finalLivingPopulation.ci95Lower)}, ${toNum(mB.finalLivingPopulation.ci95Upper)}])`);
  console.log(`   Total Children Born:       ${toNum(mB.childrenBorn.mean)} (95% CI: [${toNum(mB.childrenBorn.ci95Lower)}, ${toNum(mB.childrenBorn.ci95Upper)}])`);
  console.log(`   Reproduction Frequency:    ${toNum(mB.reproductionFrequency.mean)} children/founder/yr`);
  console.log(`   Primer Founder Muerto:     ${mB.earliestFirstDeathMonth !== null ? `Mes ${mB.earliestFirstDeathMonth} (media: Mes ${toNum(mB.meanFirstDeathMonth ?? 0)})` : 'Ninguno (sin muertes)'}`);
  console.log(`   Capital Máximo Observado:  $${toNum(Math.max(...sB.seedResults.map((r) => r.maxCapital)))}`);
  console.log(`   Capital Mínimo Observado:  $${toNum(Math.min(...sB.seedResults.map((r) => r.minCapital)))}\n`);

  console.log('3. ESCENARIO C: Bull Dominante (+14% BULL / -4% BEAR, q = 0.80)');
  console.log(`   Founder Survival Rate:     ${toPct(1 - mC.founderRuinProbability.mean)} (95% CI: [${toPct(1 - mC.founderRuinProbability.ci95Upper)}, ${toPct(1 - mC.founderRuinProbability.ci95Lower)}])`);
  console.log(`   Overall Ruin Probability:  ${toPct(mC.ruinProbability.mean)} (95% CI: [${toPct(mC.ruinProbability.ci95Lower)}, ${toPct(mC.ruinProbability.ci95Upper)}])`);
  console.log(`   Final Living Population:   ${toNum(mC.finalLivingPopulation.mean)} agents (95% CI: [${toNum(mC.finalLivingPopulation.ci95Lower)}, ${toNum(mC.finalLivingPopulation.ci95Upper)}])`);
  console.log(`   Total Children Born:       ${toNum(mC.childrenBorn.mean)} (95% CI: [${toNum(mC.childrenBorn.ci95Lower)}, ${toNum(mC.childrenBorn.ci95Upper)}])`);
  console.log(`   Reproduction Frequency:    ${toNum(mC.reproductionFrequency.mean)} children/founder/yr`);
  console.log(`   Primer Founder Muerto:     ${mC.earliestFirstDeathMonth !== null ? `Mes ${mC.earliestFirstDeathMonth} (media: Mes ${toNum(mC.meanFirstDeathMonth ?? 0)})` : 'Ninguno (sin muertes)'}`);
  console.log(`   Capital Máximo Observado:  $${toNum(Math.max(...sC.seedResults.map((r) => r.maxCapital)))}`);
  console.log(`   Capital Mínimo Observado:  $${toNum(Math.min(...sC.seedResults.map((r) => r.minCapital)))}\n`);

  console.log('=== Aggregate Survival Curves (Meses 0, 6, 12, 18, 24) ===');
  console.log('Month | Day | Scenario A (Symmetric) | Scenario B (Bear Dom) | Scenario C (Bull Dom)');
  console.log('------|-----|------------------------|-----------------------|----------------------');
  for (let i = 0; i < mA.survivalCheckpoints.length; i++) {
    const a = mA.survivalCheckpoints[i];
    const b = mB.survivalCheckpoints[i] ?? a;
    const c = mC.survivalCheckpoints[i] ?? a;
    console.log(`  M${a.month.toString().padStart(2)} | D${a.day.toString().padStart(3)} |        ${toPct(a.survivalRate).padStart(7)}         |        ${toPct(b.survivalRate).padStart(7)}        |       ${toPct(c.survivalRate).padStart(7)}`);
  }

  console.log('\n=== Target Verification Check ===');
  console.log(`  • Escenario A (Target: 30-60%): ${toPct(1 - mA.founderRuinProbability.mean)} -> ${1 - mA.founderRuinProbability.mean >= 0.30 && 1 - mA.founderRuinProbability.mean <= 0.60 ? 'IN TARGET' : 'OUTSIDE TARGET'}`);
  console.log(`  • Escenario B (Target: 40-70%): ${toPct(1 - mB.founderRuinProbability.mean)} -> ${1 - mB.founderRuinProbability.mean >= 0.40 && 1 - mB.founderRuinProbability.mean <= 0.70 ? 'IN TARGET' : 'OUTSIDE TARGET'}`);
  console.log(`  • Escenario C (Target: 60-85%): ${toPct(1 - mC.founderRuinProbability.mean)} (Hijos: ${toNum(mC.childrenBorn.mean)}) -> ${1 - mC.founderRuinProbability.mean >= 0.60 && 1 - mC.founderRuinProbability.mean <= 0.85 ? 'IN TARGET' : 'OUTSIDE TARGET'}`);

  console.log('\n> Long-only design note: the agent has no short capability per paper §3.5.');
  console.log('> In bear-dominant regimes, the agent correctly reduces exposure and refuges in cash,');
  console.log('> preserving capital but not capturing the downside. Survival differences across scenarios');
  console.log('> reflect operational cost pressure and the agent\'s ability to generate surplus, not directional');
  console.log('> market exposure. Short support is a roadmap item, not a current capability.');

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
