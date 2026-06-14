import { addMonths, format, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { getDiscovery, getReliability, getTransactions } from "../lib/api";
import { getScoringWindowStart, sortTransactions } from "../lib/scoring";
import type { DiscoveryResponse, ReliabilityResponse, Transaction } from "../types/app";

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

type UseDashboardDataOptions = {
  selectedFrom: string;
  selectedUserId: string;
  reliabilityRefreshKey: number;
  setSelectedFrom: (value: string | ((current: string) => string)) => void;
  setSelectedUserId: (value: string | ((current: string) => string)) => void;
};

export const useDashboardData = ({
  selectedFrom,
  selectedUserId,
  reliabilityRefreshKey,
  setSelectedFrom,
  setSelectedUserId,
}: UseDashboardDataOptions) => {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [reliability, setReliability] = useState<ReliabilityResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [reliabilityError, setReliabilityError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(true);
  const [isReliabilityLoading, setIsReliabilityLoading] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

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

  return {
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
  };
};
