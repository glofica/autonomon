/**
 * T4 — Economic Population Simulator Entry Point (Phase 1 Calibrated)
 *
 * Runs 30 seeds for Scenario A (Martingale, drift = 0%) and Scenario B (Negative Drift, -2%/mo).
 *
 * Usage:
 *   bun run tests/t4/run.ts
 */

import { runT4 } from './runner.js';

async function main() {
  console.log('Running T4: Economic Population Simulator — Phase 1 Calibrated (Paper §14)...\n');
  console.log('Evaluating 30 independent population seeds under $500 founder capital, $22/mo costs, and 1.5x reproduction gate.\n');

  const dualReport = await runT4();
  const sA = dualReport.scenarioA;
  const sB = dualReport.scenarioB;
  const mA = sA.metrics;
  const mB = sB.metrics;

  const toPct = (val: number) => (val * 100).toFixed(2) + '%';
  const toNum = (val: number) => val.toFixed(2);

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  📊 T4 ECONOMIC POPULATION SIMULATOR — SCENARIO A vs SCENARIO B COMPARISON');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

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

  console.log('3. COMPARACIÓN DIRECTA (Escenario A vs Escenario B):');
  console.log(`   • Diferencia en Supervivencia de Founders: ${((mA.founderRuinProbability.mean - mB.founderRuinProbability.mean) * 100).toFixed(1)} puntos porcentuales`);
  console.log(`   • Exceso de Ruina en Bear Market:         +${((mB.ruinProbability.mean - mA.ruinProbability.mean) * 100).toFixed(1)} puntos porcentuales`);
  console.log(`   • Diferencia Población Viva al Horizonte: ${(mB.finalLivingPopulation.mean - mA.finalLivingPopulation.mean).toFixed(1)} agentes`);
  console.log(`   • Diferencia en Nacimientos (Hijos):       ${(mB.childrenBorn.mean - mA.childrenBorn.mean).toFixed(1)} hijos\n`);

  console.log('=== Aggregate Survival Curves ===');
  console.log('Month | Day | Scenario A Survival | Scenario A Living | Scenario B Survival | Scenario B Living');
  console.log('------|-----|---------------------|-------------------|---------------------|------------------');
  for (let i = 0; i < mA.survivalCheckpoints.length; i++) {
    const a = mA.survivalCheckpoints[i];
    const b = mB.survivalCheckpoints[i] ?? a;
    console.log(`  M${a.month.toString().padStart(2)} | D${a.day.toString().padStart(3)} |       ${toPct(a.survivalRate).padStart(7)}       |    ${toNum(a.livingCountMean).padStart(6)} agents  |       ${toPct(b.survivalRate).padStart(7)}       |    ${toNum(b.livingCountMean).padStart(6)} agents`);
  }

  console.log(`\n=== Verdict: ${dualReport.passed ? 'PASS' : 'FAIL'} ===`);
  console.log(`Report written to: ${dualReport.reportPath}`);

  if (!dualReport.passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('T4 execution failed with error:', err);
  process.exit(1);
});
