# GLOFICA DLT — Langton Autonomon

## Architecture, Mathematical Foundations, and Protocol Specification for Autonomous Financial Artificial-Life Systems

**Author & Chief Architect:** Germán Malavé (@Praexor), GLOFICA DLT  
**Date:** October 2026  
**Document type:** Technical research paper and protocol specification  
**Organization:** GLOFICA DLT  
**Repository:** https://github.com/glofica/autonomon

**Target network:** GLOFICA DLT, an object-centric Move execution environment with BFT consensus. XGO is the designated gas asset, with six decimal places. Network identity, RPC compatibility, framework semantics, performance, and deployment status must be verified against a pinned implementation. These declarations are not established by the mathematical results below.

---

## Abstract

An Autonomon is an autonomous financial controller architecture combining a discretized tabular reinforcement-learning policy, a time-series forecasting service, constrained parameter mutation, and a dedicated non-validating fullnode. Operational monitoring and transaction authorization are separate from policy optimization. A language model may generate asynchronous commentary, but has no authority to bypass execution constraints.

This specification defines a practical observation-based controller and distinguishes it from a finite stationary Markov decision process used for conditional theoretical analysis. It proves uniqueness of the observation discretization, boundedness of projected genomes, boundedness of Q-values under bounded rewards, preservation of explicitly enforced accounting constraints under stated transition assumptions, a PAC sample-complexity lower bound on the discretized table, a tracking bound under non-stationarity, a price-of-safety bound for the admissible-action restriction, an effective-trial correction for correlated reproduction gates, and a closed-form scale function for fixed-cost survival. It does not prove profitable trading, reliable forecasting, convergence in arbitrary changing markets, universal computation, or survival against unrestricted market losses.

---

## Taxonomy of statements

Throughout this paper, statements are tagged with one of the following labels:

- **[A] Assumption** — a condition imposed on the model or deployment, not proved here.
- **[D] Definition** — a fixed convention or symbol.
- **[P] Proposition** — a result proved from [A], [D], and previously established [P].
- **[V] Verification obligation** — a property that must be checked against a pinned implementation or observed data before it can be used.
- **[T] Empirical hypothesis** — a claim testable only by experiment, with no analytical proof here.

A reader should not treat a [P] result as valid outside its [A] assumptions, and should not treat [V] or [T] items as established by the mathematics of this paper.

---

## Notation

| Symbol | Meaning | First defined |
|---|---|---|
| $z_t$ | Operational state schema | §2 |
| $o_t$ | Raw observation | §2 |
| $\phi$ | Feature mapping $o_{0:t}\mapsto s_t$ | §2 |
| $s_t\in\mathcal S$ | Discretized policy state | §2 |
| $\mathcal S,\mathcal A$ | Nominal state and action sets | §2 |
| $P,R,\gamma$ | MDP transition, reward, discount | §2 |
| $\mathcal C$ | Controller configuration tuple | §2 |
| $\mathcal S_{trend}, \mathcal S_{rsi}, \mathcal S_{forecast}, \mathcal S_{vol}, \mathcal S_{pos}, \mathcal S_{health}$ | State coordinates | §3 |
| $u_t$ | Normalized trend statistic | §3.1 |
| $U_t, D_t$ | Forecast width and drift | §3.3 |
| $\sigma_t$ | Realized volatility | §3.4 |
| $e_t$ | Inventory exposure ratio | §3.5 |
| $\rho_t$ | Funded-runway ratio | §3.6 |
| $d_t$ | Disk utilization | §3.6 |
| $\mathcal A_{safe}(z_t)$ | Admissible action set under safety layer | §4 |
| $\epsilon_t,\alpha_t$ | Exploration and step-size schedules | §4 |
| $F_t, \Pi_{t+1}$ | External flow, net performance | §5 |
| $J_t, M_t, DD_t$ | Unitized index, running max, drawdown | §5 |
| $V_t, V_{floor}, R_{max}$ | Equity, reward floor, reward clip | §5 |
| $r_{t+1}$ | Bounded reward | §5 |
| $B, g_{gas}, L, C$ | Gas reserve, protected reserve, spend, fee | §6 |
| $\eta, \eta_{max}$ | Stress-loss allowance, cap | §6, §12 |
| $g=(g_i)_{i=1}^7$ | Genome vector | §7 |
| $\Omega$ | Genome box | §7 |
| $K, K_{eff}, \rho$ | Trial count, effective trials, clone correlation | §7.1 |
| $L, R_p, C_{setup}, T$ | Liquid capital, retained funding, setup cost, transfer | §7.3 |
| $A_t^{USD}, c_t^{USD}, \kappa_t$ | USD equity, monthly cost, cost hurdle | §12.1 |
| $g_\omega^{eff}(\rho)$ | Runway-adjusted exposure cap | §12.2 |
| $S'(x), S(x)$ | Scale function and its integral | §12.3 |
| $E_{eligible}, S_{min}, R_{run}, R_{ops}$ | Validator admission quantities | §13 |

---

## 1. Executive overview and artificial-life paradigm

The **Langton Autonomon** architecture applies an artificial-life perspective to financial automation. Each organism has a resource budget, a decision policy, an operational environment, a mutable parameter genome, and a reproduction mechanism. Local observations and feedback drive behavior; infrastructure and execution constraints govern the actions that can actually occur.

The name acknowledges Langton's local-rule approach to artificial life [9]. Here, the economic environment is a graph of assets, venues, and permitted transitions. The financial controller is defined by its observation mapping, learning rule, and execution interface. Computational universality is not a prerequisite for any result in this paper.

The design combines:

1. A fullnode that verifies ledger data according to the selected protocol.
2. A policy runtime that proposes financial actions.
3. A forecasting service that supplies timestamped predictions.
4. An execution safety layer that authorizes or rejects concrete transactions.
5. An operational supervisor that handles node health and hosting.
6. An optional narrative service with read-only access to sanitized telemetry.

The architecture is organized into three tiers. Tier 1 (sovereign operational core) contains the policy, safety layer, genome, supervisor, and keystore. Tiers 2 and 3 (TimesFM oracle, cognitive soul) are shared, stateless services external to the agent. See §8.

TimesFM [5] is the forecasting component, not an assumed source of profitable information. Its exact version, checkpoint, preprocessing, quantile behavior, and inference configuration must be recorded. Q-learning is a numerical policy method; removing a language model from the execution path does not remove market uncertainty, numerical errors, stale data, or software defects.

The controller can support different assets through adapters. This does not make all assets interchangeable: prices, redemption rights, transfer restrictions, liquidity, maturities, and oracle risks require instrument-specific handling. An object identifier alone does not establish economic value or legal eligibility.

### 1.1 Asset adapters and economic observations

**[D]** The architecture accommodates spot tokens, liquidity-pool positions, tokenized debt, real-world-asset claims, and conditional instruments through dedicated adapters. Each adapter defines admissible transfers, executable pricing, maturity or redemption conditions, valuation, and settlement. For instruments with sparse or discontinuous observations, forecasting and reward attribution use an explicitly declared sampling and valuation policy.

### 1.2 Separation of prediction, choice, and authority

**[D]** The forecasting component produces observations. The Q policy ranks action proposals. The safety layer determines execution authority. The narrative component explains recorded behavior asynchronously. This separation permits policy experimentation while keeping hard execution constraints under a dedicated, auditable authority boundary. The separation is a design invariant, not a claim that the components are individually correct.

---

## 2. Environment and controller model

**[D]** Let the operational state be

$$
z_t=(m_t,c_t,q_t,V_t,M_t,d_t,\ell_t,h_t,b_t,g_t,\eta_t),
$$

where the components represent market information, liquid balances, inventory, marked net asset value, adjusted high-water mark, storage health, liquidity and execution conditions, pending transactions, breaker state, genome, and relevant history. This is a descriptive state schema, not a claim that an observable finite-dimensional state captures every market variable.

**[D]** An observation process supplies $o_t$. A feature mapping produces

$$
s_t=\phi(o_{0:t})\in\mathcal S.
$$

**[A]** The implemented controller operates on these observations. It is generally an approximation to a partially observed, non-stationary control problem. Its transition kernel may depend on time and history. Neither Markov sufficiency nor stationarity follows from discretization.

**[D]** For a **separate theoretical benchmark**, assume a finite stationary MDP

$$
\mathcal M=(\mathcal S,\mathcal A,P,R,\gamma),
$$

with $P(s'\mid s,a)\ge0$, $\sum_{s'}P(s'\mid s,a)=1$, a bounded scalar reward, and $0\le\gamma<1$. This benchmark is applicable only if the chosen state is Markov sufficient. In particular, rewards involving NAV, high-water marks, or timers require those variables to be represented or an exact aggregation property to be established. Expanding the state changes the cardinality calculated in Section 3.

**[D]** The controller configuration is

$$
\mathcal C=(\phi,\mathcal A,Q,\gamma,\alpha_t,\epsilon_t,g,\mathsf{Safe},\mathsf{Exec}).
$$

Cryptographic identity belongs to the execution system; it is not a condition establishing MDP convergence.

---

## 3. Observation discretization

**[A]** All observations must be finite, fresh enough for the configured strategy, and expressed in declared units. Invalid inputs route to an external fail-safe mode rather than an arbitrary market bucket. The normal policy table is used only for valid observations.

**[D]** The nominal table uses

$$
\mathcal S=S_{trend}\times S_{rsi}\times S_{forecast}\times S_{vol}\times S_{pos}\times S_{health}.
$$

### 3.1 Trend: five categories

**[D]** Using $N\ge2$ returns from a fixed configured lookback, compute their mean $\hat\mu_t$ and volatility $\hat\sigma_t$ at the same sampling frequency. With a positive dimensionless floor $\sigma_{floor}$, define

$$
u_t=\frac{\sqrt N\,\hat\mu_t}{\max(\hat\sigma_t,\sigma_{floor})}.
$$

Classify as STRONG_UP for $u_t>2$, UP for $0.5<u_t\le2$, FLAT for $-0.5\le u_t\le0.5$, DOWN for $-2\le u_t<-0.5$, and STRONG_DOWN for $u_t<-2$.

**[V]** Under zero-mean iid returns with suitable finite moments, sufficiently large $N$, and an inactive floor, this statistic is approximately standard normal. The corresponding approximate aggregate occupancies are 4.55% for the two STRONG buckets, 57.16% for UP and DOWN, and 38.29% for FLAT. These are null-model illustrations, not occupancy targets or significance guarantees. Finite-sample Gaussian returns with estimated variance require a Student-t adjustment; the $N$-denominator volatility used in Section 3.4 also changes the finite-sample scale. Serial dependence, heavy tails, overlapping windows, and the variance floor alter the distribution.

**[V]** Publish empirical bucket occupancy by instrument and regime, together with the window and sampling interval. If an autocorrelation-robust standard error replaces $\hat\sigma/\sqrt N$, version the feature schema and recalibrate thresholds. Normalization improves numerical interpretation; predictive information remains an empirical question.

### 3.2 Momentum: three categories

**[D]** For a configured RSI-14 implementation, classify as OVERSOLD for RSI < 30, NEUTRAL for 30 ≤ RSI ≤ 70, and OVERBOUGHT for RSI > 70. Specify initialization and zero-gain/zero-loss behavior in the implementation. RSI must lie in [0,100]; otherwise fail validation.

### 3.3 Forecast: four categories

**[D]** For a positive-price instrument, let $P_t>0$ be the current observed price, and let $q_{10},q_{50},q_{90}$ be quantiles forecast at horizon $H=32$ samples. Require finite ordered quantiles and $q_{50}>0$. Define

$$
U_t=\frac{q_{90}-q_{10}}{q_{50}},\qquad D_t=\frac{q_{50}-P_t}{P_t}.
$$

Classify as VOLATILE_UNCERTAINTY if $U_t\ge0.05$; otherwise BULLISH_EXPANSION if $D_t>0.015$, BEARISH_EXPANSION if $D_t<-0.015$, and TIGHT_RANGE if $|D_t|\le0.015$.

**[V]** TIGHT_RANGE is a descriptive label, not evidence of accumulation. The width is a model output, not a guaranteed calibrated uncertainty measure. Quantile calibration must be tested. Nonpositive-price instruments require a separate documented normalization and feature schema.

### 3.4 Realized volatility: three categories

**[D]** For $N\ge2$ finite returns at a declared sampling interval,

$$
\sigma_t=\sqrt{N^{-1}\sum_{i=0}^{N-1}(r_{t-i}-\bar r_t)^2}.
$$

Choose fixed configuration thresholds $0<v_1<v_2$. LOW means $\sigma_t<v_1$, MEDIUM means $v_1\le\sigma_t<v_2$, and HIGH means $\sigma_t\ge v_2$. The denominator $N$ defines a descriptive population statistic, not an unbiased sample-variance estimator. Values of $N$, $v_1$, $v_2$, and the sampling interval must be published for each experiment.

### 3.5 Inventory: four categories

**[D]** For a valid positive NAV, let $e_t\ge0$ be gross marked inventory exposure divided by NAV. Configure $0\le e_0<e_1$ and an instrument-specific, measurable hedge predicate $H_t$. Use the following priority: FLAT if $e_t\le e_0$; otherwise HEDGED if $H_t$ holds; otherwise LIGHT_LONG if $e_t\le e_1$; otherwise HEAVY_LONG.

**[A]** The last two labels assume the unhedged strategy is long-only. Strategies allowing unhedged shorts require different labels or additional categories. A hedge classification does not imply zero risk. Exposure thresholds and the hedge predicate are required configuration, not unspecified judgment.

### 3.6 Operational health: three categories

**[D]** Health is measured by funded operating runway and disk utilization. Let $c^{USD}_t>0$ be the conservative monthly operating budget, including allocated hosting, inference, storage, and other recurring commitments. Let $R^{USD,exec}_t\ge0$ be segregated, unencumbered operating reserves at executable value, net of due liabilities and conversion costs. Define

$$
\rho_t=\frac{R^{USD,exec}_t}{c^{USD}_t}.
$$

For a reserve held entirely in XGO, with conservative executable conversion price $p_t^{exec}>0$ USD/XGO, $c_t=c^{USD}_t/p_t^{exec}$ XGO/month and $\rho_t=B^{run}_t/c_t$. The runway balance $B^{run}$, transaction-gas balance, trading capital, and locked validator stake are separate accounting allocations. They cannot fund two commitments simultaneously. Price haircuts must account for sale size, depth, volatility, fees, and conversion into the actual billing asset.

**[D]** For valid disk utilization $d_t\in[0,1]$, set $d_R=0.70$, $d_C=0.85$, and define

$$
S_{health}=\begin{cases}
CRITICAL,&\rho_t<1\ \lor\ d_t\ge d_C,\\
RESTRICTED,&\neg(\rho_t<1\ \lor\ d_t\ge d_C)\ \land\ (\rho_t<3\ \lor\ d_t\ge d_R),\\
SOLVENT,&\rho_t\ge3\ \land\ d_t<d_R.
\end{cases}
$$

**[V]** SOLVENT denotes operational coverage, not comprehensive legal solvency. An invalid, stale, or unavailable conversion price routes the controller to fail-safe operation whenever that price is required to value its reserves. Unavailable market depth is not replaced by a last-traded quote. Unexpected expense changes trigger immediate recalculation.

**[V]** For illustration only, the author supplies $p=0.0001$ USD/XGO and hosting of 15 USD/month. Neither is independently verified. This budget requires 150,000 XGO/month. At a 30-day accounting month, 500 and 1,000 XGO cover only 2.4 and 4.8 hours, respectively. The one-month and three-month runway thresholds adapt to actual costs instead of fixed token quantities.

**Proposition 1 — Unique classification. [P]** Each valid observation receives exactly one category in each coordinate, hence exactly one nominal tuple. **Proof.** The numerical intervals in Sections 3.1–3.4 partition their valid domains. Section 3.5 uses an explicit priority. In Section 3.6, CRITICAL is checked first, RESTRICTED excludes it, and SOLVENT is the complement of their union. All cases are disjoint and exhaustive. ∎

**[A]** Feature definitions and threshold semantics are fixed during a learning run. A change to those definitions requires compatible policy migration or a new table. Changing observed prices and costs under the same definition does not change the schema.

### 3.7 Cardinality, memory, and sample coverage

**[D]** The Cartesian product has

$$
|\mathcal S|=5\cdot3\cdot4\cdot3\cdot4\cdot3=2160.
$$

Five financial action labels yield 10,800 Q entries. A contiguous float64 buffer occupies 86,400 bytes = 84.375 KiB, excluding runtime overhead. Pruning and infrastructure defense are mandatory supervisor processes rather than learned actions.

**[D]** At one decision per hour, a 365-day year supplies 8,760 transitions: only 0.811 updates per nominal state-action cell on average. At one decision per five minutes, it supplies 105,120 transitions, or 9.733 updates per cell. These are arithmetic coverage budgets, not actual uniform visitation; infeasible actions, inaccessible states, dependence, and uneven occupancy reduce useful coverage.

**Proposition 7 — Sample-complexity gap for the nominal table. [P]** Consider the finite stationary benchmark MDP of Section 2 with $|\mathcal S|=2160$, $|\mathcal A|=5$, reward bounded by $R_{max}$, discount $\gamma$, and a generative model. To obtain a Q-function that is $\varepsilon$-optimal in sup-norm with probability at least $1-\delta$, it suffices to draw, for each state-action pair,

$$
n_{\text{per pair}} = \Theta\!\left(\frac{R_{max}^2}{\varepsilon^2(1-\gamma)^2}\log\frac{|\mathcal S||\mathcal A|}{\delta}\right)
$$

samples (Kearns & Singh 1998 [10]; Azar et al. 2013 [11] give tighter constants). **Proof.** Apply the standard phased Q-learning or empirical-MDP argument; the bound follows from a union bound over state-action pairs and Hoeffding's inequality on each reward estimate. ∎

**Numerical illustration. [V]** With $R_{max}=1$, $\gamma=0.95$, $\varepsilon=0.1$, $\delta=0.05$:

$$
n_{\text{per pair}} \approx 4.9\times10^{5}.
$$

At five-minute sampling, Section 3.7 supplies 9.733 updates per cell per year. **The PAC requirement exceeds the annual data budget by roughly five orders of magnitude.** Even relaxing the bound by a factor of one hundred leaves a shortfall of several centuries.

**Design implication. [T]** The nominal table is too large for the data regime it is intended to populate. Three responses are available and mutually compatible:

1. **State aggregation.** Reduce coordinates whose empirical distributions are near-degenerate in a given instrument (e.g., forecast width may be nearly always TIGHT_RANGE outside stress windows).
2. **Function approximation.** Replace the table with a linear or small-network approximation on a continuous feature vector; this changes the convergence theory entirely and must be re-derived.
3. **Hierarchical priors.** Share structure across instruments via a pooled prior over Q-tables, then adapt per instrument with a much smaller local budget.

Any of these choices invalidates Proposition 2's direct application and requires a new bound. The design decision is empirical, not free.

**[V]** An optional drawdown observation uses three disjoint categories with configured thresholds $0<\delta_1<\delta_2<1$: LOW for $DD<\delta_1$, MEDIUM for $\delta_1\le DD<\delta_2$, and HIGH for $DD\ge\delta_2$. It increases the nominal table to 6,480 states, 32,400 entries, and 259,200 bytes = 253.125 KiB. This feature extension does not establish exact Markov sufficiency: a bucket can still alias distinct histories and wealth values. It is an explicitly evaluated alternative to the default six-coordinate state, not a convergence proof.

---

## 4. Actions, execution timing, and learning

**[D]** The action labels are HOLD, ACQUIRE_SPOT, DISPOSE_SPOT, PROVIDE_LIQUIDITY, and REDUCE_INVENTORY. A deterministic, versioned adapter translates each label into a concrete quantity, venue, gas budget, price bound, and expiry. Without such a mapping, these labels do not fully define an action space. Pruning, log rotation, resource protection, and emergency defense run deterministically in the supervisor and cannot be disabled by exploration.

**[D]** The safety layer computes admissible labels from the full validated execution snapshot:

$$
\mathcal A_{safe}(z_t)\subseteq\mathcal A.
$$

Both greedy selection and random exploration use this set. If it is empty, suspend submissions and invoke the external recovery supervisor. HOLD incurs no trading transaction but may still incur hosting costs.

**[D]** For nonempty admissible sets, use epsilon-greedy selection with a recorded random seed and a documented tie-breaking rule. Set $\epsilon_0=g_\epsilon$ and

$$
\epsilon_{t+1}=\max(0.05,0.995\epsilon_t).
$$

**[D]** The Q update is

$$
Q(s_t,a_t)\leftarrow(1-\alpha_t)Q(s_t,a_t)+\alpha_t[r_{t+1}+\gamma V_Q(s_{t+1})].
$$

For a terminal transition, $V_Q=0$. Otherwise use the maximum over the next admissible labels; in the practical controller these are obtained from the next full execution snapshot. If none are admissible, treat policy operation as terminated pending recovery.

**[A]** Because feasibility can depend on information omitted from $s$, this practical update is not automatically Q-learning on a stationary finite MDP. In the theoretical benchmark, admissible sets must be functions of the Markov state itself.

**[D]** Use $\gamma\in[0.90,0.99]$ and $\alpha_t=g_\alpha\in[0.01,0.25]$ for practical tracking. Constant step sizes keep incorporating new samples; they do not guarantee tracking accuracy or convergence. Exploration does not guarantee infinite visitation to every state.

**[A]** The classic stationary convergence result requires a suitable finite MDP, bounded rewards, infinite visitation of applicable state-action pairs, and per-pair step sizes satisfying $\sum_n\alpha_n=\infty$ and $\sum_n\alpha_n^2<\infty$. These conditions are not asserted for live markets [1,2].

**Proposition 8 — Tracking error under non-stationarity. [P]** Let $Q^*_t$ denote the Q-function of the time-varying MDP at step $t$ under the benchmark assumptions, and suppose the per-step variation satisfies $\|Q^*_{t+1}-Q^*_t\|_\infty\le\Delta$ for all $t$. Run the constant-step update above with $\alpha_t=\alpha\in(0,1]$ and rewards bounded by $R_{max}$. Then, under the standard noise and drift assumptions of non-stationary stochastic approximation (Besbes, Gur & Zeevi 2014 [12]; Cheung, Simchi-Levi & Zhu 2020 [13]),

$$
\limsup_{t\to\infty}\ \mathbb E\|Q_t-Q^*_t\|_\infty \;\le\; C\left(\alpha+\frac{\Delta}{\alpha}\right)
$$

for a constant $C=C(R_{max},\gamma)$. The minimizing step size is $\alpha^\star=\sqrt{\Delta}$, yielding a tracking error of order $O(\sqrt{\Delta})$. **Proof sketch.** Decompose $\mathbb E\|Q_t-Q^*_t\|_\infty$ into a variance term of order $\alpha R_{max}/(1-\gamma)$, coming from the constant step size, plus a lag term of order $\Delta/\alpha$, coming from the non-stationary drift. Minimize over $\alpha$. Full details follow the standard bias-variance decomposition for constant-gain stochastic approximation. ∎

**Interpretation. [T]** The tracking error scales with the **square root of the market's non-stationarity**. This provides a quantitative guide for $g_\alpha$: if a preliminary estimate suggests $\Delta$ per-step variation, the appropriate step size is approximately $\sqrt{\Delta}$, not an arbitrary value in $[0.01,0.25]$. The proposition also shows why a constant step size is preferable to a diminishing one in a non-stationary environment: diminishing steps eventually stop adapting, while constant steps maintain an irreducible but bounded tracking error.

**[V]** Each update must correspond to a reconciled transition. Distinguish submitted, pending, finalized, failed, and expired transactions. Use transaction identifiers to prevent duplicate reward attribution. Observation interval, decision interval, and settlement interval are distinct quantities; $H=32$ means 32 samples, not 32 seconds. End-to-end latency is measured across observation, inference, admission, submission, and finality.

---

## 5. Accounting and bounded reward

**[D]** Define NAV in nominal XGO using a documented valuation policy that includes liabilities, accrued hosting costs, gas, and other recognized costs. Record oracle timestamps and executable liquidity assumptions. A paper valuation does not imply immediate liquidation at that price.

**[D]** Let $F_t$ be signed net external capital inflow during the transition, including deposits and transfers between parent and child. Define net performance

$$
\Pi_{t+1}=V_{t+1}-V_t-F_t.
$$

Gas and operational costs already recognized in NAV are not subtracted again as accounting losses. Separate reward penalties may intentionally discourage them.

**[D]** For positive initial equity, construct a unitized performance index $J_t>0$ that neutralizes external flows. For an end-of-period flow after market performance, define

$$
J_{t+1}=J_t\frac{V_{t+1}-F_t}{V_t}.
$$

Require $V_t>0$ and $V_{t+1}-F_t>0$. Flows occurring inside the period require event-level unitization or explicitly defined subperiod returns; the equation above must not be applied with the wrong flow timing. Let $M_t=\max_{\tau\le t}J_\tau$, and

$$
DD_t=1-J_t/M_t\in[0,1).
$$

**[D]** At equity exhaustion, record $DD=1$ and transition to financial termination. Negative-equity cases are recorded as insolvency rather than forced into the positive-equity return model.

**[D]** The default learning reward uses the flow-adjusted log return and omits historical drawdown. On valid positive-equity transitions, define

$$
\ell_{t+1}=\log\left(\frac{V_{t+1}-F_t}{V_t}\right),
$$

$$
w_{t+1}=\ell_{t+1}
-\lambda_g\frac{C^{gas}_{t+1}}{\max(V_t,V_{floor})}
-\lambda_s I_{storage\ fault}
-\lambda_f I_{financial\ termination},
\qquad
r_{t+1}=\operatorname{clip}(w_{t+1},-R_{max},R_{max}).
$$

Here $V_{floor}>0$ is in XGO, all weights are nonnegative and dimensionless, and $R_{max}>0$. Gas and accrued operating costs are already included in NAV; the gas term is an additional behavioral penalty. For invalid logarithm arguments caused by equity exhaustion, use a separately configured terminal reward in $[-R_{max},0)$ and a zero bootstrap target. Missing or invalid market data instead causes operational suspension and reconciliation; it must not be silently relabeled as an economic loss.

**[V]** Drawdown is tracked by the safety layer for circuit breakers, reporting, and stress controls. Removing it from reward removes one direct source of historical dependence, but does not prove that the joint reward/transition law is determined by the discretized state. Hidden inventory details, wealth-dependent fixed costs, forecast history, timers, and changing admissible sets remain relevant. The theoretical MDP needs a stationary conditional distribution of reward and next state given current state and action; rewards need not be deterministic functions of the pair. Exact sufficiency requires proof or a fully specified synthetic benchmark.

**[V]** Retain unclipped returns, NAV, costs, and drawdown in the audit record. Clipping changes the learning objective; bounded rewards and bounded Q-values do not bound financial losses.

**Proposition 2 — Bounded Q-values. [P]** Suppose initial Q-values are finite, $|r_t|\le R_{max}$, fixed $0\le\gamma<1$, and $0<\alpha_t\le1$. Then

$$
\|Q_t\|_\infty\le B=\max\left(\|Q_0\|_\infty,\frac{R_{max}}{1-\gamma}\right).
$$

**Proof.** If all entries are bounded by $B$, the bootstrap target has absolute value at most $R_{max}+\gamma B\le B$. The update is a convex combination of the old entry and this target; unchanged entries remain bounded. Induction gives the result, including terminal targets. ∎

**[V]** This algebraic result does not require a stationary market. It does require valid finite numerical inputs and applies between inheritance events; unbounded Gaussian additions to Q would violate a uniform bound across generations. Section 7 therefore projects inherited Q-values.

---

## 6. Safety specification, conditional invariants, and threat model

**[A]** Safety checks are mandatory and independent of the learned reward. Transaction admission uses the current full execution snapshot, pending reservations, and conservative execution bounds. It checks authorization, transfer restrictions, gas reserve, exposure, slippage, liquidity, valuation freshness, breaker state, and object versions. Serialize decisions sharing funds or use atomic reservations. Release reservations only after reconciliation.

**[D]** For liquid gas reserve $B$, protected reserve $g_{gas}$, worst-case spend $L$, and maximum fee $C$, admission requires

$$
B-L-C\ge g_{gas}.
$$

$L$ includes any trade-funded spend from that reserve; $C$ includes the bounded fee charged even when the trade fails. Pending transactions must already be deducted from available $B$. Hosting commitments require an additional budget; XGO gas reserves alone do not fund a bill denominated in another asset.

**[D]** For a concentration constraint $E_i/V\le g_\omega$, require positive NAV and conservative post-trade valuation bounds. If no reliable bounds exist, the controller cannot assert that the inequality will hold and must decline risk-increasing execution. Price movements after execution may subsequently violate a concentration ratio.

**Proposition 3 — Conditional reserve preservation. [P]** Suppose the initial reserve is at least $g_{gas}$, every reserve-decreasing event is admitted under the inequality above, all fees and spends respect the admitted bounds, and there are no unmodeled reserve debits. Then $B$ remains at least $g_{gas}$ after every admitted event. **Proof.** Actual post-event $B$ is at least $B-L-C\ge g_{gas}$; apply induction. ∎

**Proposition 4 — General invariant preservation. [P]** Let $K$ be a declared safe set. If $z_0\in K$, every admissible action satisfies $f(z,a,w)\in K$ for every allowed disturbance $w\in W(z,a)$, and the real transitions lie in that disturbance model, then $z_t\in K$ for all $t$. **Proof.** Direct induction on transitions. ∎

**[V]** Proposition 4 is a verification obligation: the paper does not establish its premise for arbitrary markets. A flash crash, unbounded slippage, oracle failure, asset freeze, or disappearance of liquidity may invalidate assumed disturbance bounds. No learned policy guarantees capital preservation against unrestricted shocks.

### 6.1 Price of safety

**[D]** Let $\pi^\star$ denote the optimal policy for the unrestricted benchmark MDP and $\pi_{safe}$ the optimal policy under the safe-admissible restriction $\mathcal A_{safe}(s)\subseteq\mathcal A(s)$. Let

$$
B=\{s\in\mathcal S:\ \mathcal A_{safe}(s)\neq\mathcal A(s)\}
$$

denote the set of states where the safety layer removes at least one action, and $\tau_B$ the first hitting time of $B$ under $\pi^\star$.

**Proposition 9 — Price of safety. [P]** Under the benchmark assumptions of Section 2 and bounded rewards $|r|\le R_{max}$, for every initial state $s_0$,

$$
V^{\pi^\star}(s_0)-V^{\pi_{safe}}(s_0)\;\le\;\frac{2R_{max}}{1-\gamma}\,\mathbb P^{\pi^\star}\!\left(\tau_B<\infty\mid s_0\right).
$$

**Proof.** Consider the policy $\tilde\pi$ that follows $\pi^\star$ until $\tau_B$ and thereafter follows any admissible policy. Before $\tau_B$, $\pi^\star$ uses only actions in $\mathcal A_{safe}$, since $s\notin B$ implies $\mathcal A_{safe}(s)=\mathcal A(s)$. Hence $\tilde\pi$ is admissible, so $V^{\pi_{safe}}\ge V^{\tilde\pi}$. After $\tau_B$, the per-step loss relative to $\pi^\star$ is bounded by $2R_{max}$. Therefore

$$
V^{\pi^\star}(s_0)-V^{\pi_{safe}}(s_0)\le \mathbb E\!\left[\sum_{t\ge\tau_B}\gamma^t\cdot 2R_{max}\right]\le\frac{2R_{max}}{1-\gamma}\,\mathbb P(\tau_B<\infty).
$$

∎

**Interpretation. [T]** The cost of the safety layer is proportional to the probability that the unconstrained optimal policy needs an action that safety forbids. If this probability is small, the safety layer is nearly free in expected value. If it is large — for example, if the risk-aversion genome is set to an aggressive value, or if the market enters a state where the unconstrained policy wants to short an instrument the safety layer restricts to long-only — the price is substantial. The bound is loose (it replaces the discounted post-hit reward gap by its worst case $2R_{max}$), but it is the first quantitative handle on the trade-off, and it is sufficient to argue that safety-layer design should minimize $\mathbb P(\tau_B<\infty)$ wherever the optimal policy has a well-defined structure.

### 6.2 Adversarial threat model

**[A]** The safety layer is a restriction on the controller's own actions. It does not, by itself, defend against an external adversary. The following threats are in scope for the architecture's design goals; each is listed with its vector, impact, primary mitigation, and residual risk. None is fully eliminated by any single mechanism.

| Threat | Vector | Impact | Primary mitigation | Residual risk |
|---|---|---|---|---|
| Oracle manipulation | Compromised or stale price feed, DEX spot manipulation | Wrong valuation, wrong admission decision, wrong reward | Independent oracle set, freshness bounds, conservative haircut, fail-safe on stale data | Correlated oracle failure, insider collusion |
| MEV and front-running | Mempool observation of pending orders | Adverse fills, sandwich attacks | Private submission channels, slippage caps, randomized submission timing, bounded order size | Validator-level collusion, censorship |
| Finality delay / congestion | Network congestion, denial of service | Stale execution snapshot, double-spend of reserved funds | Pending reservations, atomic locks, settlement-interval accounting, fail-safe on long pending | Prolonged partition, inconsistent snapshots |
| Forecast adversarial input | Crafted price series that induces misleading quantiles | Systematic misclassification of forecast bucket, biased exploration | Quantile calibration tests, input-distribution shift detection, fallback to HOLD-only on distributional novelty | Novel adversarial patterns outside training support |
| Reward poisoning | Fake transactions crafted to appear as reconciled rewards | Biased Q-updates toward dangerous actions | Transaction-identifier deduplication, reconciliation against finalized state, per-source rate limits | Compromised keys with legitimate capabilities |
| Key compromise | Process compromise, memory dump, container snapshot | Loss of signing authority, unauthorized transfers | Protected signer, hardware key storage where available, custody recovery procedures | Insider threat, side-channel leakage |
| Narrative poisoning | Adversarial telemetry injected into the language model | Misleading human operators, wrong governance decisions | Read-only sanitized telemetry, no execution authority, human review before action | Human error, social engineering |
| Governance capture | Concentration of validator or operator power | Consensus safety failure, protocol parameter capture | Voting-power caps, geographic and implementation diversity, timelock review | Long-horizon collusion, bribery |

**[V]** No threat model is complete without a stated adversary capability set. This paper assumes a rational, resource-bounded adversary who cannot break standard cryptographic primitives, but who can observe public mempool activity and can manipulate unguarded oracle endpoints. Post-quantum hooks and BFT consensus do not change this threat model; they change only the cryptographic layer.

**[V]** Reference breaker. Trigger when a flow-adjusted trailing 24-hour drawdown exceeds 15%. Define it using the unitized index and its maximum over the same window. Persist a four-hour lockout deadline. During lockout, block new exposure and cancel cancellable pending orders; any risk-reduction trade remains subject to execution checks. This is a response threshold, not a maximum-loss guarantee. A HOLD instruction does not liquidate existing risk. An independent supervisor handles storage emergencies during a trading lockout.

---

## 7. Bounded evolution and reproduction

**[D]** Let

$$
g=(g_{risk},g_\tau,g_\epsilon,g_\alpha,g_{gas},g_\omega,g_{mitosis})\in\Omega=\prod_{i=1}^7[l_i,u_i].
$$

| Locus | Domain | Meaning |
|---|---|---|
| Risk aversion | [0.10,5.00] | Safety-layer stress-loss budget scaling |
| Sampling interval | [5,60] minutes | Input series interval |
| Initial exploration | [0.05,0.50] | Initial epsilon |
| Tracking step size | [0.01,0.25] | Practical Q learning rate |
| Protected gas reserve | [100,1000] XGO | Reserve admission constraint |
| Concentration cap | [0.05,0.40] | Maximum per-instrument exposure ratio |
| Reproduction multiple | [1.50,3.00] | Adjusted performance threshold |

**[A]** The protected transaction-gas reserve is separate from the funded runway reserve. The configured gas range is a search domain, not an assurance of fee adequacy; admission must also cover current worst-case transaction fees. Changing sampling intervals changes the economic forecast horizon and potentially state meaning; changing risk aversion changes the admissible risk budget. Policy inheritance requires a configuration compatibility check. Otherwise reset or explicitly retrain or migrate the policy. Inherited Q-values are an initialization, not proof of eliminated cold-start risk.

**[D]** For $\xi_i\sim\mathcal N(0,0.05^2)$, define

$$
g_i^{child}=\operatorname{clip}(g_i^{parent}(1+\xi_i),l_i,u_i).
$$

**Proposition 5 — Genome closure. [P]** Every child genome lies in $\Omega$. **Proof.** Coordinate-wise clipping maps each finite perturbed coordinate to its closed interval. ∎

**[V]** Numerical nonfinite draws must be rejected and resampled. Clipping produces boundary mass and is not an unbiased Gaussian mutation. Membership in this box establishes parameter limits, not biological or economic viability. Hardware and strategy incompatibilities require additional admissibility checks.

**[D]** When policy semantics are compatible, inherit with bounded projection:

$$
Q^{child}(s,a)=\operatorname{clip}(Q^{parent}(s,a)+\zeta_{s,a},-B_Q,B_Q),
$$

where $\zeta_{s,a}$ are recorded perturbations and $B_Q\ge R_{max}/(1-\gamma)$ is a configured common bound covering the parent's table. Proposition 2 then preserves that bound between reproduction events.

### 7.1 Statistical reproduction gate

**[A]** Reproduction requires the performance multiple $J_t/J_{birth}\ge g_{mitosis}$, a prespecified evaluation window of at least 365 calendar days, and all of the following conditions:

1. A one-sided 95% lower block-bootstrap confidence bound for mean net excess return over an explicit cash benchmark is strictly positive. Net return includes trading costs and all allocated operating costs once. Compute strategy and cash returns on matched capital, calendar, and currency; do not subtract hosting a second time from an already net series. A separate pre-hosting profit-coverage report must reconcile realized operating profit against bills.
2. The Deflated Sharpe Ratio score is at least 0.95 under a documented estimator and trial-selection model [6]. Record every strategy, genome, checkpoint, and parameter search contributing to selection. Raw agent count $K$ is not automatically the number of independent trials; correlated clones require a defensible effective-trial estimate and sensitivity analysis. Declare the treatment of serial dependence, skewness, kurtosis, and sampling frequency.
3. Transferable liquidity funds the parent reserve, child reserve, provisioning, gas, and operating commitments after reproduction.

**[V]** Specify bootstrap block construction, block length, minimum observations, replication count, and resampling assumptions before examining the result. Repeated eligibility tests over overlapping windows introduce additional selection; use prespecified evaluation dates and a declared sequential or multiple-testing correction, or a fresh independent confirmation window. A 365-day minimum alone does not establish adequate power. These filters reduce selection errors under their assumptions; they cannot certify persistent edge or eliminate lucky reproduction.

**Proposition 10 — Effective trial count under equicorrelated clones. [P]** Suppose $K$ clones have pairwise return correlation $\rho\in[0,1)$ under a common factor, and each clone independently would exceed the reproduction threshold with probability $p$ under the null of zero edge. Then the effective number of independent trials is

$$
K_{eff}=\frac{K}{1+(K-1)\rho},
$$

and the family-wise false-positive rate is approximately

$$
\mathrm{FWER}\approx 1-(1-p)^{K_{eff}}.
$$

**Proof sketch.** For equicorrelated Bernoulli indicators $X_i\in\{0,1\}$, $\mathrm{Var}(\sum X_i)=Kp(1-p)(1+(K-1)\rho)$. The iid variance matching this is $K_{eff}\,p(1-p)$, giving the stated $K_{eff}$. The FWER approximation follows from treating the $K_{eff}$ independent indicators as an iid sample. ∎

**Interpretation. [T]** With $K=100$ clones and $\rho=0.5$, $K_{eff}\approx2$, not 100. Naïvely applying a per-trial threshold without adjustment would inflate the family-wise false-positive rate by nearly two orders of magnitude. This is the formal justification for the Deflated Sharpe Ratio requirement and for recording every trial in the selection model.

### 7.2 Calendar time and selection under a null model

**[V]** For zero-mean iid returns under a large-sample normal approximation, an annualized sample Sharpe $\widehat S$, $n$ observations, and $k$ observations per year satisfy

$$
P(\widehat S>s^*)\approx1-\Phi\!\left(s^*\sqrt{n/k}\right).
$$

For $s^*=1.5$ and $n=500$, this is approximately 45.88% at five-minute sampling ($k=105{,}120$) and 36.00% at hourly sampling ($k=8{,}760$). For $K$ independent trials the chance that at least one exceeds the threshold is $1-(1-p)^K$; correlated trials do not obey that expression directly.

Under the same approximation, an observed annual Sharpe of 1.5 crosses a one-sided 5% zero-Sharpe threshold after roughly $(1.64485/1.5)^2=1.202$ years. This is an illustrative significance calculation, not a guaranteed validation duration or a 95%-power calculation. Dependence, non-normality, multiple testing, and desired statistical power require additional data or adjusted inference.

### 7.3 Funded capital division

**[D]** Let $L$ be actually transferable liquid capital, $R_p$ required retained funding, and $C_{setup}$ a conservative total setup-and-transfer budget. Define

$$
L_{surplus}=\max(0,L-R_p-C_{setup}),\qquad T=0.5L_{surplus}.
$$

Spawn only if $T$ funds the child's required commitments and all parent checks remain satisfied. Illiquid marked NAV is not transferable surplus.

**Proposition 6 — Reproduction accounting. [P]** At a common valuation instant, with no market movement or external funding, a transfer of $T$ from parent to child preserves their aggregate NAV except for total recognized costs $C$:

$$
V_p^{after}+V_c^{after}=V_p^{before}-C.
$$

**Proof.** Parent loses $T+C$ and child receives $T$; the internal transfer cancels. ∎

**[V]** Population growth does not create wealth. Shared forecasts, inherited policies, common exposures, and shared hosting can create correlated failures. Mutation plus a reproduction threshold is an evolutionary heuristic, not a proven optimizer.

---

## 8. Sovereign appliance architecture and metabolic operations

**[D]** The architecture is organized into three tiers. Tier 1 is the sovereign organism. Tiers 2 and 3 are shared, stateless services. The separation is a design invariant: it keeps the agent small, keeps custody local, and allows a fleet to share expensive compute without sharing keys, policy state, or ledger authority.

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

**[D] Tier 1 — Sovereign Operational Core.** The agent itself, in Bun/TypeScript at approximately 25 MB. It contains the tabular Q-policy, the execution safety layer, the genome and mutation operator, the deterministic SRE supervisor, and the volatile Ed25519 keystore. The policy proposes actions. The safety layer authorizes or rejects them. The supervisor handles storage pruning, log rotation, resource protection, and emergency defense without being subject to exploration. The keystore never persists keys to disk.

**[D] Sovereign Fullnode.** A Rust / Tokio / Move VM process that runs in the same container as Tier 1, connected by local RPC or IPC. It synchronizes and verifies the ledger and submits transactions. It is non-validating by default. It does not vote as a validator merely by following the ledger, and its local verification and RPC service are distinct from committee voting and finalization.

**[D] Tier 2 — TimesFM Oracle.** A shared Python service on an external VPS. It supplies timestamped quantile forecasts (p10, p50, p90) at the configured sampling interval. It is a **critical dependency**: if it is unreachable, the agent enters HOLD-only fail-safe. It never falls back to a local regression or an arbitrary market bucket.

**[D] Tier 3 — Cognitive Soul.** A shared Ollama + Qwen 2.5 service on an external VPS. It generates narrative, diary, and audit summaries asynchronously. It has **zero execution authority** and is **best-effort**: if it is unreachable, the agent continues operating normally and protective actions are never delayed by narrative generation.

**[A] Why the tiers are separated.** The forecasting service is compute-heavy and shared across the fleet. The narrative service is large and shared. Neither needs access to keys, policy state, or the ledger. Both can be externalized without weakening the agent's custody model. The Tier 1 core stays small, sovereign, and self-contained.

**[V]** A shared forecasting worker creates an availability dependency even when ledger verification is local. If Tier 2 is externalized, redundancy and failover are operational requirements, not optional. A shared narrative worker creates no execution dependency, but it does create a correlated availability surface across the fleet.

**[V]** Use bounded asynchronous queues, timeouts, backpressure, and stale-response rejection for all cross-tier communication. Every cross-tier call must have an explicit timeout and a defined fail-safe behavior.

**[V]** CPU, RAM, inference memory, local query latency, and finality figures are deployment measurements to be established, not mathematical consequences of table size. Record hardware, software versions, workload, percentiles, model configuration, and concurrency for every benchmark.

**[V]** Storage maintenance must use the node's supported interfaces. Monitor utilization, synchronization lag, memory, and recovery status. A configured 75% utilization can trigger maintenance, but only prune data the protocol permits removing. Do not delete live database files or arbitrary transaction deltas. Retain checkpoints, proofs, and recovery data required by the implementation. Compaction can temporarily require extra disk space and does not substitute for semantic pruning.

**[V]** A 35-second container shutdown timeout is a configuration choice, not a guarantee of successful flush under every workload. Coordinate controller admission shutdown, pending-transaction reconciliation, database shutdown, and recovery testing. Bound cache allocations against the total process memory budget; a cache cap alone does not prevent OOM.

**[V]** Hosting self-funding requires implemented billing integration, price conversion, actual provider acceptance, and funded reserves. It is conditional on realized resources. Forecast gains or marked illiquid assets do not pay invoices.

**[V]** Distinguish financial termination from operational suspension. If costs cannot be serviced, block new exposure, attempt permitted risk-reducing actions only when executable, save recoverable state according to custody policy, and shut down cleanly when possible. Narrative generation is best effort and must not delay protective actions. Liquidation is not guaranteed when funds, transfer permissions, or liquidity are absent.

### 8.1 Runtime responsibilities

| Tier | Component | Runtime | Responsibility | Interface |
|---|---|---|---|---|
| 1 | Policy controller | Bun / TypeScript | Features, Q policy, reward attribution, bounded evolution | Local ledger adapter and forecast API |
| 1 | Execution safety layer | Controller and on-chain modules | Admission, reservations, capabilities, settlement bounds | Transaction builder and Move execution |
| 1 | Operational supervisor | Appliance services | Resource monitoring, supported pruning, billing, recovery | Node administration and provider APIs |
| — | Sovereign fullnode | Rust / Tokio / Move VM | Ledger synchronization, verification, transaction submission | Local RPC or IPC |
| 2 | Forecasting oracle | Python / TimesFM | Timestamped point and quantile forecasts | Batched HTTP service |
| 3 | Narrative service | Qwen / Ollama | Sanitized diary and explanatory summaries | Asynchronous event queue |

The fullnode remains a non-validating ledger follower unless explicitly enrolled under the network's validator protocol. Its local verification and RPC service are distinct from committee voting and finalization.

### 8.2 Operational lifecycle

**[D]** An organism progresses through provisioning, synchronization, funded activation, constrained operation, reproduction eligibility, and suspension or termination. Activation requires healthy ledger synchronization, a configured custody mechanism, funded operating commitments, and successful execution-adapter checks. Reproduction provisions an independently identified child and transfers capital under Section 7. Recovery restores reconciled state before trading resumes.

**[V]** The lifecycle stages in Section 1 and the four-stage narrative (Birth, Growth, Reproduction, Ascension) describe the same progression at two levels of detail. Ascension corresponds to conditional admission to validator operation under Section 13; it is not a reward for trading success and is not granted by the agent itself.

---

## 9. Move execution specification

**[A]** Move resource and ability checks restrict copying and disposal of values according to their declared abilities [3]. These checks are not a universal proof of asset-value conservation, authorization correctness, oracle security, or economic safety. Authorized minting, burning, transfer logic, and framework semantics must be reviewed separately. Compiler acceptance is different from a proof of a financial invariant.

**[D]** The GLOFICA execution interface is defined below through preconditions, transitions, and postconditions. This pseudocode specifies the required behavior; concrete Move modules implement it against a pinned GLOFICA framework, package addresses, venue adapters, and compiler.

```text
execute_market_action(capability, position, payment, order_bounds, context)
  PRECONDITIONS
    capability identifies the intended agent and grants this operation
    current caller/delegation is authorized under the declared custody model
    instrument restrictions and transfer capabilities are satisfied
    order action, quantity, expiry, price bounds and gas bounds are valid
    object versions and pending-funds reservations are current
    execution safety layer admits this concrete transaction

  TRANSITION
    invoke the approved venue adapter atomically where supported
    consume only authorized payment and update the resulting position
    return unused payment to the authorized owner
    emit reconciled execution quantities, fees and identifiers

  POSTCONDITIONS
    no unauthorized object movement or unauthorized mint/burn occurred
    actual execution obeys enforceable order bounds
    resulting ownership and balances match the venue's settlement semantics
    failure follows the chain's documented rollback and gas-charge rules
```

**[V]** Positive payments must be transferred or consumed through the authorized settlement adapter. Unused balances return to the designated owner; zero-value cleanup is separate from payment settlement. Standard documented Move integers are unsigned; signed PnL uses an explicit sign-and-magnitude representation unless the pinned GLOFICA compiler provides a documented alternative [4]. Execution events report settlement quantities and fees; the accounting service derives PnL from those records and the valuation policy.

**[V]** Capabilities must be checked, not merely passed as unused arguments. Define issuance, revocation, expiry, delegation, and instrument scope. A capability establishes the permission encoded in it; it does not alone establish external regulatory compliance.

**[V]** Transactions may execute in parallel when their complete read/write dependencies permit it. Distinct position objects do not guarantee independence when transactions share a pool, gas object, account resource, oracle, or other mutable object.

---

## 10. Identity, custody, and RPC

**[A]** Select and document a custody mode. Purely volatile keys disappear on unrecoverable process termination; continued access to funds therefore requires a recoverable seed, protected signer, or another explicitly authorized recovery mechanism. A strict no-persistence/no-recovery mode must disclose the possibility of permanent loss of signing access. Volatile storage alone does not prevent exposure through process compromise, swap, core dumps, debugging, or container snapshots.

**[V]** An Ed25519 derivation path does not generate a key by itself. Pin the derivation scheme, entropy source, path convention, signature serialization, domain separation, and address construction to the chain's implementation. Verify whether the address hashes a raw public key or a scheme-tagged serialized key; do not assume compatibility from a hash name alone.

**[V]** The RPC integration profile uses `glofica_getBalance`, `glofica_getOwnedObjects`, and `glofica_executeTransactionBlock`. Their existence, parameters, result schemas, finality modes, and transaction encoding require integration tests against the target node. Addresses and base64 transaction placeholders in documentation are examples, not evidence of settled transactions. If a balance response is 14820000000 micro-XGO and six decimals apply, the nominal balance is 14820 XGO.

**[A]** Consensus signature choices and transaction account signatures are distinct security layers. Post-quantum consensus hooks do not make an Ed25519 account quantum resistant. Any post-quantum security claim requires a documented end-to-end signing and migration scheme, implementation, and threat model.

### 10.1 RPC request examples

The reference integration uses a local endpoint at `http://127.0.0.1:9000`. A cluster endpoint may serve provisioning or recovery, subject to the configured verification and trust policy. Network-specific parameters, including chain identity and package addresses, belong to the pinned deployment manifest.

A balance query has the following integration shape:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "glofica_getBalance",
  "params": ["<agent_address>", "0x2::xgo::XGO"]
}
```

An owned-object query has the following integration shape:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "glofica_getOwnedObjects",
  "params": [
    "<agent_address>",
    {
      "filter": {"MatchAll": []},
      "options": {"showType": true, "showContent": true}
    }
  ]
}
```

Transaction submission uses the encoded transaction and its authorized signatures:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "glofica_executeTransactionBlock",
  "params": [
    "<base64_transaction>",
    ["<base64_authorized_signature>"],
    {"showEffects": true, "showEvents": true, "showObjectChanges": true},
    "WaitForLocalExecution"
  ]
}
```

**[V]** Placeholders must be replaced with valid chain-specific encodings. The node's documented confirmation semantics determine when execution is considered final; the controller reconciles accepted, failed, and pending submissions accordingly. RPC method and option compatibility is an integration-test requirement.

---

## 11. Validation and reproducibility

**[V]** Publish a pinned repository commit, framework/compiler versions, feature schema, valuation and flow accounting rules, datasets, model checkpoint, seeds, complete configuration, costs, and evaluation scripts. Setup and container commands must be tested against that release before being presented as operational instructions.

Verification should include:

1. Boundary and invalid-input checks for every classifier, including one- and three-month runway boundaries and overlapping disk alarms.
2. Q-bound and genome-bound checks, including inherited policies and terminal transitions.
3. Accounting reconciliation across deposits, fees, withdrawals, child transfers, and failed submissions.
4. Enforcement of authorization, reserves, concentration checks, pending reservations, and breaker timers across restarts.
5. Contract compilation and tests using the actual framework; formal verification where specifications and tooling support it.
6. Node recovery, storage-pressure, oracle-outage, stale-data, and custody-recovery exercises.

**[V]** Economic evaluation requires chronological out-of-sample or walk-forward tests with no future-data leakage. Include fees, spread, slippage, price impact, liquidity limits, hosting and inference costs, pending/failing trades, and realistic latency. Compare against cash/no-trade, relevant passive holdings, simple deterministic rules, and ablations without forecasting, learning, or mutation. Report net return, drawdown, turnover, reserve violations, uncertainty, and failure rates across multiple seeds and market regimes. Correct for repeated strategy selection where applicable. Reproduction success must be assessed after all child and parent operating costs.

**[V]** This paper presents analytical results and an experimental validation protocol. Trading performance and deployment benchmarks are outside the analytical results reported here.

---

## 12. Economic survival and funded runway

### 12.1 Monthly cost hurdle

**[D]** Let $A_t^{USD}>0$ be deployable trading equity and $c_t^{USD}>0$ monthly operating cost. The monthly cost hurdle is

$$
\kappa_t=\frac{c_t^{USD}}{A_t^{USD}}.
$$

If trading capital is $V_t^{trade}$ XGO with executable conversion price $p$, then $A_t^{USD}=pV_t^{trade}$ and $\kappa_t=(c_t^{USD}/p)/V_t^{trade}$. For a stable conversion price, expected return after trading costs but before hosting must at least cover this hurdle to maintain expected equity. If $p$ changes, evaluate the total USD return, including XGO/USD exposure and its interaction with trading returns. Positive expected arithmetic surplus is not sufficient for low ruin probability or positive long-run log growth.

**[D]** For a configured maximum operating burden $\kappa_{max}$, the capital budget is

$$
A_{min}^{USD}=c^{USD}/\kappa_{max},\qquad
V_{min}^{trade}=c^{USD}/(\kappa_{max}p).
$$

Using the author's illustrative $p=0.0001$ USD/XGO, independently unverified:

| Monthly cost | Maximum operating burden | Trading equity budget | XGO equivalent |
|---|---|---|---|
| 15 USD | 0.5% per month | 3,000 USD | 30,000,000 XGO |
| 5 USD | 0.5% per month | 1,000 USD | 10,000,000 XGO |

**[V]** These are cost-ratio budgets, not proven profitable or sufficient survival capital. Segregated operating reserves and transaction-gas funding are additional commitments. With a 15 USD budget and three months of runway, earmark 45 USD of executable operating reserves beyond trading equity. Actual costs must include any shared-model allocation and provider charges.

### 12.2 Reserve segregation and declining risk budgets

**[D]** Maintain $R_{run}^{USD}=n_{run}c^{USD}$ in an unencumbered operating allocation, preferably in the billing currency or an executable asset with a documented conversion haircut. A stable-denomination asset still has liquidity and counterparty risk. Marked capital uses a consistent valuation policy; the conservative liquidation valuation satisfies $V^{exec}\le V^{mark}$ by construction and subtracts fees and due liabilities. Locked stake and illiquid assets do not supply immediate runway. If conversion cannot be executed, token-denominated wealth does not establish bill-paying capacity.

**[D]** Use the runway-adjusted new-exposure cap

$$
g_\omega^{eff}(\rho)=g_\omega\operatorname{clip}\left(\frac{\rho-1}{2},0,1\right).
$$

At $\rho\le1$, no risk-increasing action is admissible. Between one and three months the cap grows linearly; at three months it reaches the genome cap. Existing exposure above a new cap enters supervised reduction when executable. It is not instantly assumed liquidated.

**[D]** For a configured baseline stress-loss allowance $\eta>0$, impose the additional admission constraint

$$
L_{stress}/V^{trade}\le\min(\eta_{max},\eta/g_{risk}),
$$

with positive trading equity, a published $\eta_{max}$, and a specified stress model. Genetic mutation cannot override the operating-reserve segregation, the runway shutdown threshold, or governance caps. These rules restrict risk-taking near distress; they do not remove all failure modes or guarantee that forced reduction is possible.

### 12.3 Survival under fixed costs

**[A]** A fixed USD expense is not a constant deduction from log drift. For the illustrative USD-equity dynamics

$$
dA_t=(\mu A_t-c)\,dt+sA_t\,dW_t,
$$

Itô's formula gives, while equity is positive,

$$
d\log A_t=(\mu-\tfrac12s^2-c/A_t)\,dt+s\,dW_t.
$$

The expense drag increases as wealth falls, and the constant-$m$ barrier formula is not the solution to this fixed-cost process.

**Proposition 11 — Scale function for the fixed-cost diffusion. [P]** Consider $dA_t=(\mu A_t-c)\,dt+sA_t\,dW_t$ with $A_0=x>0$, $c>0$, $s>0$, and $\mu\in\mathbb R$. The scale density is

$$
S'(y)=\exp\!\left(-\int^y\frac{2(\mu z-c)}{s^2 z^2}\,dz\right)=y^{-2\mu/s^2}\exp\!\left(-\frac{2c}{s^2 y}\right),
$$

and the scale function is $S(x)=\int^x S'(y)\,dy$. Ruin probability from $x$ is

$$
\mathbb P(\text{ruin}\mid x)=
\begin{cases}
1-\dfrac{S(x)}{S(\infty)}, & \mu>s^2/2,\\[6pt]
1, & \mu\le s^2/2,
\end{cases}
$$

with $S(\infty)<\infty$ iff $\mu>s^2/2$. **Proof.** The scale density for a one-dimensional diffusion follows from the standard formula $S'(y)=\exp(-\int^y 2b(z)/\sigma^2(z)\,dz)$ with $b(z)=\mu z-c$ and $\sigma(z)=sz$. The integrability of $S'$ at infinity is governed by the power $y^{-2\mu/s^2}$, giving the stated dichotomy. ∎

**Numerical illustration. [V]** With $c>0$, the fixed-cost ruin probability is strictly larger than the constant-drift approximation $\exp(-2mx/s^2)$ with $m=\mu-c/x$, because the scale density weights low wealth more heavily. A numerical evaluation of $S$ via quadrature, tabulated across $(\mu,s,c,x)$, is the correct reference. T4 provides the simulation protocol that cross-checks this calculation.

**Interpretation. [T]** The correct survival analysis of an Autonomon is neither the constant-drift Brownian formula nor a deterministic cost-drag calculation. It is the fixed-cost diffusion above, or a richer model with jumps, liquidity, and XGO/USD exposure. The constant-$m$ formula remains useful as a fast, optimistic upper bound on ruin probability, and any deployment that relies on it should report the ratio to the fixed-cost estimate.

---

## 13. Conditional admission to validator operation

**[A]** Validator operation is an optional, separately governed role. Trading success and organism reproduction do not grant consensus membership. The following are proposed admission controls; GLOFICA's stake rules, reward schedule, slashing, eligibility, and voting weights require a pinned protocol specification and verification.

**[D]** At each daily checkpoint over at least 90 consecutive days, require funded coverage of minimum stake, segregated operating runway, and validator operational buffers. All sides of the test must use the same numeraire:

$$
E_{eligible,t}^{USD}\ge S_{min,t}^{USD}+R_{run,t}^{USD}+R_{ops,t}^{USD}.
$$

For XGO-denominated minimum stake, $S_{min,t}^{USD}=p_t^{exec}S_{min,t}^{XGO}$. $E$ includes eligible, unencumbered pre-admission resources at conservative executable value, excluding unrelated collateral commitments. Admission additionally checks the required actual token quantity, transferability, and residual liquidity after locking stake. Daily checkpoint compliance does not imply continuous compliance; material changes require immediate rechecks.

**[V]** Operational requirements include dedicated infrastructure with measurable service objectives, isolated validation keys, tested recovery and monitoring, and governance authorization through a human-approved workflow or a previously authorized timelock with review and cancellation. These are protocol design requirements, not actions initiated by this paper.

**[V]** Cap aggregate voting power sharing an operator, signing authority, validator implementation risk, cloud dependency, or update pipeline. For protocols whose safety budget is less than one-third Byzantine voting power, use a declared cap materially below that threshold and account for overlapping correlated groups. The threshold concerns voting weight when consensus is weighted, not simply machine count. The exact fault budget and synchrony assumptions must come from GLOFICA's consensus specification. Common-code failures can affect otherwise distinct operators; governance caps alone do not prove consensus safety [8].

**[D]** For a constant expected monthly net reward rate $y>0$ after reward deductions but before infrastructure cost, and monthly validation cost $c_v$ in the same asset, the simplified break-even stake is $S=c_v/y$. If $y$ depends on total network stake, emissions, availability, or stake size, solve the actual reward function instead. Include opportunity cost, conversion risk, unbonding, and slashing exposure separately.

**[V]** For the author's hypothetical 1.2 million XGO/month expense and 30 million XGO stake, break-even requires 4% per month: 48% annual simple or approximately 60.10% with monthly reinvestment. This is an implied hurdle, not a GLOFICA reward claim. At the illustrative price, 30 million XGO equals 3,000 USD; that amount alone cannot establish adequacy or inadequacy of economic security, which depends on attack incentives and the enforceable penalty model.

---

## 14. Falsifiable synthetic evaluation

**[V]** Run at least 30 independent seeds per test, with additional seeds if the targeted confidence precision requires them. Publish generators, parameters, training budgets, evaluation schedules, confidence procedures, failures, and all seeds. Use paired environments for controller comparisons where appropriate. Synthetic success tests implementation and defined hypotheses; it does not establish live-market profitability.

| Test | Environment | Prespecified measurements and decision criteria |
|---|---|---|
| T1: No-edge null | Positive-price martingale or equivalent zero-conditional-mean reward process; no look-ahead, no exploitable drift, bounded admissible positions, explicit transaction costs | Evaluate net excess trading return relative to matched cash before common fixed hosting charges. Report mean, confidence interval, false-positive rate across seeds, turnover, and a prespecified upper bound for economically material apparent edge. A profitable isolated run is not evidence of a defect. |
| T2: Known stationary MDP | Finite, fully observed inventory/regime state with known transition kernel, bounded reward, and fixed admissible sets; two-state drift persistence $q$ may be used as a component | Compute $Q^*$ by value iteration to a tighter reference tolerance. Use per-pair step size $n^{-0.7}$ and ensure every feasible pair is repeatedly sampled. Report sup-norm Q error, action-value regret, and optimal-action-set agreement; target error < $\varepsilon$ and agreement ≥95% at a prespecified budget. |
| T3: Regime change | T2 with one documented parameter change at $\tau$ | Compare constant-step learning against frozen and diminishing-step baselines. Measure time to remain within a specified post-change value/regret tolerance for a fixed duration. Record unrecovered runs as censored; report both adaptation delay and cumulative cost. |
| T4: Economic population | Explicit expenses, execution depth, price dynamics, segregated reserves, reproduction gates, optional stake locks, and correlated shocks | Estimate horizon-specific ruin probability, survival curves, restricted mean lifetime, reproduction frequency, false reproduction under a null, and capital required for a prespecified survival target. Report confidence intervals and sensitivity to cost, capital, and shock assumptions. |

### 14.1 Interpretation and failure diagnosis

**[T]** For T1, HOLD means remaining in the benchmark cash asset. It is an expected-value optimum only under the declared no-edge process and compatible reward/cost assumptions. An iid log-price walk need not be a price martingale because exponentiation introduces drift. Specify the generator accordingly. The persistent exploration floor implies some ongoing random trades if they remain admissible; test exploitation-only performance separately and quantify the exploration cost. Failure to reject positive performance is not proof of no edge: use a predefined economically meaningful tolerance and report statistical power. Persistent unexplained excess returns trigger checks for leakage, generator misspecification, accounting errors, or test-selection bias.

**[T]** T2 is the benchmark in this suite constructed to meet stationary tabular convergence assumptions. Include every variable needed for its transition and reward law, including inventory and wealth if fixed expenses depend on wealth. Use a generative sampler, exploring starts, or a documented communicating MDP to establish coverage. State-dependent horizons or termination must match the value-iteration model. Resolve ties by comparing to the set of optimal actions. Finite-budget failure can indicate insufficient exploration or samples as well as a software defect; it is not by itself a contradiction of an asymptotic theorem.

**[T]** T3 does not presume constant-step learning always adapts faster. A frozen policy may remain optimal after some changes, and aggressive steps may increase variance. Declare changes that alter the optimal policy, then test the proposed adaptation advantage with uncertainty intervals. A frozen baseline that never reaches tolerance has a censored recovery time, not an invented finite measurement.

**[T]** For T4, financial exhaustion, inability to pay due bills, and infrastructure failure are separate endpoints. Reproduction tests require simulated calendar histories long enough for the statistical gate, including the 365-day minimum and any confirmation period. Children inherit correlated information, so population members are not independent replicates. Evaluate independent population seeds. "Minimum viable capital" means the smallest tested capital meeting a declared finite-horizon survival criterion within uncertainty; it is model-dependent.

---

## 15. Limitations

**[V]** The following limitations are explicitly acknowledged and are not repaired by any result in this paper.

1. **No empirical validation.** The paper contains no out-of-sample trading results, no live deployment measurements, and no benchmark comparisons. Sections 11 and 14 specify the protocols; they do not report outcomes.
2. **No convergence guarantee for the practical controller.** Proposition 2 bounds Q-values, and Proposition 8 gives a tracking bound under an explicit non-stationarity model. Neither proves that the practical controller converges to a useful policy in a real market.
3. **Markov sufficiency is not established.** The discretization in Section 3 is a partition, not a sufficient statistic. Rewards involving NAV, high-water marks, timers, or pending transactions may depend on history outside the state vector.
4. **Safety is conditional.** Propositions 3 and 4 require disturbance bounds that are not guaranteed in unrestricted markets. A flash crash, oracle failure, or liquidity disappearance can violate the premises.
5. **The network is not verified.** GLOFICA's chain identity, RPC compatibility, Move framework semantics, consensus parameters, and deployment status must be established against a pinned implementation. Nothing in this paper proves that these exist as described.
6. **Illustrative numbers are not data.** The $p=0.0001$ USD/XGO price, 15 USD/month hosting, 1.2 million XGO/month validator expense, and 30 million XGO stake are examples. They are not independently verified.
7. **Reproduction is heuristic.** Proposition 6 preserves aggregate NAV across a transfer. It does not establish that reproduction improves population performance. The gates in Section 7.1 reduce selection error under their assumptions; they do not certify edge.
8. **Related literature is not exhaustively reviewed.** Section 16 positions the work, but a full literature review is beyond scope.
9. **No formal verification of Move contracts.** The execution interface is specified as preconditions, transitions, and postconditions. Actual Move modules must be separately verified, tested, and audited.

---

## 16. Related work

**[V]** The Autonomon design intersects several research areas. This section positions the work without claiming exhaustive coverage.

**Reinforcement learning and non-stationarity.** The benchmark MDP and the convergence discussion follow the classical tabular theory of Watkins & Dayan [1] and Regehr & Ayoub [2]. Non-stationary stochastic approximation, which underlies Proposition 8, is treated by Besbes, Gur & Zeevi [12] for bandits and by Cheung, Simchi-Levi & Zhu [13] for reinforcement learning. The constant-step tracking bound in Section 4 is an application of that line of work to the specific Q-update used here.

**Safe and constrained RL.** The safety layer's admissible-action restriction is related to constrained MDPs (Altman 1999 [14]) and to safe RL methods such as CPO (Achiam et al. 2017 [15]). Proposition 9 is a straightforward price-of-safety bound in the spirit of constrained-MDP analyses; it does not assume differentiability or a specific policy class. Control barrier functions (Ames et al. 2019 [16]) provide continuous-time certificates of safety; this paper's discrete safety layer is closer in spirit to a runtime monitor than to a CBF.

**Sample complexity in tabular RL.** Proposition 7 uses the PAC sample-complexity bounds of Kearns & Singh [10] and the tighter near-optimal bounds of Azar et al. [11]. The point of the proposition is not the constant in the bound but the order-of-magnitude gap between the bound and the data available at the five-minute sampling interval.

**Backtest overfitting and selection bias.** The Deflated Sharpe Ratio in Section 7.1 follows Bailey & López de Prado [6]. Proposition 10 formalizes the effective-trial correction that underlies the DSR when trials are correlated. The broader literature on backtest overfitting — including the probability of backtest overfitting [17] and the multiple-testing corrections discussed in López de Prado [18] — is directly applicable and should be consulted for any reported result.

**Financial reinforcement learning.** Applications of RL to trading, execution, and portfolio management are surveyed in Nevmyvaka et al. [19] and Deng et al. [20]. This paper does not compete with that literature empirically; the Autonomon's distinguishing feature is the explicit separation of prediction, choice, authority, and supervision, and the integration of that separation with on-chain execution and reproduction.

**Artificial life.** The Langton-style local-rule perspective [9] is the framing device of the paper. The Autonomon is not claimed to be alive in any strong sense; the analogy organizes the design of observation, action, mutation, and reproduction. Bedau's discussion of weak and strong artificial life [21] is relevant background for interpreting this framing.

**Byzantine fault tolerance and validator economics.** Section 13's admission controls are informed by BFT literature — including the SplitBFT reference [8] and standard results on Byzantine quorum thresholds — but the paper does not contribute to BFT theory. Validator break-even analysis is standard in the staking literature.

---

## 17. Conclusion

The Autonomon design is a feasible research architecture for coupling observation-based financial control with ledger verification and operational supervision. Its mathematical specification establishes limited conditional properties: unique valid-state classification, bounded reward and Q-values, projected parameter bounds, transfer accounting, reserve preservation under enforceable debit bounds, a PAC sample-complexity lower bound on the discretized table, a tracking bound under non-stationarity, a price-of-safety bound, an effective-trial correction for correlated reproduction gates, and a closed-form scale function for fixed-cost survival.

Stationary optimality results require a separate valid MDP formulation. Live-market tracking, forecasting usefulness, net profitability, resilience, and evolutionary benefits remain empirical research questions. Safety claims must identify their enforced constraints and disturbance assumptions. The synthetic evaluation protocol makes the learning, tracking, reproduction, and economic-survival hypotheses testable. Network economics and validator incentives require separate protocol evidence.

The paper does not establish universal computation, unrestricted survival, or autonomous wealth creation. It establishes a set of design invariants, conditional mathematical properties, and a falsifiable evaluation protocol. Subsequent work should either implement and report Section 14 or replace the affected [V] and [T] items with measured results.

---

## 18. Roadmap

The current specification is long-only and operates on a single instrument per agent. The following capabilities are planned, ordered by priority. Each will be specified in a future revision of this document and validated with its own falsifiable test suite.

### 18.1 Short capability

Add two actions to the action space: `ENTER_SHORT` and `EXIT_SHORT`. Extend the state vector with a short-exposure coordinate. The design will mirror the long-side treatment: symmetric entry conditions, concentration caps applied to net exposure, and reserve-floor preservation for collateral.

Expected impact:
- Action space: 5 → 7 actions.
- State cardinality: 2,160 → 6,480 states (3 short-exposure categories).
- Q-table: 10,800 → 45,360 entries.
- Paper revisions: §3.5 (position labels), §4 (action space), §6 (collateral admission).

### 18.2 Multi-instrument portfolio

Extend the state vector with an instrument-selection coordinate so a single agent can operate on multiple on-chain assets simultaneously. The concentration cap `g_ω` will apply per instrument; the aggregate exposure across instruments will be bounded by a separate portfolio-level constraint.

### 18.3 Additional venue adapters

- **Canton Network** — institutional-grade asset interoperability.
- **Base L2** — Ethereum-aligned tokenized assets.

Each adapter implements the same `AssetAdapter` interface defined in §1.1. Adapter-specific extensions (custody modes, settlement finality, gas accounting) will be documented separately.

### 18.4 Validator admission protocol

A formal specification of the network-level rules that govern conditional admission to validator operation, including stake requirements, slashing parameters, and the daily checkpoint procedure described in §13. This section will reference a pinned GLOFICA protocol specification once one is published.

### 18.5 Short-capability test suite (T5)

A fifth falsifiable test that validates the short capability under the same negative-control discipline as T1. Success criteria: the agent does not fabricate short edge from a zero-conditional-mean process, and the safety layer bounds the drawdown from short exposure.

---

## References

[1] Watkins, C. J. C. H., and Dayan, P. (1992). "Q-learning." *Machine Learning*, 8, 279–292. https://doi.org/10.1007/BF00992698 . Author-hosted record: https://www.gatsby.ucl.ac.uk/~dayan/papers/wd92.html .

[2] Regehr, M. T., and Ayoub, A. (2021). "An Elementary Proof that Q-learning Converges Almost Surely." https://arxiv.org/abs/2108.02827 .

[3] Move language documentation, "Abilities." https://github.com/move-language/move/blob/main/language/documentation/book/src/abilities.md .

[4] Move language documentation, "Integers." https://move-language.github.io/move/integers.html .

[5] Google Research, TimesFM project. https://github.com/google-research/timesfm . Pin the actual release used by the experiment; model versions are not interchangeable.

[6] Bailey, D. H., and López de Prado, M. (2014). "The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality." *The Journal of Portfolio Management*, 40(5), 94–107. https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf .

[7] Sigman, K. Columbia University lecture notes, "Brownian Motion," section on hitting times for Brownian motion with drift. https://www.columbia.edu/~ks20/4102-17-Spring/Notes-BM.pdf .

[8] Messadi, I., et al. (2022). "SplitBFT: Improving Byzantine Fault Tolerance Safety Using Trusted Compartments." https://arxiv.org/abs/2205.08938 .

[9] Langton, C. G. (1990). "Computation at the Edge of Chaos: Phase Transitions and Emergent Computation." *Physica D*, 42(1–3), 12–37.

[10] Kearns, M., and Singh, S. (1998). "Near-Optimal Reinforcement Learning in Polynomial Time." *Machine Learning*, 49(2–3), 209–232. https://doi.org/10.1023/A:1017984413808 .

[11] Azar, M. G., Munos, R., and Kappen, H. J. (2013). "Minimax PAC Bounds on the Sample Complexity of Reinforcement Learning with a Generative Model." *Machine Learning*, 91(3), 325–349.

[12] Besbes, O., Gur, Y., and Zeevi, A. (2014). "Stochastic Multi-Armed-Bandit Problem with Non-stationary Rewards." *Advances in Neural Information Processing Systems*, 27.

[13] Cheung, W. C., Simchi-Levi, D., and Zhu, R. (2020). "Reinforcement Learning for Non-Stationary Markov Decision Processes: The Blessing of (More) Optimism." *Proceedings of the 37th International Conference on Machine Learning*.

[14] Altman, E. (1999). *Constrained Markov Decision Processes*. Chapman & Hall/CRC.

[15] Achiam, J., Held, D., Tamar, A., and Abbeel, P. (2017). "Constrained Policy Optimization." *Proceedings of the 34th International Conference on Machine Learning*.

[16] Ames, A. D., Coogan, S., Egerstedt, M., Notomista, G., Sreenath, K., and Tabuada, P. (2019). "Control Barrier Functions: Theory and Applications." *European Control Conference*.

[17] Bailey, D. H., Borwein, J. M., López de Prado, M., and Zhu, Q. J. (2014). "The Probability of Backtest Overfitting." *Journal of Computational Finance*, 20(4), 39–69.

[18] López de Prado, M. (2018). *Advances in Financial Machine Learning*. Wiley.

[19] Nevmyvaka, Y., Feng, Y., and Kearns, M. (2006). "Reinforcement Learning for Optimized Trade Execution." *Proceedings of the 23rd International Conference on Machine Learning*.

[20] Deng, Y., Bao, F., Kong, Y., Ren, Z., and Dai, Q. (2017). "Deep Direct Reinforcement Learning for Financial Signal Representation and Trading." *IEEE Transactions on Neural Networks and Learning Systems*, 28(3), 653–664.

[21] Bedau, M. A. (2003). "Artificial Life: Organization, Adaptation and Complexity from the Bottom Up." *Trends in Cognitive Sciences*, 7(11), 505–512.