/**
 * T4 — Economic Population Simulator Entry Point (Phase 1 Calibrated - 3 Scenarios)
 *
 * Runs 30 seeds for:
 *   - Scenario A: Pure Martingale (drift = 0%)
 *   - Scenario B: Negative Drift (-2%/month)
 *   - Scenario C: Positive Drift (+1%/month)
 *
 * Usage:
 *   bun run tests/t4/run.ts
 */

import { runT4 } from './runner.js';

async function main() {
  console.log('Running T4: Economic Population Simulator — Phase 1 Calibrated (Paper §14)...\n');
  console.log('Evaluating 30 independent population seeds under $2,000 founder capital, $22/mo costs, and 24-month horizon.\n');

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
  console.log('  📊 T4 ECONOMIC POPULATION SIMULATOR — THREE SCENARIOS COMPARISON ($2,000 CAPITAL)');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');

  console.log('1. ESCENARIO A: Martingala Pura (drift = 0%, vol = 30%, rho = 0.50, fat tails = true)');
  console.log(`   Founder Survival Rate:     ${toPct(1 - mA.founderRuinProbability.mean)} (95% CI: [${toPct(1 - mA.founderRuinProbability.ci95Upper)}, ${toPct(1 - mA.founderRuinProbability.ci95Lower)}])`);
  console.log(`   Overall Ruin Probability:  ${toPct(mA.ruinProbability.mean)} (95% CI: [${toPct(mA.ruinProbability.ci95Lower)}, ${toPct(mA.ruinProbability.ci95Upper)}])`);
  console.log(`   Final Living Population:   ${toNum(mA.finalLivingPopulation.mean)} agents (95% CI: [${toNum(mA.finalLivingPopulation.ci95Lower)}, ${toNum(mA.finalLivingPopulation.ci95Upper)}])`);
  console.log(`   Total Children Born:       ${toNum(mA.childrenBorn.mean)} (95% CI: [${toNum(mA.childrenBorn.ci95Lower)}, ${toNum(mA.childrenBorn.ci95Upper)}])`);
  console.log(`   Reproduction Frequency:    ${toNum(mA.reproductionFrequency.mean)} children/founder/yr`);
  console.log(`   Peak Capital Observed:     $${toNum(mA.peakCapital.mean)} (Max across seeds: $${toNum(Math.max(...sA.seedResults.map((r) => r.maxCapital)))})`);
  console.log(`   Annual Population Growth:  ${toPct(mA.populationGrowthRate.mean)}\n`);

  console.log('2. ESCENARIO B: Drift Negativo (-2% mensual / -24% anual, vol = 30%, rho = 0.50, fat tails = true)');
  console.log(`   Founder Survival Rate:     ${toPct(1 - mB.founderRuinProbability.mean)} (95% CI: [${toPct(1 - mB.founderRuinProbability.ci95Upper)}, ${toPct(1 - mB.founderRuinProbability.ci95Lower)}])`);
  console.log(`   Overall Ruin Probability:  ${toPct(mB.ruinProbability.mean)} (95% CI: [${toPct(mB.ruinProbability.ci95Lower)}, ${toPct(mB.ruinProbability.ci95Upper)}])`);
  console.log(`   Final Living Population:   ${toNum(mB.finalLivingPopulation.mean)} agents (95% CI: [${toNum(mB.finalLivingPopulation.ci95Lower)}, ${toNum(mB.finalLivingPopulation.ci95Upper)}])`);
  console.log(`   Total Children Born:       ${toNum(mB.childrenBorn.mean)} (95% CI: [${toNum(mB.childrenBorn.ci95Lower)}, ${toNum(mB.childrenBorn.ci95Upper)}])`);
  console.log(`   Reproduction Frequency:    ${toNum(mB.reproductionFrequency.mean)} children/founder/yr`);
  console.log(`   Peak Capital Observed:     $${toNum(mB.peakCapital.mean)} (Max across seeds: $${toNum(Math.max(...sB.seedResults.map((r) => r.maxCapital)))})`);
  console.log(`   Annual Population Growth:  ${toPct(mB.populationGrowthRate.mean)}\n`);

  console.log('3. ESCENARIO C: Drift Positivo (+1% mensual / +12% anual, vol = 30%, rho = 0.50, fat tails = true)');
  console.log(`   Founder Survival Rate:     ${toPct(1 - mC.founderRuinProbability.mean)} (95% CI: [${toPct(1 - mC.founderRuinProbability.ci95Upper)}, ${toPct(1 - mC.founderRuinProbability.ci95Lower)}])`);
  console.log(`   Overall Ruin Probability:  ${toPct(mC.ruinProbability.mean)} (95% CI: [${toPct(mC.ruinProbability.ci95Lower)}, ${toPct(mC.ruinProbability.ci95Upper)}])`);
  console.log(`   Final Living Population:   ${toNum(mC.finalLivingPopulation.mean)} agents (95% CI: [${toNum(mC.finalLivingPopulation.ci95Lower)}, ${toNum(mC.finalLivingPopulation.ci95Upper)}])`);
  console.log(`   Total Children Born:       ${toNum(mC.childrenBorn.mean)} (95% CI: [${toNum(mC.childrenBorn.ci95Lower)}, ${toNum(mC.childrenBorn.ci95Upper)}])`);
  console.log(`   Reproduction Frequency:    ${toNum(mC.reproductionFrequency.mean)} children/founder/yr`);
  console.log(`   Peak Capital Observed:     $${toNum(mC.peakCapital.mean)} (Max across seeds: $${toNum(Math.max(...sC.seedResults.map((r) => r.maxCapital)))})`);
  console.log(`   Annual Population Growth:  ${toPct(mC.populationGrowthRate.mean)}\n`);

  console.log('=== Aggregate Survival Curves (Meses 0, 6, 12, 18, 24) ===');
  console.log('Month | Day | Scenario A (Drift 0%) | Scenario B (Drift -2%) | Scenario C (Drift +1%)');
  console.log('------|-----|-----------------------|------------------------|-----------------------');
  for (let i = 0; i < mA.survivalCheckpoints.length; i++) {
    const a = mA.survivalCheckpoints[i];
    const b = mB.survivalCheckpoints[i] ?? a;
    const c = mC.survivalCheckpoints[i] ?? a;
    console.log(`  M${a.month.toString().padStart(2)} | D${a.day.toString().padStart(3)} |        ${toPct(a.survivalRate).padStart(7)}        |        ${toPct(b.survivalRate).padStart(7)}         |        ${toPct(c.survivalRate).padStart(7)}`);
  }

  console.log('\n=== Target Verification Check ===');
  console.log(`  • Escenario A (Target: 40-60%): ${toPct(1 - mA.founderRuinProbability.mean)} -> ${1 - mA.founderRuinProbability.mean >= 0.40 && 1 - mA.founderRuinProbability.mean <= 0.60 ? 'IN TARGET' : 'OUTSIDE TARGET'}`);
  console.log(`  • Escenario B (Target: 10-25%): ${toPct(1 - mB.founderRuinProbability.mean)} -> ${1 - mB.founderRuinProbability.mean >= 0.10 && 1 - mB.founderRuinProbability.mean <= 0.25 ? 'IN TARGET' : 'OUTSIDE TARGET'}`);
  console.log(`  • Escenario C (Target: 60-80%): ${toPct(1 - mC.founderRuinProbability.mean)} (Hijos: ${toNum(mC.childrenBorn.mean)}) -> ${1 - mC.founderRuinProbability.mean >= 0.60 && 1 - mC.founderRuinProbability.mean <= 0.80 ? 'IN TARGET' : 'OUTSIDE TARGET'}`);

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
