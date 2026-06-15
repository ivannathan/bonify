import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import { openTransactionStream } from "../lib/api";
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

type StreamEnvelope = {
  body?: string;
};

const isTransactionEventType = (value: string): value is TransactionEventType =>
  TRANSACTION_EVENT_TYPES.includes(value as TransactionEventType);

const normalizeTransactionEventPayload = (
  rawPayload: string,
  eventType?: string,
): TransactionEventPayload | null => {
  try {
    const payload = JSON.parse(rawPayload) as RawTransactionEventPayload;
    const fallbackType = eventType && isTransactionEventType(eventType) ? eventType : null;
    const payloadType = payload.type ?? "";
    const normalizedType = isTransactionEventType(payloadType)
      ? payloadType
      : fallbackType;

    if (!normalizedType) {
      return null;
    }

    const normalizedTransactionId = payload.transaction_id ?? payload.transactionId;

    return {
      ...payload,
      type: normalizedType,
      transaction_id: normalizedTransactionId,
    };
  } catch (error) {
    console.error("Invalid transaction stream payload:", error);
    return null;
  }
};

const extractEnvelopeBody = (rawPayload: string) => {
  try {
    const payload = JSON.parse(rawPayload) as StreamEnvelope;

    return typeof payload.body === "string" ? payload.body : null;
  } catch {
    return null;
  }
};

type StreamFrame = {
  data: string;
  eventType?: string;
};

const findSseBoundary = (buffer: string) => {
  const lfBoundary = buffer.indexOf("\n\n");

  if (lfBoundary !== -1) {
    return { boundary: lfBoundary, length: 2 };
  }

  const crlfBoundary = buffer.indexOf("\r\n\r\n");

  if (crlfBoundary !== -1) {
    return { boundary: crlfBoundary, length: 4 };
  }

  return null;
};

const extractSseFrame = (buffer: string): { frame: StreamFrame | null; rest: string } | null => {
  const trimmedStart = buffer.trimStart();

  if (
    !trimmedStart.startsWith("event:") &&
    !trimmedStart.startsWith("data:") &&
    !trimmedStart.startsWith(":")
  ) {
    return null;
  }

  const boundary = findSseBoundary(buffer);

  if (!boundary) {
    return null;
  }

  const block = buffer.slice(0, boundary.boundary);
  const rest = buffer.slice(boundary.boundary + boundary.length);
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  let eventType: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return { frame: null, rest };
  }

  return {
    frame: {
      data: dataLines.join("\n"),
      eventType,
    },
    rest,
  };
};

const extractJsonFrame = (buffer: string): { frame: StreamFrame; rest: string } | null => {
  const start = buffer.search(/\S/);

  if (start === -1 || buffer[start] !== "{") {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < buffer.length; index += 1) {
    const character = buffer[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          frame: {
            data: buffer.slice(start, index + 1),
          },
          rest: buffer.slice(index + 1),
        };
      }
    }
  }

  return null;
};

const extractStreamFrames = (buffer: string): { frames: StreamFrame[]; rest: string } => {
  const frames: StreamFrame[] = [];
  let rest = buffer;

  while (rest.trim().length > 0) {
    const sseFrame = extractSseFrame(rest);

    if (sseFrame) {
      if (sseFrame.frame) {
        frames.push(sseFrame.frame);
      }

      rest = sseFrame.rest;
      continue;
    }

    const jsonFrame = extractJsonFrame(rest);

    if (jsonFrame) {
      frames.push(jsonFrame.frame);
      rest = jsonFrame.rest;
      continue;
    }

    break;
  }

  return { frames, rest };
};

const parseTransactionEventPayloads = (
  rawPayload: string,
  eventType?: string,
): TransactionEventPayload[] => {
  const normalizedPayload = normalizeTransactionEventPayload(rawPayload, eventType);

  if (normalizedPayload) {
    return [normalizedPayload];
  }

  const envelopeBody = extractEnvelopeBody(rawPayload);

  if (!envelopeBody) {
    return [];
  }

  const { frames } = extractStreamFrames(envelopeBody);

  return frames
    .map((frame) => normalizeTransactionEventPayload(frame.data, frame.eventType))
    .filter((payload): payload is TransactionEventPayload => payload !== null);
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", abortHandler);
      resolve();
    }, ms);

    const abortHandler = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", abortHandler, { once: true });
  });

const streamTransactionEvents = async (
  userId: string,
  signal: AbortSignal,
  onOpen: () => void,
  onEvent: (payload: TransactionEventPayload) => void,
) => {
  const response = await openTransactionStream(userId, { signal });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  onOpen();

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        const finalBuffer = buffer + decoder.decode();
        const { frames } = extractStreamFrames(finalBuffer);

        for (const frame of frames) {
          for (const payload of parseTransactionEventPayloads(frame.data, frame.eventType)) {
            onEvent(payload);
          }
        }

        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsed = extractStreamFrames(buffer);
      buffer = parsed.rest;

      for (const frame of parsed.frames) {
        for (const payload of parseTransactionEventPayloads(frame.data, frame.eventType)) {
          onEvent(payload);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};

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

    const controller = new AbortController();
    let hasConnected = false;

    void (async () => {
      while (!controller.signal.aborted) {
        setLiveStatus(hasConnected ? "reconnecting" : "connecting");

        try {
          await streamTransactionEvents(
            selectedUserId,
            controller.signal,
            () => {
              hasConnected = true;
              setLiveStatus("live");
            },
            handleStreamEvent,
          );
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) {
            return;
          }

          if (!hasConnected) {
            console.error("Initial transaction stream connection failed:", error);
            setLiveStatus("unavailable");
            return;
          }

          console.error("Transaction stream interrupted:", error);
        }

        if (controller.signal.aborted) {
          return;
        }

        setLiveStatus("reconnecting");

        try {
          await sleep(1500, controller.signal);
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) {
            return;
          }

          throw error;
        }
      }
    })();

    return () => {
      controller.abort();
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
