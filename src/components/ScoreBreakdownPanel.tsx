import clsx from "clsx";

import { formatDateLabel } from "../lib/format";
import { buildScoreSignals } from "../lib/scoring";
import type { MonthlyCashflow, ReliabilityResponse } from "../types/app";

interface ScoreBreakdownPanelProps {
  reliability: ReliabilityResponse; 
}

const toneClassMap: Record<string, string> = {
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
};

export const ScoreBreakdownPanel = ({
  reliability, 
}: ScoreBreakdownPanelProps) => {
  const scoreSignals = buildScoreSignals(reliability);

  return (
    <section className="card-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Score Breakdown Visualization</p>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Visualize the four scoring signals and how each one contributes to the final
            reliability score.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          Reliability recalculated to {formatDateLabel(reliability.from)}.
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {scoreSignals.map((signal) => {
          const ratio =
            ((signal.points + (signal.id === "resilience_adjustments" ? 20 : 0)) /
              (signal.maxPoints + (signal.id === "resilience_adjustments" ? 20 : 0))) *
            100;

          return (
            <div key={signal.id} className="rounded-3xl border border-slate-200 bg-white/70 p-5">
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

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-medium text-slate-700">How the derivation works</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          The API returns the final score and documented reliability metrics. This view scales
          Income Regularity, Income Coverage Ratio, and Essential Payments Consistency into score
          points, then assigns the remaining points to Resilience Adjustments so the total matches
          the reported reliability index.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          
        </p>
      </div>
    </section>
  );
};
