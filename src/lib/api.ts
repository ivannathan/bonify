import type {
  DiscoveryResponse,
  ReliabilityResponse,
  TransactionEventPayload,
  TransactionsResponse,
} from "../types/app";

const trimSlash = (value: string) => value.replace(/\/+$/, "");

export const API_BASE_URL = trimSlash(
  import.meta.env.VITE_API_BASE_URL ?? "https://wydokyegph.execute-api.eu-central-1.amazonaws.com",
);

export const SSE_BASE_URL = trimSlash(
  import.meta.env.VITE_SSE_BASE_URL ?? "https://vpjjdvoeej5izlqy3nnpllmyua0idsrp.lambda-url.eu-central-1.on.aws",
);

const requestJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const getDiscovery = (signal?: AbortSignal) =>
  requestJson<DiscoveryResponse>(`${API_BASE_URL}/`, signal);

export const getReliability = (
  userId: string,
  from: string,
  signal?: AbortSignal,
) =>
  requestJson<ReliabilityResponse>(
    `${API_BASE_URL}/api/users/${userId}/reliability?from=${from}`,
    signal,
  );

export const getTransactions = (
  userId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
) =>
  requestJson<TransactionsResponse>(
    `${API_BASE_URL}/api/users/${userId}/transactions?from=${from}&to=${to}`,
    signal,
  );

type StreamHandlers = {
  signal?: AbortSignal;
  onOpen?: () => void;
  onEvent: (payload: TransactionEventPayload) => void;
};

type WrappedStreamResponse = {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

type ParsedSseEvent = {
  event?: string;
  data?: string;
};

const isWrappedStreamResponse = (value: unknown): value is WrappedStreamResponse => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "body" in value && typeof (value as WrappedStreamResponse).body === "string";
};

const parseSseChunk = (chunk: string): ParsedSseEvent[] =>
  chunk
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/);
      let eventName: string | undefined;
      const dataLines: string[] = [];

      for (const line of lines) {
        if (!line || line.startsWith(":")) {
          continue;
        }

        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }

        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      return {
        event: eventName,
        data: dataLines.length > 0 ? dataLines.join("\n") : undefined,
      };
    })
    .filter((event) => event.data);

const emitSseEvents = (
  source: string,
  onEvent: (payload: TransactionEventPayload) => void,
) => {
  for (const event of parseSseChunk(source)) {
    if (!event.data) {
      continue;
    }

    const payload = JSON.parse(event.data) as TransactionEventPayload;

    if (payload.type) {
      onEvent(payload);
    }
  }
};

export const consumeTransactionStream = async (
  userId: string,
  { signal, onOpen, onEvent }: StreamHandlers,
) => {
  const response = await fetch(`${SSE_BASE_URL}/api/users/${userId}/transaction-events`, {
    headers: {
      Accept: "text/event-stream",
    },
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Stream failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as WrappedStreamResponse;

    if (!isWrappedStreamResponse(payload)) {
      throw new Error("Unexpected JSON response from transaction stream.");
    }

    if (payload.body === undefined) {
      throw new Error("Wrapped transaction stream is missing a body.");
    }

    onOpen?.();
    emitSseEvents(payload.body, onEvent);
    return;
  }

  if (!response.body) {
    throw new Error("Transaction stream response has no body.");
  }

  onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.search(/\r?\n\r?\n/);

    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + (buffer[separatorIndex] === "\r" ? 4 : 2));
      emitSseEvents(block, onEvent);
      separatorIndex = buffer.search(/\r?\n\r?\n/);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    emitSseEvents(buffer, onEvent);
  }
};
