import clsx from "clsx";

import { formatDateLabel } from "../lib/format";
import { dashboardTabs, type DashboardTab, type ReliabilityResponse } from "../types/app";

const tabLabels: Record<DashboardTab, string> = {
  overview: "Overview",
  transactions: "Transactions",
  cashflow: "Cashflow",
  explanation: "Explanation",
};

type DashboardHeroProps = {
  activeTab: DashboardTab;
  isReliabilityLoading: boolean;
  reliability: ReliabilityResponse | null;
  selectedFrom: string;
  selectedUserId: string;
  setActiveTab: (tab: DashboardTab) => void;
  windowStart: string;
};

export const DashboardHero = ({
  activeTab,
  isReliabilityLoading,
  reliability,
  selectedFrom,
  selectedUserId,
  setActiveTab,
  windowStart,
}: DashboardHeroProps) => {
  return (
    <section className="mb-8 rounded-[32px] border border-white/80 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-5xl font-semibold tracking-tight text-slate-950">
              {selectedUserId.replace("_", " ").toUpperCase()}
            </h1>
            {reliability ? (
              <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                {reliability.score_band}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-base text-slate-500">
            Scoring window: {windowStart ? formatDateLabel(windowStart) : "—"} -{" "}
            {selectedFrom ? formatDateLabel(selectedFrom) : "—"}
          </p>
        </div>

        <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Current score</p>
          <p className="mt-2 font-display text-4xl font-semibold tracking-tight">
            {isReliabilityLoading && !reliability ? "…" : reliability?.reliability_index ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-b border-slate-200">
        {dashboardTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "border-b-2 px-5 py-4 text-lg font-semibold transition",
              activeTab === tab
                ? "border-amber-400 text-slate-950"
                : "border-transparent text-slate-400 hover:text-slate-700",
            )}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>
    </section>
  );
};
