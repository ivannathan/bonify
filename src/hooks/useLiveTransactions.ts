import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { consumeTransactionStream } from "../lib/api";
import { applyTransactionEvent } from "../lib/scoring";
import type { Transaction, TransactionEventPayload } from "../types/app";

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export type LiveStatus = "off" | "connecting" | "live" | "reconnecting" | "unavailable";

type UseLiveTransactionsOptions = {
  liveMode: boolean;
  selectedFrom: string;
  selectedUserId: string;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  windowStart: string;
  onReliabilityRefresh: () => void;
};

export const getLiveIndicatorText = (status: LiveStatus) =>
  status === "live"
    ? "Live"
    : status === "connecting"
      ? "Connecting"
      : status === "reconnecting"
        ? "Reconnecting"
        : status === "unavailable"
          ? "Unavailable"
          : "Off";

export const useLiveTransactions = ({
  liveMode,
  selectedFrom,
  selectedUserId,
  setTransactions,
  windowStart,
  onReliabilityRefresh,
}: UseLiveTransactionsOptions) => {
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("off");
  const reliabilityRefreshTimerRef = useRef<number | null>(null);

  const scheduleReliabilityRefresh = useEffectEvent(() => {
    if (reliabilityRefreshTimerRef.current) {
      window.clearTimeout(reliabilityRefreshTimerRef.current);
    }

    reliabilityRefreshTimerRef.current = window.setTimeout(() => {
      startTransition(() => {
        onReliabilityRefresh();
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
    let reconnectTimer: number | null = null;
    let currentController: AbortController | null = null;
    let hasConnected = false;

    const scheduleReconnect = (status: "reconnecting" | "unavailable", delay: number) => {
      if (closed) {
        return;
      }

      setLiveStatus(status);
      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (closed) {
        return;
      }

      currentController?.abort();
      currentController = new AbortController();
      setLiveStatus(hasConnected ? "reconnecting" : "connecting");

      try {
        await consumeTransactionStream(selectedUserId, {
          signal: currentController.signal,
          onOpen: () => {
            hasConnected = true;
            setLiveStatus("live");
          },
          onEvent: handleStreamEvent,
        });

        if (!closed) {
          scheduleReconnect("reconnecting", 1500);
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        scheduleReconnect(hasConnected ? "reconnecting" : "unavailable", hasConnected ? 1500 : 5000);
      }
    };

    void connect();

    return () => {
      closed = true;
      currentController?.abort();

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      setLiveStatus("off");
    };
  }, [handleStreamEvent, liveMode, selectedUserId]);

  useEffect(() => {
    return () => {
      if (reliabilityRefreshTimerRef.current) {
        window.clearTimeout(reliabilityRefreshTimerRef.current);
      }
    };
  }, []);

  return { liveStatus };
};
