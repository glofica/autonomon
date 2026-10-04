export interface Instrument {
  id: string;
  symbol: string;
  name?: string;
  baseAsset?: string;
  quoteAsset?: string;
  [key: string]: any;
}

export interface AgentState {
  agentId: string;
  balance: number;
  inventory: number;
  nav: number;
  exposureRatio: number;
  [key: string]: any;
}

export interface Action {
  type: 'HOLD' | 'ACQUIRE_SPOT' | 'DISPOSE_SPOT' | 'PROVIDE_LIQUIDITY' | 'REDUCE_INVENTORY' | string;
  id?: string;
  instrumentId?: string;
  amount?: number;
  agentId?: string;
  [key: string]: any;
}

export interface ExecutionResult {
  txId: string;
  success: boolean;
  action: string;
  instrumentId: string;
  amount: number;
  executedPrice: number;
  fee: number;
  slippage: number;
  timestamp: number;
  [key: string]: any;
}

export interface AssetAdapter {
  getVenueInfo(): Promise<{ name: string; instruments: Instrument[] }>;
  getPrice(instrumentId: string): Promise<number>;
  getHistoricalPrices(instrumentId: string, lookback: number): Promise<number[]>;
  getState(agentId: string): Promise<AgentState>;
  execute(action: Action): Promise<ExecutionResult>;
  reconcile(txId: string): Promise<ExecutionResult | null>;
  healthCheck(): Promise<boolean>;
}

export class SyntheticAssetAdapter implements AssetAdapter {
  private venueName: string = 'Synthetic-In-Memory-Venue';
  private instruments: Map<string, Instrument> = new Map();
  private prices: Map<string, number> = new Map();
  private priceHistories: Map<string, number[]> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  private txStore: Map<string, ExecutionResult> = new Map();
  private defaultInstrumentId: string = 'WR-CU-001';
  private txCounter: number = 0;
  private totalTurnover: number = 0;
  private tradeCount: number = 0;

  // Exact fee and slippage per requirements: 10 bps fee + 5 bps slippage
  public readonly feeBps: number = 10;
  public readonly slippageBps: number = 5;
  public readonly feeRate: number = 0.0010; // 10 bps
  public readonly slippageRate: number = 0.0005; // 5 bps

  constructor(options?: {
    initialCash?: number;
    currentPrice?: number;
    defaultInstrumentId?: string;
  }) {
    const initialCash = options?.initialCash ?? 10000;
    const initialPrice = options?.currentPrice ?? 100;
    this.defaultInstrumentId = options?.defaultInstrumentId ?? 'WR-CU-001';

    const defaultInst: Instrument = {
      id: this.defaultInstrumentId,
      symbol: 'CU-SPOT',
      name: 'Copper Spot Warrant',
      baseAsset: 'CU',
      quoteAsset: 'USD',
    };
    this.instruments.set(this.defaultInstrumentId, defaultInst);
    this.prices.set(this.defaultInstrumentId, initialPrice);
    this.priceHistories.set(this.defaultInstrumentId, [initialPrice]);

    this.agentStates.set('default', {
      agentId: 'default',
      balance: initialCash,
      inventory: 0,
      nav: initialCash,
      exposureRatio: 0,
    });
  }

  public setPrice(instrumentId: string, price: number): void {
    const id = instrumentId || this.defaultInstrumentId;
    this.prices.set(id, price);
    const history = this.priceHistories.get(id) || [];
    history.push(price);
    this.priceHistories.set(id, history);
  }

  public getPriceSync(instrumentId?: string): number {
    const id = instrumentId || this.defaultInstrumentId;
    return this.prices.get(id) ?? 100;
  }

  public getTotalTurnover(): number {
    return this.totalTurnover;
  }

  public getTradeCount(): number {
    return this.tradeCount;
  }

  public reset(initialCash: number = 10000): void {
    const curPrice = this.getPriceSync();
    this.agentStates.set('default', {
      agentId: 'default',
      balance: initialCash,
      inventory: 0,
      nav: initialCash,
      exposureRatio: 0,
    });
    this.txStore.clear();
    this.txCounter = 0;
    this.totalTurnover = 0;
    this.tradeCount = 0;
  }

  // --- AssetAdapter Interface Implementation ---

  async getVenueInfo(): Promise<{ name: string; instruments: Instrument[] }> {
    return {
      name: this.venueName,
      instruments: Array.from(this.instruments.values()),
    };
  }

  async getPrice(instrumentId: string): Promise<number> {
    const id = instrumentId || this.defaultInstrumentId;
    const price = this.prices.get(id);
    if (price === undefined) {
      return 100;
    }
    return price;
  }

  async getHistoricalPrices(instrumentId: string, lookback: number): Promise<number[]> {
    const id = instrumentId || this.defaultInstrumentId;
    const history = this.priceHistories.get(id) || [];
    return history.slice(-lookback);
  }

  async getState(agentId: string): Promise<AgentState> {
    const id = agentId || 'default';
    let state = this.agentStates.get(id);
    if (!state) {
      state = {
        agentId: id,
        balance: 10000,
        inventory: 0,
        nav: 10000,
        exposureRatio: 0,
      };
      this.agentStates.set(id, state);
    }

    const curPrice = this.getPriceSync(this.defaultInstrumentId);
    state.nav = state.balance + state.inventory * curPrice;
    state.exposureRatio = state.nav > 0 ? (state.inventory * curPrice) / state.nav : 0;
    return { ...state };
  }

  async execute(action: Action): Promise<ExecutionResult> {
    const instrumentId = action.instrumentId || this.defaultInstrumentId;
    const curPrice = await this.getPrice(instrumentId);
    const agentId = action.agentId || 'default';
    const state = await this.getState(agentId);

    const txId = `tx-${++this.txCounter}-${Date.now()}`;
    let executedAmount = 0;
    let executedPrice = curPrice;
    let fee = 0;
    let slippage = 0;

    if (action.type === 'HOLD') {
      const result: ExecutionResult = {
        txId,
        success: true,
        action: 'HOLD',
        instrumentId,
        amount: 0,
        executedPrice: curPrice,
        fee: 0,
        slippage: 0,
        timestamp: Date.now(),
      };
      this.txStore.set(txId, result);
      return result;
    }

    if (action.type === 'ACQUIRE_SPOT') {
      // Slippage moves price against buyer: +5 bps
      executedPrice = curPrice * (1 + this.slippageRate);

      let units = 0;
      if (action.amount && action.amount > 0) {
        // Amount specified in units
        const costPerUnit = executedPrice + curPrice * this.feeRate;
        const maxAffordableUnits = state.balance / costPerUnit;
        units = Math.min(action.amount, maxAffordableUnits);
      } else {
        // Allocate all available cash
        units = state.balance / (curPrice * (1 + this.slippageRate + this.feeRate));
      }

      if (units > 0) {
        const spotValue = units * curPrice;
        fee = spotValue * this.feeRate;
        slippage = spotValue * this.slippageRate;
        const totalCashOut = units * executedPrice + fee;

        state.balance -= totalCashOut;
        state.inventory += units;
        executedAmount = units;
        this.totalTurnover += spotValue;
        this.tradeCount++;
      }
    } else if (action.type === 'DISPOSE_SPOT' || action.type === 'REDUCE_INVENTORY') {
      // Slippage moves price against seller: -5 bps
      executedPrice = curPrice * (1 - this.slippageRate);

      let units = 0;
      if (action.amount && action.amount > 0) {
        units = Math.min(state.inventory, action.amount);
      } else if (action.type === 'REDUCE_INVENTORY') {
        units = state.inventory * 0.5;
      } else {
        units = state.inventory;
      }

      if (units > 0) {
        const spotValue = units * curPrice;
        fee = spotValue * this.feeRate;
        slippage = spotValue * this.slippageRate;
        const totalCashIn = units * executedPrice - fee;

        state.balance += totalCashIn;
        state.inventory -= units;
        executedAmount = units;
        this.totalTurnover += spotValue;
        this.tradeCount++;
      }
    }

    state.nav = state.balance + state.inventory * curPrice;
    state.exposureRatio = state.nav > 0 ? (state.inventory * curPrice) / state.nav : 0;
    this.agentStates.set(agentId, state);

    const result: ExecutionResult = {
      txId,
      success: true,
      action: action.type,
      instrumentId,
      amount: executedAmount,
      executedPrice,
      fee,
      slippage,
      timestamp: Date.now(),
    };

    this.txStore.set(txId, result);
    return result;
  }

  async reconcile(txId: string): Promise<ExecutionResult | null> {
    const existing = this.txStore.get(txId);
    if (existing) {
      return { ...existing, success: true };
    }
    return {
      txId,
      success: true,
      action: 'RECONCILED',
      instrumentId: this.defaultInstrumentId,
      amount: 0,
      executedPrice: this.getPriceSync(),
      fee: 0,
      slippage: 0,
      timestamp: Date.now(),
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
