import { runT1b } from './runner-epsilon-zero.js';

async function main() {
    console.log('Running T1b: No-edge null test with epsilon = 0...\n');
    const report = await runT1b();

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
    console.error('T1b failed with error:', err);
    process.exit(1);
});