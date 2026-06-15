import { useEffect, useRef, useState } from "react";

import { getDiscovery, getReliability, getTransactions } from "../lib/api";
import { sortTransactions } from "../lib/scoring";
import type { DiscoveryResponse, ReliabilityResponse, Transaction } from "../types/app";

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

type UseDashboardDataOptions = {
  selectedFrom: string;
  selectedTo: string;
  selectedUserId: string;
  reliabilityRefreshKey: number;
  setSelectedFrom: (value: string | ((current: string) => string)) => void;
  setSelectedTo: (value: string | ((current: string) => string)) => void;
  setSelectedUserId: (value: string | ((current: string) => string)) => void;
};

const normalizeDateInRange = (value: string, fallback: string, minimum: string, maximum: string) => {
  if (!value) {
    return fallback;
  }

  if (value < minimum) {
    return minimum;
  }

  if (value > maximum) {
    return maximum;
  }

  return value;
};

export const useDashboardData = ({
  selectedFrom,
  selectedTo,
  selectedUserId,
  reliabilityRefreshKey,
  setSelectedFrom,
  setSelectedTo,
  setSelectedUserId,
}: UseDashboardDataOptions) => {
  const latestRangeRef = useRef({ selectedFrom, selectedTo });
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [reliability, setReliability] = useState<ReliabilityResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [reliabilityError, setReliabilityError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(true);
  const [isReliabilityLoading, setIsReliabilityLoading] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);

  latestRangeRef.current = { selectedFrom, selectedTo };

  useEffect(() => {
    const controller = new AbortController();

    setIsDiscoveryLoading(true);
    setDiscoveryError(null);

    getDiscovery(controller.signal)
      .then((response) => {
        const { selectedFrom: currentFrom, selectedTo: currentTo } = latestRangeRef.current;
        const normalizedFrom = normalizeDateInRange(
          currentFrom,
          response.data_range.from,
          response.data_range.from,
          response.data_range.to,
        );
        const normalizedTo = normalizeDateInRange(
          currentTo,
          response.data_range.to,
          response.data_range.from,
          response.data_range.to,
        );

        setDiscovery(response);
        setSelectedUserId((current) => current || response.available_users[0] || "");

        if (normalizedFrom > normalizedTo) {
          setSelectedFrom(response.data_range.from);
          setSelectedTo(response.data_range.to);
          return;
        }

        setSelectedFrom(normalizedFrom);
        setSelectedTo(normalizedTo);
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
  }, [setSelectedFrom, setSelectedTo, setSelectedUserId]);

  useEffect(() => {
    if (!selectedUserId || !selectedTo) {
      return;
    }

    const controller = new AbortController();

    setIsReliabilityLoading(true);
    setReliabilityError(null);

    getReliability(selectedUserId, selectedTo, controller.signal)
      .then((reliabilityResponse) => {
        setReliability(reliabilityResponse);
      })
      .catch((error: Error) => {
        if (isAbortError(error)) {
          return;
        }

        const message = error.message || "Unable to load dashboard data.";
        setReliabilityError(message);
      })
      .finally(() => {
        setIsReliabilityLoading(false);
      });

    return () => controller.abort();
  }, [reliabilityRefreshKey, selectedTo, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId || !selectedFrom || !selectedTo || selectedFrom > selectedTo) {
      setTransactions([]);
      return;
    }

    const controller = new AbortController();

    setIsTransactionsLoading(true);
    setTransactionsError(null);

    getTransactions(selectedUserId, selectedFrom, selectedTo, controller.signal)
      .then((transactionsResponse) => {
        setTransactions(sortTransactions(transactionsResponse.transactions));
      })
      .catch((error: Error) => {
        if (isAbortError(error)) {
          return;
        }

        setTransactionsError(error.message || "Unable to load transactions.");
      })
      .finally(() => {
        setIsTransactionsLoading(false);
      });

    return () => controller.abort();
  }, [selectedFrom, selectedTo, selectedUserId]);

  return {
    discovery,
    discoveryError,
    isDiscoveryLoading,
    isReliabilityLoading,
    isTransactionsLoading,
    reliability,
    reliabilityError,
    setTransactions,
    transactions,
    transactionsError,
  };
};
