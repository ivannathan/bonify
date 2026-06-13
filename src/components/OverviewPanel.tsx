import clsx from "clsx";

import { formatCurrency, formatDateLabel, formatMetricPercent, formatRatio } from "../lib/format";
import { buildScoreSignals, getDriverTone } from "../lib/scoring";
import type { MonthlyCashflow, ReliabilityResponse } from "../types";

interface OverviewPanelProps {
  reliability: ReliabilityResponse;
  monthlyCashflow: MonthlyCashflow[];
  windowStart: string;
}

const toneClassMap: Record<string, string> = {
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
};

export const OverviewPanel = ({
  reliability,
  monthlyCashflow,
  windowStart,
}: OverviewPanelProps) => {
  const scoreSignals = buildScoreSignals(reliability);
  const avgIncome =
    monthlyCashflow.reduce((sum, month) => sum + month.income, 0) /
    Math.max(monthlyCashflow.length, 1);
  const avgExpenses =
    monthlyCashflow.reduce((sum, month) => sum + month.expenses, 0) /
    Math.max(monthlyCashflow.length, 1);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="card-surface p-6">
          <p className="eyebrow">Reliability Index</p>
          <div className="mt-6 flex items-center justify-center">
            <div
              className="relative grid h-60 w-60 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--accent-amber) ${reliability.reliability_index * 3.6}deg, rgba(15, 23, 42, 0.08) 0deg)`,
              }}
            >
              <div className="grid h-44 w-44 place-items-center rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="text-center">
                  <p className="font-display text-6xl font-bold tracking-tight text-slate-950">
                    {reliability.reliability_index}
                  </p>
                  <p className="mt-1 text-sm uppercase tracking-[0.3em] text-slate-400">
                    / 100
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-center">
            <p className="text-lg font-semibold text-amber-700">
              {reliability.score_band} reliability
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Avg Monthly Income"
              value={formatCurrency(avgIncome, reliability.currency)}
              detail="Across the active scoring window"
            />
            <MetricCard
              label="Avg Monthly Expenses"
              value={formatCurrency(avgExpenses, reliability.currency)}
              detail="All outgoing transactions"
            />
            <MetricCard
              label="Coverage Ratio"
              value={formatMetricPercent(reliability.metrics.income_coverage_ratio)}
              detail={`${formatRatio(reliability.metrics.income_coverage_ratio)} income vs essential expenses`}
            />
            <MetricCard
              label="Income Regularity"
              value={formatMetricPercent(reliability.metrics.income_regularity)}
              detail="Months with recurring income"
            />
            <MetricCard
              label="Essential Payments"
              value={formatMetricPercent(reliability.metrics.essential_payments_consistency)}
              detail="Detected essential payment consistency"
            />
            <MetricCard
              label="Good Months"
              value={`${reliability.metrics.good_months}/${monthlyCashflow.length}`}
              detail="Months with supportive cashflow"
            />
            <MetricCard
              label="Negative Balance Days"
              value={String(reliability.metrics.negative_balance_days)}
              detail="Estimated pressure indicator"
            />
            <MetricCard
              label="Scoring Window"
              value={`${formatDateLabel(windowStart, "MMM d")} - ${formatDateLabel(reliability.from, "MMM d")}`}
              detail={formatDateLabel(reliability.from, "yyyy")}
            />
          </div>

          <div className="card-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Score Drivers</p>
                <p className="mt-2 text-sm text-slate-500">
                  The API exposes the final score and metrics. The chart below scales the three documented metrics and uses the remainder as the resilience adjustment.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                Window ends {formatDateLabel(reliability.from)}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {scoreSignals.map((signal) => {
                const ratio = ((signal.points + (signal.id === "resilience_adjustments" ? 20 : 0)) / (signal.maxPoints + (signal.id === "resilience_adjustments" ? 20 : 0))) * 100;

                return (
                  <div key={signal.id} className="rounded-3xl border border-slate-200 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{signal.label}</h3>
                        <p className="mt-1 text-sm text-slate-500">{signal.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-slate-950">
                          {signal.points}
                          <span className="text-sm text-slate-400">/{signal.maxPoints}</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={clsx("h-full rounded-full", toneClassMap[signal.tone])}
                        style={{ width: `${Math.max(4, Math.min(100, ratio))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="card-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Backend Drivers</p>
            <p className="mt-2 text-sm text-slate-500">
              Direct explanations returned by the reliability endpoint.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {reliability.drivers.map((driver) => {
            const tone = getDriverTone(driver);

            return (
              <div
                key={driver}
                className={clsx(
                  "rounded-3xl border p-4",
                  tone === "risk"
                    ? "border-rose-200 bg-rose-50"
                    : "border-emerald-200 bg-emerald-50",
                )}
              >
                <p
                  className={clsx(
                    "text-sm font-medium",
                    tone === "risk" ? "text-rose-700" : "text-emerald-700",
                  )}
                >
                  {tone === "risk" ? "Risk signal" : "Positive signal"}
                </p>
                <p className="mt-2 text-base text-slate-800">{driver}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => {
  return (
    <article className="card-surface p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </article>
  );
};
