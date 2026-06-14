import { format, parseISO } from "date-fns";

export const formatCurrency = (
  value: number,
  currency: string,
  maximumFractionDigits = 0,
) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);

export const formatMetricPercent = (value: number) =>
  `${Math.round(value * 100)}%`;

export const formatRatio = (value: number) =>
  `${value.toFixed(2).replace(/\.00$/, "")}x`;

export const formatDateLabel = (value: string, pattern = "MMM d, yyyy") =>
  format(parseISO(value), pattern);
