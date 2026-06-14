import { useAtom } from "jotai";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { SpotlightProvider, SpotlightTour, useSpotlight } from "react-tourlight";

import { AppHeader } from "./components/AppHeader";
import { DashboardHero } from "./components/DashboardHero";
import { OverviewPanel } from "./components/OverviewPanel";
import { EmptyScreen, ErrorScreen, LoadingScreen } from "./components/ScreenState";
import { useDashboardData } from "./hooks/useDashboardData";
import { getLiveIndicatorText, useLiveTransactions } from "./hooks/useLiveTransactions";
import { buildMonthlyCashflow } from "./lib/scoring";
import {
  activeTabAtom,
  liveModeAtom,
  liveTourSeenAtom,
  selectedFromAtom,
  selectedUserIdAtom,
} from "./state/app";

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

const AppShell = () => {
  const [selectedUserId, setSelectedUserId] = useAtom(selectedUserIdAtom);
  const [selectedFrom, setSelectedFrom] = useAtom(selectedFromAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [liveMode, setLiveMode] = useAtom(liveModeAtom);
  const [liveTourSeen, setLiveTourSeen] = useAtom(liveTourSeenAtom);
  const [reliabilityRefreshKey, setReliabilityRefreshKey] = useState(0);
  const { start } = useSpotlight();
  const {
    discovery,
    discoveryError,
    isDiscoveryLoading,
    isReliabilityLoading,
    isTransactionsLoading,
    minimumFromDate,
    reliability,
    reliabilityError,
    setTransactions,
    transactions,
    transactionsError,
    windowStart,
  } = useDashboardData({
    selectedFrom,
    selectedUserId,
    reliabilityRefreshKey,
    setSelectedFrom,
    setSelectedUserId,
  });

  useEffect(() => {
    if (!discovery || liveTourSeen) {
      return;
    }

    const timer = window.setTimeout(() => {
      start("live-mode-tour");
    }, 500);

    return () => window.clearTimeout(timer);
  }, [discovery, liveTourSeen, start]);

  const { liveStatus } = useLiveTransactions({
    liveMode,
    selectedFrom,
    selectedUserId,
    setTransactions,
    windowStart,
    onReliabilityRefresh: () => {
      setReliabilityRefreshKey((current) => current + 1);
    },
  });

  const monthlyCashflow = useMemo(() => {
    if (!selectedFrom) {
      return [];
    }

    return buildMonthlyCashflow(transactions, selectedFrom);
  }, [selectedFrom, transactions]);
  const liveIndicatorText = getLiveIndicatorText(liveStatus);

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
        <AppHeader
          discovery={discovery}
          liveMode={liveMode}
          liveStatus={liveStatus}
          liveStatusLabel={liveIndicatorText}
          minimumFromDate={minimumFromDate}
          selectedFrom={selectedFrom}
          selectedUserId={selectedUserId}
          setLiveMode={setLiveMode}
          setSelectedFrom={setSelectedFrom}
          setSelectedUserId={setSelectedUserId}
        />

        <main className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
          <DashboardHero
            activeTab={activeTab}
            isReliabilityLoading={isReliabilityLoading}
            reliability={reliability}
            selectedFrom={selectedFrom}
            selectedUserId={selectedUserId}
            setActiveTab={setActiveTab}
            windowStart={windowStart}
          />

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

export default App;
