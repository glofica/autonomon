import { runT1 } from './runner.js';

async function main() {
    console.log('Running T1: No-edge null test...\n');
    const report = await runT1();

    console.log('=== Sanity Checks ===');
    for (const check of report.sanityChecks.checks) {
        console.log(`${check.passed ? 'OK' : 'FAIL'} ${check.name}: ${check.message}`);
    }

    console.log('\n=== Metrics ===');
    console.log(JSON.stringify(report.metrics, null, 2));

    console.log(`\n=== Verdict: ${report.passed ? 'PASS' : 'FAIL'} ===`);
    console.log(`Report written to: ${report.reportPath}`);
}

main().catch((err) => {
    console.error('T1 failed with error:', err);
    process.exit(1);
});