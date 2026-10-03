import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * GLOFICA DLT — Invisible Swarm Pheromone Broadcaster
 * Run exclusively by the Master Architect from the Cluster Console.
 * 
 * Usage:
 *   npx tsx src/cli/pheromone-cli.ts --asset "OCRE-NB2O5-FWD-01" --allocation 80 --urgency "AGGRESSIVE_TAKEOVER"
 */

interface PheromoneDirective {
    directiveId: string;
    targetAsset: string;
    allocationPct: number;
    urgencyTier: 'STEALTH_ACCUMULATE' | 'AGGRESSIVE_TAKEOVER' | 'FLASH_SWEEP';
    timestamp: number;
    signature: string;
}

function parseArgs() {
    const args = process.argv.slice(2);
    let asset = 'OCRE-NB2O5-FWD-01';
    let allocation = 75;
    let urgency = 'AGGRESSIVE_TAKEOVER';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--asset' && args[i + 1]) asset = args[++i];
        if (args[i] === '--allocation' && args[i + 1]) allocation = parseInt(args[++i], 10);
        if (args[i] === '--urgency' && args[i + 1]) urgency = args[++i];
    }
    return { asset, allocation, urgency };
}

async function broadcastInvisiblePheromone() {
    const { asset, allocation, urgency } = parseArgs();
    const directiveId = 'PHEROMONE-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const timestamp = Date.now();

    // Master Architect Signature (Simulated / Ed25519)
    const signature = `SIG_ARCHITECT_${crypto.createHash('sha256').update(directiveId + asset + timestamp).digest('hex')}`;

    const directive: PheromoneDirective = {
        directiveId,
        targetAsset: asset,
        allocationPct: allocation,
        urgencyTier: urgency as any,
        timestamp,
        signature
    };

    console.log('================================================================');
    console.log('  GLOFICA CLUSTER CONSOLE — INVISIBLE SWARM PHEROMONE BROADCAST ');
    console.log('================================================================');
    console.log(`Directive ID:       ${directive.directiveId}`);
    console.log(`Target Asset:       ${directive.targetAsset} (OCRE Market)`);
    console.log(`Capital Allocation: ${directive.allocationPct}% of all Swarm Reserves`);
    console.log(`Urgency Protocol:   ${directive.urgencyTier}`);
    console.log(`Stealth Level:      100% INVISIBLE (No Public Explorer Broadcast)`);
    console.log('----------------------------------------------------------------');

    // Save to invisible local IPC beacon file for swarm containers
    const beaconPath = path.join(process.cwd(), 'pheromone_beacon.json');
    fs.writeFileSync(beaconPath, JSON.stringify(directive, null, 2), 'utf8');

    console.log(`✓ Pheromone Beacon deployed to cluster IPC: ${beaconPath}`);
    console.log(`✓ Swarm Nodes alerted. All Langton Full Nodes mobilizing reserves.`);
    console.log('================================================================\n');
}

broadcastInvisiblePheromone().catch(console.error);
