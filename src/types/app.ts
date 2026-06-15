export type ScoreBand = "LOW" | "MEDIUM" | "HIGH";

export type DashboardTab = "overview" | "transactions" | "cashflow" | "explanation";

export interface DiscoveryResponse {
  name: string;
  version: string;
  description: string;
  available_users: string[];
  data_range: {
    from: string;
    to: string;
  };
}

export interface ReliabilityMetrics {
  income_regularity: number;
  income_coverage_ratio: number;
  essential_payments_consistency: number;
  good_months: number;
  negative_balance_days: number;
  late_fee_events: number;
}

export interface ReliabilityResponse {
  user_id: string;
  from: string;
  currency: string;
  reliability_index: number;
  score_band: ScoreBand;
  metrics: ReliabilityMetrics;
  drivers: string[];
}

export interface Transaction {
  id: string;
  account_id: string;
  user_id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  merchant_category_code: string;
  merchant_name: string;
  type: "debit" | "credit";
  synced_at: string;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page?: number;
  limit?: number;
  total_pages?: number;
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface TransactionEventPayload {
  type: "TRANSACTION_ADDED" | "TRANSACTION_UPDATED" | "TRANSACTION_DELETED";
  transaction?: Transaction;
  transaction_id?: string;
  transactionId?: string;
}

export interface MonthlyCashflow {
  key: string;
  label: string;
  monthStart: string;
  income: number;
  expenses: number;
  net: number;
  essentialExpenses: number;
  txCount: number;
  coverage: number | null;
}

export interface ScoreSignal {
  id:
    | "income_regularity"
    | "income_coverage_ratio"
    | "essential_payments_consistency"
    | "resilience_adjustments";
  label: string;
  points: number;
  maxPoints: number;
  tone: string;
  description: string;
}
