import clsx from "clsx";

import { buildNarrativeSignals, buildScoreSignals } from "../lib/scoring";
import type { MonthlyCashflow, ReliabilityResponse } from "../types";

interface ExplanationPanelProps {
  reliability: ReliabilityResponse;
  monthlyCashflow: MonthlyCashflow[];
}

const toneClassMap: Record<string, string> = {
  amber: "bg-amber-400",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
};

export const ExplanationPanel = ({
  reliability,
  monthlyCashflow,
}: ExplanationPanelProps) => {
  const narrative = buildNarrativeSignals(reliability, monthlyCashflow);
  const scoreSignals = buildScoreSignals(reliability);

  return (
    <div className="space-y-6">
      <section className="card-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 font-display text-3xl font-bold text-amber-700">
              {reliability.reliability_index}
            </div>
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-950">
                Reliability explanation
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                This score estimates behavioral reliability from transaction history instead of traditional credit files. It emphasizes recurring income, essential bill coverage, payment consistency, and resilience markers such as cashflow strength or negative-balance pressure.
              </p>
            </div>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            Score band: {reliability.score_band}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-4">
          <p className="eyebrow">Positive Signals</p>
          {narrative.positives.map((signal) => (
            <article key={signal.title} className="card-surface p-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 h-3 w-3 rounded-full bg-emerald-500" />
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{signal.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.body}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          <p className="eyebrow">Risk Signals</p>
          {narrative.risks.map((signal) => (
            <article key={signal.title} className="card-surface p-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 h-3 w-3 rounded-full bg-rose-500" />
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{signal.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.body}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>

      <section className="card-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Signal Weight Breakdown</p>
            <p className="mt-2 text-sm text-slate-500">
              Visualizing the four published signal families against the final reliability score.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {scoreSignals.map((signal) => {
            const width = Math.max(
              4,
              Math.min(
                100,
                (Math.max(signal.points, 0) /
                  Math.max(signal.maxPoints, 1)) *
                  100,
              ),
            );

            return (
              <div key={signal.id}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{signal.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{signal.description}</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-700">
                    {signal.points}
                    <span className="text-sm text-slate-400"> × 1</span>
                  </p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={clsx("h-full rounded-full", toneClassMap[signal.tone])}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 text-right">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">
            Composite Reliability Index
          </p>
          <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-slate-950">
            {reliability.reliability_index}
            <span className="text-xl text-slate-400"> / 100</span>
          </p>
        </div>
      </section>
    </div>
  );
};
