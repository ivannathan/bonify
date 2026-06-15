import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { getTransactionStreamUrl, validateTransactionStream } from "../lib/api";
import { applyTransactionEvent } from "../lib/scoring";
import type { Transaction, TransactionEventPayload } from "../types/app";

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

const TRANSACTION_EVENT_TYPES = [
  "TRANSACTION_ADDED",
  "TRANSACTION_UPDATED",
  "TRANSACTION_DELETED",
] as const;

type TransactionEventType = (typeof TRANSACTION_EVENT_TYPES)[number];

type RawTransactionEventPayload = Omit<TransactionEventPayload, "type" | "transaction_id"> &
  Partial<Pick<TransactionEventPayload, "type" | "transaction_id">> & {
    transactionId?: string;
  };

const isTransactionEventType = (value: string): value is TransactionEventType =>
  TRANSACTION_EVENT_TYPES.includes(value as TransactionEventType);

const parseTransactionEventMessage = (
  eventType: TransactionEventType,
  message: MessageEvent<string>,
): TransactionEventPayload | null => {
  try {
    const payload = JSON.parse(message.data) as RawTransactionEventPayload;
    let normalizedType: TransactionEventType = eventType;

    if (isTransactionEventType(payload.type ?? "")) {
      normalizedType = payload.type as TransactionEventType;
    }

    const normalizedTransactionId = payload.transaction_id ?? payload.transactionId;

    return {
      ...payload,
      type: normalizedType,
      transaction_id: normalizedTransactionId,
    };
  } catch (error) {
    console.error(`Invalid SSE payload for ${eventType}:`, error);
    return null;
  }
};

export type LiveStatus = "off" | "connecting" | "live" | "reconnecting" | "unavailable";

type UseLiveTransactionsOptions = {
  liveMode: boolean;
  selectedFrom: string;
  selectedTo: string;
  selectedUserId: string;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
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
  selectedTo,
  selectedUserId,
  setTransactions,
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
        from: selectedFrom,
        to: selectedTo,
      }),
    );
    scheduleReliabilityRefresh();
  });

  useEffect(() => {
    if (!liveMode || !selectedUserId) {
      setLiveStatus("off");
      return;
    }

    let hasConnected = false;
    const controller = new AbortController();
    const eventSource = new EventSource(getTransactionStreamUrl(selectedUserId));

    setLiveStatus("connecting");

    eventSource.onopen = () => {
      hasConnected = true;
      setLiveStatus("live");
    };

    eventSource.onerror = () => {
      if (controller.signal.aborted) {
        return;
      }

      if (!hasConnected) {
        void validateTransactionStream(selectedUserId, { signal: controller.signal }).catch((error) => {
          if (isAbortError(error) || controller.signal.aborted) {
            return;
          }

          console.error("Initial SSE connection failed:", error);
          setLiveStatus("unavailable");
        });
        return;
      }

      setLiveStatus("reconnecting");
    };

    const listeners = TRANSACTION_EVENT_TYPES.map((eventType) => {
      const listener: EventListener = (rawEvent) => {
        const event = rawEvent as MessageEvent<string>;
        const payload = parseTransactionEventMessage(eventType, event);

        if (!payload) {
          return;
        }

        handleStreamEvent(payload);
      };

      eventSource.addEventListener(eventType, listener);
      return { eventType, listener };
    });

    return () => {
      controller.abort();
      eventSource.onopen = null;
      eventSource.onerror = null;

      for (const { eventType, listener } of listeners) {
        eventSource.removeEventListener(eventType, listener);
      }

      eventSource.close();
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
