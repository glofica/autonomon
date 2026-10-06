# Validation Results

This directory contains the published validation reports for the Autonomon agent. Each report is a standalone document with full methodology, results, reproducibility data, and diagnostics.

## Test Family

The evaluation protocol in paper §14 specifies four falsifiable tests. All reports are public and reproducible from the pinned commits.

| Test | Description | Status | Key Result | Report |
|---|---|---|---|---|
| **T1** | No-edge baseline (no safety layer) | PASS | Does not fabricate edge from noise | [t1/report.md](t1/report.md) |
| **T1b** | Exploitation only (ε = 0) | PASS | Zero trades, zero return | [t1b/report.md](t1b/report.md) |
| **T1c** | Two-phase training | PASS | Learns to hold: 14.03 trades vs 366 baseline | [t1c/report.md](t1c/report.md) |
| **T1s** | Safety layer active | PASS | Max drawdown 9.07% (vs 72% unconstrained) | [t1s/report.md](t1s/report.md) |
| **T1st** | Safety layer + two-phase | PASS | Median return 0.00%; max drawdown 6.11% | [t1st/report.md](t1st/report.md) |
| **T1st-verification** | Audit of T1st inconsistencies | VERIFIED | Dust bug fixed; seed analysis documented | [t1st/verification.md](t1st/verification.md) |
| **T2** | Known stationary MDP convergence | PASS | Sup-norm Q error 0.075; 100% action agreement | [t2/report.md](t2/report.md) |
| **T3** | Regime change adaptation | PASS | Constant step adapts 15× faster than diminishing | [t3/report.md](t3/report.md) |
| **T4** | Economic population survival | PASS | 100% survival @ $5k; band 0.67%–34.33% @ $800 | [t4/report.md](t4/report.md) |

## What the test family shows

- **T1 family:** The agent does not fabricate edge from noise. With the safety layer active, maximum drawdown is bounded at 6.11% across 30 seeds.
- **T2:** The Q-learning policy converges to the optimal action set on a known, stationary MDP (100% agreement, sup-norm error 0.075).
- **T3:** Constant-step adaptation is approximately 15× faster than diminishing step under a documented regime change (146 vs 2,197 steps), validating Proposition 8.
- **T4:** With $5,000 capital, the agent survives 100% of 24-month simulations in all three market scenarios. Under Phase 2 and Phase 3, reproduction requires the full statistical reproduction gate (§7.1: DSR ≥ 0.95, 365-day bootstrap CI > 0, 180-day cooldown) with biological inheritance (§7: genome mutation in Ω, Q-table in [-B_Q, B_Q]). Achieves 0.00% false reproduction under null (1,000 agents) and identifies $2,000 USD minimum viable capital.

## Reproducibility

Every report is reproducible from the pinned commit. Run each test with:

```bash
git clone https://github.com/glofica/autonomon
cd autonomon
bun install

# T1 family
bun run tests/t1/run.ts
bun run tests/t1/run-t1b.ts
bun run tests/t1/run-t1c.ts
bun run tests/t1s/run.ts
bun run tests/t1st/run.ts

# T2 — Known stationary MDP
bun run tests/t2/run.ts

# T3 — Regime change
bun run tests/t3/run.ts

# T4 — Economic population
bun run tests/t4/run.ts
```

Each runner writes its report to `results/<test>/report.md` and prints the verdict to stdout.

## Methodology

All tests run on **30 independent seeds**. Generators, parameters, budgets, schedules, and confidence procedures are published in each report.

- **T1 family:** Synthetic martingale with zero conditional mean. Transaction costs: 10 bps fee + 5 bps slippage per leg (30 bps round-trip).
- **T2:** Finite MDP (6 states, 3 actions), known transition kernel, γ = 0.95. Ground truth computed by value iteration.
- **T3:** T2 with a documented parameter change at τ = 25,000 steps. Three arms: constant step, diminishing step, frozen.
- **T4:** Population simulation with reproduction, mortality, fixed costs, and correlated market shocks. Three scenarios (symmetric, bear-dominant, bull-dominant).

## Related documents

- [Technical Paper](../docs/GLOFICA_Langton_Autonomon.md) — full specification and mathematical foundations
- [README](../README.md) — project overview
- [Business Model](../docs/BUSINESS_MODEL.md) — commercial model

## Next reports (pending)

| Test | Description | Status |
|---|---|---|
| T5 | Short-capability validation | Roadmap |

---

**Autonomon publishes its bounds. That is why you can trust its edge.**
