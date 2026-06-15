import clsx from "clsx";
import { HiMiniSignal, HiOutlineBolt } from "react-icons/hi2";

import type { DiscoveryResponse } from "../types/app";
import type { LiveStatus } from "../hooks/useLiveTransactions";

type AppHeaderProps = {
  discovery: DiscoveryResponse;
  liveMode: boolean;
  liveStatus: LiveStatus;
  liveStatusLabel: string;
  selectedUserId: string;
  setLiveMode: (value: boolean | ((current: boolean) => boolean)) => void;
  setSelectedUserId: (value: string) => void;
};

export const AppHeader = ({
  discovery,
  liveMode,
  liveStatus,
  liveStatusLabel,
  selectedUserId,
  setLiveMode,
  setSelectedUserId,
}: AppHeaderProps) => {
  return (
    <div className="border-b border-white/70 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-6 px-6 py-5 lg:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <label className="input-chip">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">User</span>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 outline-none"
            >
              {discovery.available_users.map((userId) => (
                <option key={userId} value={userId}>
                  {userId.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-tour="live-toggle"
              onClick={() => setLiveMode((current) => !current)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                liveMode
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-700",
              )}
            >
              <HiOutlineBolt />
              Live updates {liveMode ? "on" : "off"}
            </button>

            <div
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
                liveStatus === "live"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : liveStatus === "unavailable"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : liveStatus === "reconnecting"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-600",
              )}
            >
              <HiMiniSignal />
              {liveStatusLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
