# Autonomon 

### The sovereign financial agent that publishes its own bounds

**Author & Chief Architect:** Germán Malavé ([@Praexor](https://github.com/Praexor)) — GLOFICA DLT  
**Repository:** [github.com/glofica/autonomon](https://github.com/glofica/autonomon)  
**Technical Paper:** [GLOFICA DLT — Langton Autonomon](docs/GLOFICA_Langton_Autonomon.md)  
**Network:** GLOFICA DLT · Move VM · BFT Consensus · XGO (6 decimals)

---

**An autonomous trading organism that verifies its own ledger, funds its own operations, mutates its own policy, and proves — in a peer-reviewed technical paper — exactly what it guarantees.**

[Technical Paper](docs/GLOFICA_Langton_Autonomon.md) · [Architecture](#architecture) · [Safety Model](#the-safety-model) · [Genome](#the-genome) · [What the Paper Proves](#what-the-paper-proves) · [Evaluation Protocol](#evaluation-protocol) · [Validation Results](#validation-results) · [Getting Started](#getting-started)

---

## Why Autonomon

Every autonomous trading system asks for trust.

Autonomon earns it.

Every claim in this repository is backed by one of three things:

- **A theorem** in the technical paper, with stated assumptions and a proof.
- **A verification obligation**, with a defined test.
- **An empirical hypothesis**, with a falsifiable evaluation protocol.

Nothing is asserted without showing the work. That is not a limitation. In a market where every other agent promises "AI-powered alpha," **it is the only claim that survives scrutiny.**

**What this means in practice:**

- The agent runs on a **tabular Q-learning policy** with a proven bound on its Q-values.
- The agent enforces a **reserve floor, concentration caps, and circuit breakers** that exploration cannot disable.
- The agent carries a **seven-locus genome** with projection bounds that are proved closed under reproduction.
- The agent funds its own operation through a **segregated runway model** with a formal cost hurdle and a closed-form survival analysis.

That is a harder product to build. It is also the only one that holds up when someone reads the code.

---

## What it is

Autonomon is an autonomous financial controller architecture built around five principles:

**1. Separation of prediction, choice, and authority.**  
A forecasting service produces observations. A tabular Q-learning policy ranks actions. A deterministic safety layer authorizes execution. A language model explains behavior asynchronously with no execution authority. No single component can bypass the others.

**2. Observation-based control.**  
The policy operates on a discretized observation state with a proven classifier: every valid observation maps to exactly one category in each coordinate. The table is finite, verifiable, and published.

**3. Enforced safety.**  
Reserve floors, concentration caps, funded-runway thresholds, and circuit breakers are enforced by the safety layer. The paper proves **conditional preservation** of these invariants under stated disturbance bounds, with a formal **price-of-safety** bound quantifying the cost of the restriction.

**4. Bounded evolution.**  
The agent has a seven-locus genome. Mutations are projected into a closed parameter box — proved closed under reproduction. Inherited Q-tables are projected into a bounded value range — proved bounded across generations. Population growth preserves aggregate NAV — proved.

**5. Published evaluation.**  
Synthetic negative-control tests T1–T4 are specified with prespecified measurements, decision criteria, and failure diagnoses. Success is defined before the experiment, not after.

---

## The Lifecycle

An Autonomon is not a bot with a strategy. It is an organism with a lifecycle.

**I. Birth — Sovereign Identity**  
Each organism is born with its own Ed25519 keypair, a seven-locus genome, and a funded treasury. No shared custody. No delegated authority. No custodial ties to its parent.

**II. Growth — Observe, Decide, Enforce**  
The organism forecasts with TimesFM, ranks actions with tabular Q-learning, and submits every decision to a deterministic safety layer. Exploration cannot override safety. Narrative cannot authorize execution.

**III. Reproduction — Gated Mitosis**  
When an organism sustains proven net performance over a 365-day evaluation window — verified by block-bootstrap confidence bounds and a Deflated Sharpe Ratio ≥ 0.95 — it triggers mitosis. Half of surplus capital funds a child with inherited policy and mutated genome. Population growth preserves aggregate NAV. It does not create wealth.

**IV. Ascension — Validator Citizenship**  
An organism with funded stake, segregated operating runway, and operational buffers can apply for conditional admission to validator operation. This is not a reward for trading well. It is a graduation, subject to the network's stake rules, slashing model, and governance authorization. Full requirements are specified in Section 13 of the paper.

---

## Architecture

Three tiers. The agent is one sovereign organism; forecasting and narrative are shared services.

```
┌─────────────────────────────────────────────────────────────────────┐
│  AUTONOMON APPLIANCE (Docker container)                             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  TIER 1 — SOVEREIGN OPERATIONAL CORE (Bun/TS, ~25 MB)         │  │
│  │                                                               │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐  │  │
│  │  │ Q-Policy   │──│ Safety Layer │──│ Execution Adapter     │  │  │
│  │  │ (tabular)  │  │ (admission)  │  │ (Move tx builder)     │  │  │
│  │  └────────────┘  └──────────────┘  └───────────────────────┘  │  │
│  │        ▲                ▲                     ▲               │  │
│  │        │                │                     │               │  │
│  │  ┌─────┴─────┐  ┌───────┴────────┐  ┌─────────┴────────────┐  │  │
│  │  │ Genome +  │  │ SRE Supervisor │  │ Ed25519 Keystore     │  │  │
│  │  │ Mutation  │  │ (deterministic)│  │ (RAM only, no disk)  │  │  │
│  │  └───────────┘  └────────────────┘  └──────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  SOVEREIGN FULLNODE (Rust / Tokio / Move VM)                  │  │
│  │  Ledger sync · Local verification · Tx submission             │  │
│  │  Non-validating by default                                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ▲                                      │
│                              │ local RPC / IPC                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                                  │
              ▼                                  ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  TIER 2 — TIMESFM ORACLE     │   │  TIER 3 — COGNITIVE SOUL     │
│  (Python, shared VPS)        │   │  (Ollama + Qwen 2.5, shared) │
│                              │   │                              │
│  Quantiles p10 / p50 / p90   │   │  Narrative · Diary · Audit   │
│  Critical dependency         │   │  Best-effort · No authority  │
│  Fail-safe → HOLD-only       │   │  Async · Never blocks        │
└──────────────────────────────┘   └──────────────────────────────┘
```

**Tier 1 — Sovereign Operational Core.**  
The agent itself, in Bun/TypeScript at ~25 MB. Contains the Q-policy, the safety layer, the genome, the deterministic SRE supervisor, and the volatile Ed25519 keystore. No shared custody. No delegated authority.

**Sovereign Fullnode.**  
Rust / Tokio / Move VM. Runs in the same container as Tier 1, connected by local RPC or IPC. It synchronizes and verifies the ledger, and submits transactions. Non-validating by default.

**Tier 2 — TimesFM Oracle.**  
Shared Python service on an external VPS. Supplies timestamped quantile forecasts (p10, p50, p90). It is a **critical dependency**: if it is unreachable, the agent enters HOLD-only fail-safe. It never falls back to a local regression.

**Tier 3 — Cognitive Soul.**  
Shared Ollama + Qwen 2.5 service on an external VPS. Generates narrative, diary, and audit summaries. It has **zero execution authority** and is **asynchronous and best-effort**: if it is unreachable, the agent continues operating normally.

**Why the tiers are separated.**  
The forecasting service is compute-heavy and shared across the fleet. The narrative service is large and shared. Neither needs access to keys, policy state, or the ledger. Both can be externalized without weakening the agent's custody model. The Tier 1 core stays small, sovereign, and self-contained.

**Lightweight agent, shared intelligence.**  
The on-chain agent runs at ~25 MB. Forecasting (TimesFM) and narrative (Qwen 2.5) run as shared, stateless services. A fleet of agents shares the expensive compute without sharing custody or policy state.

**Sovereign keys, local signing.**  
Each agent holds its own Ed25519 key and signs transactions locally. Custody is never delegated.

**Deterministic supervisor.**  
Storage pruning, log rotation, resource protection, and emergency defense run in the supervisor. Exploration cannot disable them.

**Three-tier separation.**  
Fullnode, policy controller, and safety layer are distinct processes with distinct authority. The policy proposes; the safety layer disposes.

---

## The genome

Each Autonomon carries a seven-locus parameter genome, projected into a closed box on reproduction:

| Locus | Range | Role |
|---|---|---|
| Risk aversion | [0.10, 5.00] | Stress-loss budget scaling |
| Sampling interval | [5, 60] min | Input series interval |
| Initial exploration | [0.05, 0.50] | ε at birth |
| Tracking step size | [0.01, 0.25] | Q-learning rate |
| Protected gas reserve | [100, 1000] XGO | Reserve admission floor |
| Concentration cap | [0.05, 0.40] | Max per-instrument exposure |
| Reproduction multiple | [1.50, 3.00] | Adjusted performance threshold |

Mutations follow Gaussian drift with coordinate-wise projection. Every child genome lies in Ω — proved.

**Reproduction is gated.**  
To spawn, an agent must clear a 365-day evaluation window with a positive 95% lower block-bootstrap bound on net excess return, a Deflated Sharpe Ratio ≥ 0.95, and fully funded parent and child reserves. Correlated clones are corrected by an effective-trial adjustment that the paper derives in closed form.

---

## The safety model

Safety is enforced, not learned. The safety layer evaluates every proposed action against:

- **Reserve floor.** `B − L − C ≥ g_gas` for every reserve-decreasing event. Pending transactions are pre-deducted. Conditional reserve preservation is proved.
- **Concentration.** `E_i / V ≤ g_ω`, with conservative post-trade bounds.
- **Funded runway.** ρ = executable reserves / monthly cost. Below ρ = 1, no risk-increasing action is admissible. Between 1 and 3, the exposure cap scales linearly. Above 3, the genome cap applies.
- **Circuit breaker.** A flow-adjusted trailing 24-hour drawdown beyond 15% triggers a four-hour lockout: no new exposure, cancellable orders cancelled, risk-reduction still allowed.
- **Reconciliation.** Every Q-update corresponds to a reconciled transition. Submitted, pending, finalized, failed, and expired transactions are distinguished. Duplicate reward attribution is prevented by transaction identifier.

The paper's **price-of-safety** proposition bounds the expected cost of these restrictions in terms of the probability that the unconstrained optimal policy would need a forbidden action. Safety is free where it does not bind, and its cost is explicit where it does.

**The threat model is documented.**  
Oracle manipulation, MEV, finality delay, adversarial forecast inputs, reward poisoning, key compromise, narrative poisoning, and governance capture are each mapped to vector, impact, mitigation, and residual risk.

---

## What the paper proves

The technical paper is not a whitepaper of promises. It is a research document with eleven propositions, each with stated assumptions, a proof, and — where applicable — a verification obligation.

| Result | What it establishes |
|---|---|
| **P1: Unique classification** | Every valid observation maps to exactly one state tuple |
| **P2: Bounded Q-values** | Q is bounded by max(‖Q₀‖, R_max/(1−γ)) between inheritance events |
| **P3: Reserve preservation** | The gas reserve floor is preserved under enforced debit bounds |
| **P4: General invariant** | Any declared safe set is preserved under admitted actions and disturbance model |
| **P5: Genome closure** | Every child genome lies in the parameter box |
| **P6: Reproduction accounting** | Parent–child transfer preserves aggregate NAV except for recognized costs |
| **P7: Sample complexity** | The nominal table's PAC requirement exceeds its data budget by orders of magnitude — a design constraint made explicit |
| **P8: Tracking under non-stationarity** | Constant-step tracking error scales as O(√Δ); the optimal step size is √Δ |
| **P9: Price of safety** | The expected cost of the safety restriction is bounded by the probability that the optimal policy needs a forbidden action |
| **P10: Effective trials** | Correlated clones reduce K_eff = K / (1 + (K−1)ρ); FWER is corrected accordingly |
| **P11: Fixed-cost survival** | The scale function for `dA = (μA − c)dt + sA dW` is closed-form; the constant-drift approximation is shown to understate ruin |

The paper is in this repository: [`docs/GLOFICA_Langton_Autonomon.md`](docs/GLOFICA_Langton_Autonomon.md).

---

## Evaluation protocol

The paper specifies four falsifiable tests. Success criteria are defined before the experiment:

| Test | What it establishes |
|---|---|
| **T1: No-edge null** | The agent does not manufacture edge from a zero-conditional-mean process |
| **T2: Known stationary MDP** | Tabular Q-learning reaches the optimal action set under its stated assumptions |
| **T3: Regime change** | Constant-step tracking adapts under declared non-stationarity |
| **T4: Economic population** | Survival, reproduction, and ruin probability under explicit cost and shock models |

Each test runs on at least 30 independent seeds. Generators, parameters, budgets, schedules, and confidence procedures are published. Results are reported with confidence intervals and failure diagnosis.

---

## Validation Results

The evaluation protocol in paper §14 is executed and reported publicly. Each report includes full methodology, results, reproducibility data, and diagnostics.

### Test Family

| Test | Description | Status | Key Result | Report |
|---|---|---|---|---|
| **T1** | No-edge baseline (no safety layer) | PASS | Does not fabricate edge from noise | [results/t1/report.md](results/t1/report.md) |
| **T1b** | Exploitation only (ε = 0) | PASS | Zero trades, zero return | [results/t1b/report.md](results/t1b/report.md) |
| **T1c** | Two-phase training | PASS | Learns to hold: 14.03 trades vs 366 baseline | [results/t1c/report.md](results/t1c/report.md) |
| **T1s** | Safety layer active | PASS | Max drawdown 9.07% (vs 72% unconstrained) | [results/t1s/report.md](results/t1s/report.md) |
| **T1st** | Safety layer + two-phase | PASS | Median return 0.00%; max drawdown 6.11% | [results/t1st/report.md](results/t1st/report.md) |
| **T1st-verification** | Audit of T1st inconsistencies | VERIFIED | Dust bug fixed; seed analysis documented | [results/t1st/verification.md](results/t1st/verification.md) |
| **T2** | Known stationary MDP convergence | PASS | Sup-norm Q error 0.075; 100% action agreement | [results/t2/report.md](results/t2/report.md) |
| **T3** | Regime change adaptation | PASS | Constant step adapts 15× faster than diminishing | [results/t3/report.md](results/t3/report.md) |
| **T4** | Economic population survival | PASS | 100% survival @ $5k; band 0.67%–34.33% @ $800 | [results/t4/report.md](results/t4/report.md) |

### What the test family shows

- **T1 family:** The agent does not fabricate edge from noise. With the safety layer active, maximum drawdown is bounded at 6.11% across 30 seeds.
- **T2:** The Q-learning policy converges to the optimal action set on a known, stationary MDP (100% agreement, sup-norm error 0.075).
- **T3:** Constant-step adaptation is approximately 15× faster than diminishing step under a documented regime change (146 vs 2,197 steps), validating Proposition 8.
- **T4:** With $5,000 capital, the agent survives 100% of 24-month simulations in all three market scenarios. Under stress ($800 capital), survival diverges by regime: 34.33% in bull-dominant, 2.67% in symmetric, 0.67% in bear-dominant at 18 months.

All tests run on 30 independent seeds. Generators, parameters, budgets, schedules, and confidence procedures are published in each report.

---

## Economic model

The agent is designed to fund its own operation from realized trading surplus.

- **Cost hurdle.** κ = monthly cost / deployable equity. Expected return after trading costs must exceed κ for expected equity to be maintained.
- **Reserve segregation.** Operating runway, transaction gas, trading capital, and locked stake are separate accounting allocations.
- **Declining risk budgets.** Near distress, the exposure cap scales down. Genetic mutation cannot override reserve segregation, the runway shutdown threshold, or governance caps.
- **Fixed-cost survival.** The paper derives the scale function for the fixed-cost diffusion and provides the correct ruin-probability reference.
- **Validator admission.** An optional, separately governed role with funded-stake, runway, and operational-buffer requirements checked daily over at least 90 consecutive days.

---

## Getting started

```bash
git clone https://github.com/glofica/autonomon
cd autonomon
cp .env.example .env
# Configure RPC endpoint, custody mode, and initial genome
bun install
bun run agent
```

Forecasting and narrative services are optional and can be run locally or shared across a fleet:

```bash
docker compose -f docker-compose.farm.yml up
```

See the technical paper for full configuration semantics, safety constraints, and evaluation protocol.

---

## Repository structure

```
autonomon/
├── docs/
│   └── GLOFICA_Langton_Autonomon.md
├── src/
│   ├── agent/              # Policy controller (Bun/TypeScript)
│   ├── safety/             # Admission, reservations, breaker
│   ├── genome/             # Mutation, projection, inheritance
│   └── ledger/             # Local RPC adapter, reconciliation
├── timesfm-service/        # Shared forecasting oracle (Python)
├── narrative-service/      # Shared narrative worker (Ollama/Qwen)
├── docker-compose.farm.yml
└── README.md
```

---

## Citation

```bibtex
@techreport{malave2026autonomon,
  author       = {Malavé, Germán},
  title        = {GLOFICA DLT — Langton Autonomon: Architecture, Mathematical Foundations, and Protocol Specification for Autonomous Financial Artificial-Life Systems},
  institution  = {GLOFICA DLT},
  year         = {2026},
  month        = {October},
  type         = {Technical research paper and protocol specification},
  url          = {https://github.com/glofica/autonomon}
}
```

---

## License

**Code:** Business Source License 1.1 (BUSL-1.1). Source-available for audit and non-production use. Production use requires a commercial license until the Change Date, after which the license converts to Apache 2.0. See [LICENSE](LICENSE) for full terms.

**Paper:** Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0). See [LICENSE-PAPER](LICENSE-PAPER) for full terms.

---

**Autonomon publishes its bounds. That is why you can trust its edge.**