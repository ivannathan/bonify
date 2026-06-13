import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";

import { getTransactionCategory, isEssentialTransaction } from "./categories";
import type {
  MonthlyCashflow,
  ReliabilityResponse,
  ScoreSignal,
  Transaction,
  TransactionEventPayload,
} from "../types";

export const getScoringWindowStart = (from: string) =>
  format(startOfMonth(subMonths(parseISO(from), 5)), "yyyy-MM-dd");

export const sortTransactions = (transactions: Transaction[]) => {
  return [...transactions].sort((left, right) => {
    const dateCompare = right.date.localeCompare(left.date);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    const syncedCompare = right.synced_at.localeCompare(left.synced_at);

    if (syncedCompare !== 0) {
      return syncedCompare;
    }

    return left.id.localeCompare(right.id);
  });
};

export const buildMonthlyCashflow = (
  transactions: Transaction[],
  from: string,
) => {
  const start = parseISO(getScoringWindowStart(from));
  const end = parseISO(from);
  const months = eachMonthOfInterval({ start, end: endOfMonth(end) });

  const buckets = new Map<string, MonthlyCashflow>(
    months.map((month) => {
      const key = format(month, "yyyy-MM");
      const monthStart = format(month, "yyyy-MM-dd");

      return [
        key,
        {
          key,
          label: format(month, "MMM"),
          monthStart,
          income: 0,
          expenses: 0,
          net: 0,
          essentialExpenses: 0,
          txCount: 0,
          coverage: null,
        },
      ];
    }),
  );

  for (const transaction of transactions) {
    const key = transaction.date.slice(0, 7);
    const bucket = buckets.get(key);

    if (!bucket) {
      continue;
    }

    bucket.txCount += 1;

    if (transaction.amount >= 0) {
      bucket.income += transaction.amount;
    } else {
      bucket.expenses += Math.abs(transaction.amount);

      if (isEssentialTransaction(transaction)) {
        bucket.essentialExpenses += Math.abs(transaction.amount);
      }
    }
  }

  return [...buckets.values()].map((bucket) => {
    const net = bucket.income - bucket.expenses;
    const coverage =
      bucket.essentialExpenses > 0
        ? bucket.income / bucket.essentialExpenses
        : null;

    return {
      ...bucket,
      net,
      coverage,
    };
  });
};

export const buildScoreSignals = (
  reliability: ReliabilityResponse,
): ScoreSignal[] => {
  const regularityPoints = Math.round(reliability.metrics.income_regularity * 25);
  const coveragePoints = Math.round(
    Math.min(reliability.metrics.income_coverage_ratio / 2, 1) * 25,
  );
  const essentialPoints = Math.round(
    reliability.metrics.essential_payments_consistency * 25,
  );
  const resiliencePoints =
    reliability.reliability_index -
    regularityPoints -
    coveragePoints -
    essentialPoints;

  return [
    {
      id: "income_regularity",
      label: "Income Regularity",
      points: regularityPoints,
      maxPoints: 25,
      tone: "amber",
      description: `${Math.round(reliability.metrics.income_regularity * 6)}/6 months showed qualifying income.`,
    },
    {
      id: "income_coverage_ratio",
      label: "Income Coverage Ratio",
      points: coveragePoints,
      maxPoints: 25,
      tone: "emerald",
      description: `Income covered essential outflows by ${reliability.metrics.income_coverage_ratio.toFixed(2)}x over the window.`,
    },
    {
      id: "essential_payments_consistency",
      label: "Essential Payments Consistency",
      points: essentialPoints,
      maxPoints: 25,
      tone: "blue",
      description: `${Math.round(
        reliability.metrics.essential_payments_consistency * 100,
      )}% of expected essential payments were detected on schedule.`,
    },
    {
      id: "resilience_adjustments",
      label: "Resilience Adjustments",
      points: resiliencePoints,
      maxPoints: 25,
      tone: "violet",
      description:
        "Residual contribution inferred from the published score after the other three documented signals are scaled.",
    },
  ];
};

export const buildNarrativeSignals = (
  reliability: ReliabilityResponse,
  monthlyCashflow: MonthlyCashflow[],
) => {
  const positives = [
    {
      title: "Stable income cadence",
      body: `Income appeared in ${Math.round(
        reliability.metrics.income_regularity * 6,
      )} of 6 scoring months, which supports predictable repayment behavior.`,
    },
    {
      title: "Essential expenses stayed covered",
      body: `The average income-to-essential-expense ratio was ${reliability.metrics.income_coverage_ratio.toFixed(2)}x.`,
    },
  ];

  if (reliability.metrics.essential_payments_consistency >= 0.8) {
    positives.push({
      title: "Core bills remained consistent",
      body: `${Math.round(
        reliability.metrics.essential_payments_consistency * 100,
      )}% essential payment consistency suggests rent, utilities, and insurance were routinely met.`,
    });
  }

  const strongestMonth = [...monthlyCashflow].sort((left, right) => right.net - left.net)[0];

  if (strongestMonth) {
    positives.push({
      title: "Healthy cashflow buffer in strong months",
      body: `${strongestMonth.label} delivered the highest monthly surplus at ${strongestMonth.net.toFixed(0)} net.`,
    });
  }

  const risks = [];

  if (reliability.metrics.negative_balance_days > 0) {
    risks.push({
      title: "Negative balance pressure",
      body: `${reliability.metrics.negative_balance_days} estimated negative-balance day(s) reduced the score.`,
    });
  }

  if (reliability.metrics.late_fee_events > 0) {
    risks.push({
      title: "Late-fee events detected",
      body: `${reliability.metrics.late_fee_events} late-fee event(s) indicate occasional payment friction.`,
    });
  }

  if (reliability.metrics.good_months < monthlyCashflow.length) {
    risks.push({
      title: "Not every month cleared the same bar",
      body: `${reliability.metrics.good_months}/${monthlyCashflow.length} months qualified as good cashflow months.`,
    });
  }

  if (risks.length === 0) {
    risks.push({
      title: "No acute risk markers in the current window",
      body: "The live metrics do not show late fees or uncovered essential expense pressure.",
    });
  }

  return { positives, risks };
};

export const applyTransactionEvent = (
  currentTransactions: Transaction[],
  event: TransactionEventPayload,
  bounds: {
    from: string;
    to: string;
  },
) => {
  const map = new Map(currentTransactions.map((transaction) => [transaction.id, transaction]));

  if (event.type === "TRANSACTION_DELETED") {
    if (event.transaction_id) {
      map.delete(event.transaction_id);
    }

    return sortTransactions([...map.values()]);
  }

  if (!event.transaction) {
    return currentTransactions;
  }

  const eventDate = parseISO(event.transaction.date);
  const lower = parseISO(bounds.from);
  const upper = parseISO(bounds.to);
  const withinWindow =
    !isBefore(eventDate, lower) && !isAfter(eventDate, upper);

  if (event.type === "TRANSACTION_UPDATED" && !withinWindow) {
    map.delete(event.transaction.id);
    return sortTransactions([...map.values()]);
  }

  if (withinWindow) {
    map.set(event.transaction.id, event.transaction);
  }

  return sortTransactions([...map.values()]);
};

export const getDriverTone = (driver: string) =>
  driver.includes("(-") || driver.toLowerCase().includes("negative")
    ? "risk"
    : "positive";

export const getMerchantDisplay = (transaction: Transaction) =>
  transaction.merchant_name || transaction.description;

export const getTransactionSearchValue = (transaction: Transaction) =>
  [
    getMerchantDisplay(transaction),
    transaction.description,
    getTransactionCategory(transaction),
    transaction.date,
  ]
    .join(" ")
    .toLowerCase();
