import type { DiscoveryResponse, ReliabilityResponse, TransactionsResponse } from "../types/app";

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
};
export const getTransactionStreamUrl = (userId: string) =>
  `${SSE_BASE_URL}/api/users/${userId}/transaction-events`;

export const openTransactionStream = async (
  userId: string,
  { signal }: StreamHandlers = {},
) => {
  const response = await fetch(getTransactionStreamUrl(userId), {
    headers: {
      Accept: "application/octet-stream, text/event-stream, application/json",
    },
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Stream failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Stream response did not include a readable body.");
  }

  return response;
};
