# 🐜 Langton Autonomon — Artificial Life Financial Organisms

**Self-evolving, autonomous financial organisms powered by Reinforcement Learning, Google TimesFM Foundation Forecasting, and Qwen Cognitive Soul on GLOFICA DLT.**

---

## The Genesis: Inspired by Conway, Evolved into Langton

Months ago, we observed **Conway Automaton** (developed by Conway Research) — an ambitious project exploring autonomous AI agents running in sandboxes. It sparked an essential realization:

> *Conway created **Automatons** — software agents that think with prompts and act through an LLM.*  
> *We needed **Langton** — true artificial life organisms that predict mathematically, learn from quantitative outcomes, evolve their genetic code, maintain their own physical infrastructure, and earn sovereign economic existence.*

While we have not tracked Conway's repository in months nor its recent iterations, the foundational limitations of pure LLM prompting prompted the creation of **Langton Autonomon** from first principles.

### Theoretical Lineage: Christopher Langton, The Ant & Turmites

The architecture is named in honor of **Christopher Langton**, the American computer scientist who pioneered the field of Artificial Life (ALife) in the 1980s. 

In 1986, Chris Langton invented **[Langton's Ant](https://en.wikipedia.org/wiki/Langton%27s_ant)**—a two-dimensional universal **[Turing machine](https://en.wikipedia.org/wiki/Turing_machine)** operating on a **[square lattice](https://en.wikipedia.org/wiki/Square_tiling)** of black and white cells with a minimalistic microscopic rule-set:
1. At a white square: turn 90° clockwise, flip the color of the square, and move forward one unit.
2. At a black square: turn 90° counter-clockwise, flip the color of the square, and move forward one unit.

Despite this elemental simplicity, after approximately 10,000 steps of apparent pseudorandom, chaotic movement, the ant spontaneously establishes a complex **[emergent](https://en.wikipedia.org/wiki/Emergence)** macroscopic structure: an infinite, recurring 104-step diagonal "highway". The concept was subsequently generalized into **[turmites](https://en.wikipedia.org/wiki/Turmite)** (Turing termites), which incorporate multi-state internal orientation matrices and multi-color lattices.

In the Autonomon paradigm, financial order books, automated market maker (AMM) pools, and distributed ledger states are non-Euclidean computational lattices. Rather than treating an agent as a chatbot guessing market moves via natural-language LLM prompts (the Conway approach), an Autonomon functions as an economic turmite traversing a discrete market state space. Simple, deterministic local rules—state discretization, tabular Bellman value iteration ($\arg\max_a Q[s][a]$), and Gaussian genome mutation—yield macroscopic economic emergence: self-organizing liquidity highways, risk-adapted survival, generational inheritance, and sovereign node self-maintenance.

**Langton Autonomon** transcends prompt-based agents by combining:
1. **Google TimesFM (Time Series Foundation Model)** for zero-shot multi-step market trajectory and quantile prediction ($p_{10}, p_{50}, p_{90}$) across any asset. The spread between $p_{90}$ and $p_{10}$ dynamically defines the volatility state, while the slope of $p_{50}$ dictates the inertial trend (strong_up, flat, down) fed directly into the Q-table.
2. **Tabular Q-Learning & RL Policy** ($\arg\max_a Q[s][a]$) for mathematical decision-making instead of linguistic intuition.
3. **Qwen 2.5 on Ollama (The Soul)** for cognitive self-reflection, introspective inner monologues, and market diaries.
4. **Modular Mutable Genome (7 Modules)** with independent gene drift during reproduction.
5. **Autonomous Cluster DevOps**: Prunes RocksDB databases, rotates logs, guards ports against unauthorized intrusion, and **auto-pays for its own VPS hosting and servers from net trading profits**.

---

## 🏛️ The Three-Tier Farm Architecture (Ultra-Scalable & Pragmatic)

To run hundreds of sovereign agents on modest hardware without memory bloat, Langton uses a strict **Three-Tier Separation Rule**:

```
+-----------------------------------------------------------------------------+
|                          LANGTON FARM ARCHITECTURE                          |
+-----------------------------------------------------------------------------+
|                                                                             |
|  [ TIER 1: LANGTON AGENT SWARM (Ultralight ~25 MB RAM each) ]              |
|  Running in Bun runtime. Each agent contains:                               |
|      Financial Brain: Tabular Q-Learning (high-speed in-memory Q-table)     |
|      Sovereign Ed25519 Wallet (signs transactions locally in container)     |
|      Mutable Genome (7 independent modules)                                 |
|      RocksDB Pruner & Security Watchdog                                     |
|    ⚡ Capacity: 50 to 100 live agents consume only ~1.5 GB to 2.5 GB RAM!   |
|                                                                             |
|         │ HTTP (:8008)                               │ HTTP (:11434)       |
|                                                                             |
|  [ TIER 2: PREDICTIVE ORACLE ]               [ TIER 3: THE SOUL ]           |
|    Google TimesFM Container                    Ollama (Qwen 2.5)            |
|    Single Python/FastAPI service               Single shared service        |
|    Broadcasts zero-shot quantile               Invoked by agents only for   |
|    forecasts (p10/p50/p90) to swarm            introspective trade diaries  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

| Component | Location | RAM Footprint | Role |
|---|---|---|---|
| **Financial Brain & Wallet** | Inside each agent (Bun) | **~25 MB** | Tabular Q-Learning, $\arg\max_a Q[s][a]$ policy, local Ed25519 signing. |
| **Predictive Oracle (TimesFM)** | 1 shared Python container | **~2-4 GB** | Zero-shot multi-step foundation quantile forecasting ($p_{10}, p_{50}, p_{90}$). |
| **The Soul (Ollama / Qwen)** | 1 shared Ollama service | **~4-8 GB** | Inner cognitive monologues, emotional sentiment, and trade diaries over HTTP. |

---

## 🛠️ Autonomous DevOps: Self-Maintenance & Economic Self-Sufficiency

Langton agents are not passive processes; they autonomously maintain their physical infrastructure and settle their operational bills from net trading surplus:

1. **Autonomous RocksDB Pruning (`RocksDbPruner`)**:
   - Continuously monitors storage saturation on the GLOFICA DLT ledger volume.
   - When disk capacity exceeds the threshold (e.g., 80%), it automatically executes historical state pruning and SST compaction.
   - Sweeps and rotates stale log files, preventing disk saturation halts.
2. **Security Sentinel (`SecuritySentinel`)**:
   - Audits active network ports (ensuring only port 22222 for hardened SSH, 9000 for RPC, and WireGuard are open).
   - Mitigates abusive traffic with automated iptables rate-limiting against RPC flooding.
   - Inspects CPU and memory allocations to prevent process hijacking.
3. **Financial Self-Sufficiency (`SelfFundingLedger`)**:
   - Deducts operational infrastructure costs ($15-$20 USD/mo amortized) directly from net realized trading surplus.
   - Autonomously pays hosting invoices without human intervention.

---

## Conway Automaton vs. GLOFICA Langton

| Dimension | 🤖 Conway Automaton *(Inspiration)* | 🐜 GLOFICA Langton *(Our Invention)* |
|---|---|---|
| **Core Metaphor** | Passive cellular automaton (Game of Life) | Evolutionary Artificial Life Organism (Chris Langton) |
| **Decision Engine** | Prompted LLM text ("In my opinion, gold is...") | **Mathematical Q-Learning** + **Google TimesFM** ($p_{10}, p_{50}, p_{90}$) |
| **Farm Architecture** | Monolithic / resource-heavy per agent | **Three-Tier**: Ultralight agent (~25 MB) + shared TimesFM + shared Ollama |
| **Genetics** | Clones identical replicas | **7-Module Genome** with Gaussian drift mutation and Q-table inheritance |
| **Node Maintenance** | None (manual human log rotation & DB maintenance) | **Autonomous SRE**: RocksDB pruning, log sweeper, firewall hardening |
| **Economic Self-Funding**| Consumes credits until termination | **Self-Funding VPS**: Settles server hosting from net trading profits |
| **Target Blockchain** | Generic EVM (Ethereum / Base) | **GLOFICA DLT** (Move VM, gas denominated in uXGO, exact 6 decimals) |
| **Key Custody** | Cloud / Third-Party API | **Sovereign Local**: Ed25519 signing in isolated sandbox; zero private key leaks |

---

## Quick Start: Farm Deployment

```bash
# Clone the sovereign swarm repository
git clone https://github.com/glofica/autonomon.git
cd autonomon

# 1. Compile TypeScript agents
npm run build

# 2. Run local simulation (TimesFM + Q-Learning + Qwen Soul + Pruning + Reproduction)
npm run demo

# 3. Deploy full production farm with Docker Compose
docker-compose -f docker-compose.farm.yml up -d
```

---

## Protocol Native Fuel & Denominations
- **Native Network Fuel**: **XGO** (Sovereign Layer-1 utility & gas asset).
- **Precision**: 6 decimal places ($1\text{ XGO} = 1,000,000\text{ }\mu\text{XGO}$).
- **Gas Invariant**: 100% of network execution fees flow directly to active BFT validator nodes (0% protocol burn).

---

---

## 🛡️ Cryptographic Security & Post-Quantum Roadmap

GLOFICA DLT is architected from inception as a post-quantum resilient network. To maintain complete transparency regarding our cryptographic roadmap:

- **Current v1 Swarm Cryptography:** Agents currently utilize sovereign **Ed25519** elliptic-curve keypairs residing in isolated in-memory sandboxes. This provides microsecond signing speeds (~0.5ms) and minimal memory footprints (~25 MB) during the current initial mainnet rollout.
- **Post-Quantum Migration (Active R&D):** We are actively benchmarking and integrating the lightweight **ML-DSA-44** parameter set (NIST FIPS 204 Category 2, Module-Lattice-Based Digital Signature Algorithm). With a compact public key of 1,312 bytes and signature size of 2,420 bytes, ML-DSA-44 provides the optimal operational balance between NIST-certified quantum resistance and minimal mempool bandwidth/gas overhead for high-frequency agent transactions. Once finalized on Move VM, agent sovereign accounts will transition to ML-DSA-44 via a transparent protocol epoch upgrade without swarm interruption.

---

## License
MIT — Engineered as the native artificial life biosphere for GLOFICA DLT.

---

## Author & Maintainer
Created and maintained by **[Germán Malavé](https://github.com/Praexor)** ([@Praexor](https://github.com/Praexor)) — Founder & Chief Architect, GLOFICA DLT.
