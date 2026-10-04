import { runT1c } from './runner-two-phase.js';

async function main() {
    console.log('Running T1c: Two-phase training + evaluation...\n');
    const report = await runT1c();

    console.log('=== Metrics (evaluation phase only) ===');
    console.log(JSON.stringify(report.metrics, null, 2));

    console.log(`\n=== Verdict: ${report.passed ? 'PASS' : 'FAIL'} ===`);
    console.log(`Report written to: ${report.reportPath}`);

    console.log('\n=== Learning diagnostic ===');
    const meanEvalTrades =
        report.results.reduce((acc, r) => acc + r.evalTradeCount, 0) / report.results.length;
    const meanTrainTrades = report.results.length; // placeholder, see below
    console.log(`Mean trades per seed (evaluation phase): ${meanEvalTrades.toFixed(2)}`);
    console.log(`Compare to T1 (exploration on): 366.10 trades per seed`);
    if (meanEvalTrades < 100) {
        console.log('=> Agent learned to hold. Low evaluation trade count.');
    } else if (meanEvalTrades < 300) {
        console.log('=> Agent partially learned. Some reduction in trades.');
    } else {
        console.log('=> Agent did NOT learn. Trade count similar to exploration-on run.');
    }
}

main().catch((err) => {
    console.error('T1c failed with error:', err);
    process.exit(1);
});