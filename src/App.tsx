import clsx from "clsx";
import { useAtom } from "jotai";
import {
  lazy,
  Suspense,
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { addMonths, format, parseISO } from "date-fns";
import { SpotlightProvider, SpotlightTour, useSpotlight } from "react-tourlight";
import { HiMiniSignal, HiOutlineBolt, HiOutlineCalendarDays } from "react-icons/hi2";

import { OverviewPanel } from "./components/OverviewPanel";
import { getDiscovery, getReliability, getTransactions, SSE_BASE_URL } from "./lib/api";
import { formatDateLabel } from "./lib/format";
import {
  applyTransactionEvent,
  buildMonthlyCashflow,
  getScoringWindowStart,
  sortTransactions,
} from "./lib/scoring";
import {
  activeTabAtom,
  liveModeAtom,
  liveTourSeenAtom,
  selectedFromAtom,
  selectedUserIdAtom,
} from "./state/app";
import type {
  DashboardTab,
  DiscoveryResponse,
  ReliabilityResponse,
  Transaction,
  TransactionEventPayload,
} from "./types";

const TransactionExplorer = lazy(async () => {
  const module = await import("./components/TransactionExplorer");
  return { default: module.TransactionExplorer };
});

const CashflowPanel = lazy(async () => {
  const module = await import("./components/CashflowPanel");
  return { default: module.CashflowPanel };
});

const ExplanationPanel = lazy(async () => {
  const module = await import("./components/ExplanationPanel");
  return { default: module.ExplanationPanel };
});

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "cashflow", label: "Cashflow" },
  { id: "explanation", label: "Explanation" },
];

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

const AppShell = () => {
  const [selectedUserId, setSelectedUserId] = useAtom(selectedUserIdAtom);
  const [selectedFrom, setSelectedFrom] = useAtom(selectedFromAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [liveMode, setLiveMode] = useAtom(liveModeAtom);
  const [liveTourSeen, setLiveTourSeen] = useAtom(liveTourSeenAtom);

  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [reliability, setReliability] = useState<ReliabilityResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [reliabilityError, setReliabilityError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(true);
  const [isReliabilityLoading, setIsReliabilityLoading] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"off" | "connecting" | "live" | "reconnecting">("off");
  const [reliabilityRefreshKey, setReliabilityRefreshKey] = useState(0);
  const { start } = useSpotlight();
  const reliabilityRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsDiscoveryLoading(true);
    setDiscoveryError(null);

    getDiscovery(controller.signal)
      .then((response) => {
        setDiscovery(response);
        setSelectedUserId((current) => current || response.available_users[0] || "");
        setSelectedFrom((current) => current || response.data_range.to);
      })
      .catch((error: Error) => {
        if (isAbortError(error)) {
          return;
        }

        setDiscoveryError(error.message || "Unable to load discovery data.");
      })
      .finally(() => {
        setIsDiscoveryLoading(false);
      });

    return () => controller.abort();
  }, [setSelectedFrom, setSelectedUserId]);

  const windowStart = useMemo(
    () => (selectedFrom ? getScoringWindowStart(selectedFrom) : ""),
    [selectedFrom],
  );

  const minimumFromDate = useMemo(() => {
    if (!discovery) {
      return "";
    }

    return format(addMonths(parseISO(discovery.data_range.from), 5), "yyyy-MM-dd");
  }, [discovery]);

  useEffect(() => {
    if (!selectedUserId || !selectedFrom) {
      return;
    }

    const controller = new AbortController();

    setIsReliabilityLoading(true);
    setIsTransactionsLoading(true);
    setReliabilityError(null);
    setTransactionsError(null);

    Promise.all([
      getReliability(selectedUserId, selectedFrom, controller.signal),
      getTransactions(selectedUserId, windowStart, selectedFrom, controller.signal),
    ])
      .then(([reliabilityResponse, transactionsResponse]) => {
        setReliability(reliabilityResponse);
        setTransactions(sortTransactions(transactionsResponse.transactions));
      })
      .catch((error: Error) => {
        if (isAbortError(error)) {
          return;
        }

        const message = error.message || "Unable to load dashboard data.";
        setReliabilityError(message);
        setTransactionsError(message);
      })
      .finally(() => {
        setIsReliabilityLoading(false);
        setIsTransactionsLoading(false);
      });

    return () => controller.abort();
  }, [reliabilityRefreshKey, selectedFrom, selectedUserId, windowStart]);

  useEffect(() => {
    if (!discovery || liveTourSeen) {
      return;
    }

    const timer = window.setTimeout(() => {
      start("live-mode-tour");
    }, 500);

    return () => window.clearTimeout(timer);
  }, [discovery, liveTourSeen, start]);

  const scheduleReliabilityRefresh = useEffectEvent(() => {
    if (reliabilityRefreshTimerRef.current) {
      window.clearTimeout(reliabilityRefreshTimerRef.current);
    }

    reliabilityRefreshTimerRef.current = window.setTimeout(() => {
      startTransition(() => {
        setReliabilityRefreshKey((current) => current + 1);
      });
    }, 350);
  });

  const handleStreamEvent = useEffectEvent((payload: TransactionEventPayload) => {
    setTransactions((current) =>
      applyTransactionEvent(current, payload, {
        from: windowStart,
        to: selectedFrom,
      }),
    );
    scheduleReliabilityRefresh();
  });

  useEffect(() => {
    if (!liveMode || !selectedUserId) {
      setLiveStatus("off");
      return;
    }

    let closed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;

    const attachHandler = (eventName: TransactionEventPayload["type"]) => {
      eventSource?.addEventListener(eventName, (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as TransactionEventPayload;
        handleStreamEvent(payload);
      });
    };

    const connect = () => {
      if (closed) {
        return;
      }

      setLiveStatus(eventSource ? "reconnecting" : "connecting");
      eventSource = new EventSource(
        `${SSE_BASE_URL}/api/users/${selectedUserId}/transaction-events`,
      );

      eventSource.onopen = () => {
        setLiveStatus("live");
      };

      attachHandler("TRANSACTION_ADDED");
      attachHandler("TRANSACTION_UPDATED");
      attachHandler("TRANSACTION_DELETED");

      eventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data) as TransactionEventPayload;

        if (payload.type) {
          handleStreamEvent(payload);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;

        if (!closed) {
          setLiveStatus("reconnecting");
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closed = true;

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      eventSource?.close();
      setLiveStatus("off");
    };
  }, [handleStreamEvent, liveMode, selectedUserId]);

  const monthlyCashflow = useMemo(() => {
    if (!selectedFrom) {
      return [];
    }

    return buildMonthlyCashflow(transactions, selectedFrom);
  }, [selectedFrom, transactions]);

  const liveIndicatorText =
    liveStatus === "live"
      ? "Live"
      : liveStatus === "connecting"
        ? "Connecting"
        : liveStatus === "reconnecting"
          ? "Reconnecting"
          : "Off";

  if (isDiscoveryLoading) {
    return <LoadingScreen label="Loading API discovery and defaults…" />;
  }

  if (discoveryError || !discovery) {
    return <ErrorScreen message={discoveryError ?? "Discovery data is unavailable."} />;
  }

  return (
    <>
      <SpotlightTour
        id="live-mode-tour"
        steps={[
          {
            target: '[data-tour="live-toggle"]',
            title: "Try live transaction updates",
            content:
              "Turn on Live mode to subscribe to SSE transaction events. The explorer, charts, and score explanation update in place without dropping your current filters.",
            placement: "bottom",
          },
        ]}
        onComplete={() => setLiveTourSeen(true)}
        onSkip={() => setLiveTourSeen(true)}
      />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(253,224,71,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(96,165,250,0.12),_transparent_24%),linear-gradient(180deg,_#f8fbff,_#edf4fb)] text-slate-900">
        <div className="border-b border-white/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-5 lg:px-10">
            <div className="flex items-center gap-5">
              <div>
                <p className="font-display text-2xl font-bold tracking-[0.22em] text-slate-950">
                  RELIABILITY
                  <span className="ml-2 rounded-md bg-slate-100 px-2 py-1 text-sm tracking-[0.18em] text-slate-500">
                    INDEX
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Thin-file credit decision intelligence
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
                  liveStatus === "live"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                <HiMiniSignal />
                {liveIndicatorText}
              </div>

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

              <label className="input-chip">
                <HiOutlineCalendarDays className="text-slate-400" />
                <input
                  type="date"
                  min={minimumFromDate}
                  max={discovery.data_range.to}
                  value={selectedFrom}
                  onChange={(event) => setSelectedFrom(event.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-800 outline-none"
                />
              </label>

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
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
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
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                  Current score
                </p>
                <p className="mt-2 font-display text-4xl font-semibold tracking-tight">
                  {isReliabilityLoading && !reliability ? "…" : reliability?.reliability_index ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 border-b border-slate-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "border-b-2 px-5 py-4 text-lg font-semibold transition",
                    activeTab === tab.id
                      ? "border-amber-400 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {reliabilityError && !reliability ? (
            <ErrorScreen message={reliabilityError} inset />
          ) : isReliabilityLoading && !reliability ? (
            <LoadingScreen label="Calculating reliability score and loading transactions…" inset />
          ) : reliability ? (
            <Suspense fallback={<LoadingScreen label="Loading panel…" inset />}>
              {activeTab === "overview" ? (
                <OverviewPanel
                  reliability={reliability}
                  monthlyCashflow={monthlyCashflow}
                  windowStart={windowStart}
                />
              ) : null}
              {activeTab === "transactions" ? (
                <TransactionExplorer
                  transactions={transactions}
                  currency={reliability.currency}
                  isLoading={isTransactionsLoading}
                  error={transactionsError}
                />
              ) : null}
              {activeTab === "cashflow" ? (
                <CashflowPanel
                  currency={reliability.currency}
                  monthlyCashflow={monthlyCashflow}
                />
              ) : null}
              {activeTab === "explanation" ? (
                <ExplanationPanel
                  reliability={reliability}
                  monthlyCashflow={monthlyCashflow}
                />
              ) : null}
            </Suspense>
          ) : (
            <EmptyScreen />
          )}
        </main>
      </div>
    </>
  );
};

const App = () => {
  return (
    <SpotlightProvider
      theme="light"
      overlayColor="rgba(15, 23, 42, 0.46)"
      labels={{
        next: "Next",
        previous: "Back",
        skip: "Skip",
        done: "Done",
      }}
    >
      <AppShell />
    </SpotlightProvider>
  );
};

const LoadingScreen = ({
  label,
  inset,
}: {
  label: string;
  inset?: boolean;
}) => {
  return (
    <div
      className={clsx(
        "grid min-h-[50vh] place-items-center rounded-[32px] border border-white/70 bg-white/80 p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]",
        !inset && "min-h-screen rounded-none border-none shadow-none",
      )}
    >
      <div>
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
        <p className="mt-5 text-base text-slate-500">{label}</p>
      </div>
    </div>
  );
};

const ErrorScreen = ({
  message,
  inset,
}: {
  message: string;
  inset?: boolean;
}) => {
  return (
    <div
      className={clsx(
        "grid min-h-[50vh] place-items-center rounded-[32px] border border-rose-200 bg-rose-50 p-10 text-center",
        !inset && "min-h-screen rounded-none border-none",
      )}
    >
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-rose-500">API error</p>
        <p className="mt-3 max-w-xl text-lg text-rose-700">{message}</p>
      </div>
    </div>
  );
};

const EmptyScreen = () => {
  return (
    <div className="grid min-h-[50vh] place-items-center rounded-[32px] border border-slate-200 bg-white/80 p-10 text-center">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">No data</p>
        <p className="mt-3 max-w-xl text-lg text-slate-600">
          Select a user and scoring date to load a reliability assessment.
        </p>
      </div>
    </div>
  );
};

export default App;
