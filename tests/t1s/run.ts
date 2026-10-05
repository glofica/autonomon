import { runT1s } from './runner.js';

async function main() {
    console.log('Running T1s: Safety Layer Active (Paper §6 & §14)...\n');
    const report = await runT1s();

    console.log('=== Sanity Checks ===');
    for (const check of report.sanityChecks.checks) {
        console.log(`${check.passed ? 'OK' : 'FAIL'} ${check.name}: ${check.message}`);
    }

    console.log('\n=== T1s Metrics ===');
    console.log(JSON.stringify(report.metrics, null, 2));

    console.log(`\n=== Acceptance Criteria ===`);
    console.log(`[${report.metrics.maxDrawdownUnderThreshold ? 'PASS' : 'FAIL'}] Max drawdown < 15% across all seeds: ${(report.metrics.maxDrawdownOverall * 100).toFixed(2)}%`);
    console.log(`[${report.metrics.breakerTrippedAtLeastOnce ? 'PASS' : 'FAIL'}] Circuit breaker tripped at least once: ${report.metrics.seedsWithBreakerTripped} / ${report.metrics.nSeeds} seeds`);
    console.log(`[${report.metrics.annualizedReturnBounded ? 'PASS' : 'FAIL'}] Annualized return bounded: ${(report.metrics.meanAnnualizedReturn * 100).toFixed(2)}%`);

    console.log(`\n=== Verdict: ${report.passed ? 'PASS' : 'FAIL'} ===`);
    console.log(`Report written to: ${report.reportPath}`);
}

main().catch((err) => {
    console.error('T1s failed with error:', err);
    process.exit(1);
});
