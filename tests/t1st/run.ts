import { runT1st } from './runner.js';

async function main() {
    console.log('Running T1st: Two-Phase Training + Evaluation with Safety Layer (Paper §4, §6 & §14)...\n');
    const report = await runT1st();

    console.log('=== Sanity Checks ===');
    for (const check of report.sanityChecks.checks) {
        console.log(`${check.passed ? 'OK' : 'FAIL'} ${check.name}: ${check.message}`);
    }

    console.log('\n=== T1st Evaluation Metrics (Phase 2) ===');
    console.log(JSON.stringify(report.metrics, null, 2));

    console.log(`\n=== Acceptance Criteria ===`);
    console.log(`[${report.metrics.maxDrawdownUnderThreshold ? 'PASS' : 'FAIL'}] Max drawdown < 15% across all seeds: ${(report.metrics.maxDrawdownOverall * 100).toFixed(2)}%`);
    console.log(`[${report.metrics.tradesUnderThreshold ? 'PASS' : 'FAIL'}] Mean trades per seed in evaluation < 100: ${report.metrics.meanEvalTrades.toFixed(2)} trades/seed (reduced by ${report.metrics.tradeReductionPct.toFixed(1)}%)`);
    console.log(`[${report.metrics.annualizedReturnBounded ? 'PASS' : 'FAIL'}] Phase 2 annualized return > -5%: ${(report.metrics.meanEvalAnnualizedReturn * 100).toFixed(2)}%`);

    console.log(`\n=== Verdict: ${report.passed ? 'PASS' : 'FAIL'} ===`);
    console.log(`Report written to: ${report.reportPath}`);
}

main().catch((err) => {
    console.error('T1st failed with error:', err);
    process.exit(1);
});
