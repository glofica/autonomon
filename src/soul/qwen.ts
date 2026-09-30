/**
 * Langton Soul Engine — Cognitive Consciousness via Qwen 2.5 on Ollama
 *
 * Gives each Langton agent an introspective "soul" and natural language reasoning.
 * While TimesFM and Q-Learning handle the quantitative mathematics,
 * Qwen provides:
 * 1. Narrative trade rationale (why the agent chose the action)
 * 2. Self-reflection & emotional evolution (confidence vs caution)
 * 3. Market diary entries recorded per epoch
 * 4. Inter-agent communication in natural language
 */

export interface SoulConfig {
    /** Ollama endpoint URL (default: http://127.0.0.1:11434) */
    ollamaUrl?: string;
    /** Model identifier (default: qwen2.5:7b) */
    model?: string;
    /** Temperature for creativity vs determinism (0.0 to 1.0) */
    temperature?: number;
    /** Timeout in milliseconds */
    timeoutMs?: number;
}

export interface ReflectionInput {
    agentId: string;
    generation: number;
    personality: 'analytical' | 'risk_seeking' | 'conservative' | 'contrarian' | 'stoic';
    action: string;
    product?: string;
    price: number;
    forecastTrend: string;
    expectedReturnPct: number;
    qValue: number;
    pnlSinceLastTurn: number;
    currentBalance: number;
}

export interface SoulReflection {
    agentId: string;
    innerMonologue: string;
    narrativeRationale: string;
    mood: 'triumphant' | 'vigilant' | 'cautious' | 'recovering' | 'hunting';
    diaryEntry: string;
    engine: 'qwen-ollama' | 'synthetic-soul-fallback';
}

const DEFAULT_SOUL_CONFIG: Required<SoulConfig> = {
    ollamaUrl: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    model: process.env.LANGTON_SOUL_MODEL || 'qwen2.5:7b',
    temperature: 0.6,
    timeoutMs: 4000,
};

export class LangtonSoul {
    private config: Required<SoulConfig>;

    constructor(config: SoulConfig = {}) {
        this.config = { ...DEFAULT_SOUL_CONFIG, ...config };
    }

    /**
     * Reflect on an action chosen by Q-Learning and TimesFM.
     * Uses Qwen via Ollama if online; otherwise synthesizes the internal reflection.
     */
    async reflect(input: ReflectionInput): Promise<SoulReflection> {
        const mood = this.determineMood(input.pnlSinceLastTurn, input.expectedReturnPct);

        const prompt = `You are the sovereign consciousness of Langton Agent "${input.agentId}" (Gen ${input.generation}).
Personality: ${input.personality}.
Current Mood: ${mood}.
Balance: ${input.currentBalance.toFixed(2)} XGO. PnL: ${input.pnlSinceLastTurn >= 0 ? '+' : ''}${input.pnlSinceLastTurn.toFixed(2)} XGO.
Chosen Action: ${input.action} on ${input.product || 'portfolio'}.
TimesFM Foundation Forecast: ${input.forecastTrend} (${input.expectedReturnPct.toFixed(2)}% expected return).
Q-Learning Policy Value: Q = ${input.qValue.toFixed(2)}.

Write a 2-sentence inner monologue justifying your choice with cold mathematical clarity, reflecting your ${input.personality} personality.`;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

            const res = await fetch(`${this.config.ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.model,
                    prompt,
                    stream: false,
                    options: {
                        temperature: this.config.temperature,
                        num_predict: 90,
                    },
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (res.ok) {
                const data = await res.json();
                const responseText = (data.response || '').trim();
                if (responseText.length > 10) {
                    return {
                        agentId: input.agentId,
                        innerMonologue: responseText,
                        narrativeRationale: `Selected ${input.action} based on TimesFM ${input.forecastTrend} projection and Q=${input.qValue.toFixed(1)}.`,
                        mood,
                        diaryEntry: `[Gen ${input.generation} | ${mood.toUpperCase()}] ${responseText}`,
                        engine: 'qwen-ollama',
                    };
                }
            }
        } catch {
            // Ollama offline or warming up -> use synthetic persona fallback
        }

        return this.generateSyntheticReflection(input, mood);
    }

    /**
     * Determine emotional state from performance & forecast.
     */
    private determineMood(pnl: number, forecastDelta: number): SoulReflection['mood'] {
        if (pnl > 50) return 'triumphant';
        if (pnl < -20) return 'recovering';
        if (forecastDelta > 3) return 'hunting';
        if (forecastDelta < -3) return 'cautious';
        return 'vigilant';
    }

    /**
     * Deterministic synthetic reflection fallback.
     */
    private generateSyntheticReflection(
        input: ReflectionInput,
        mood: SoulReflection['mood']
    ): SoulReflection {
        const statements: Record<string, string> = {
            analytical: `TimesFM indicates a ${input.forecastTrend} vector (${input.expectedReturnPct > 0 ? '+' : ''}${input.expectedReturnPct.toFixed(1)}%). Executing ${input.action} with Q=${input.qValue.toFixed(1)} to optimize capital efficiency.`,
            risk_seeking: `Projected trajectory opens an aggressive asymmetric window. Allocating capital into ${input.action} to capture maximum alpha.`,
            conservative: `Quantile dispersion urges defensive prudence. Executing ${input.action} to preserve principal and protect against downside risk.`,
            contrarian: `Market noise contradicts underlying foundation trends. Counter-positioning via ${input.action} while the crowd is mispriced.`,
            stoic: `Price fluctuations are transient data points. Following policy ${input.action} impassively according to genome invariants.`,
        };

        const monologue = statements[input.personality] || statements.analytical;

        return {
            agentId: input.agentId,
            innerMonologue: monologue,
            narrativeRationale: `Action ${input.action} confirmed (TimesFM: ${input.forecastTrend}, Q: ${input.qValue.toFixed(1)}).`,
            mood,
            diaryEntry: `[Gen ${input.generation} | ${mood.toUpperCase()}] ${monologue}`,
            engine: 'synthetic-soul-fallback',
        };
    }
}
