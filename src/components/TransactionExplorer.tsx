import clsx from "clsx";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { getTransactionCategory } from "../lib/categories";
import { formatCurrency, formatDateLabel } from "../lib/format";
import {
  getMerchantDisplay,
  getTransactionSearchValue,
} from "../lib/scoring";
import type { Transaction } from "../types";

type SortField = "date" | "merchant" | "category" | "amount";
type DirectionFilter = "all" | "credit" | "debit";

interface TransactionExplorerProps {
  transactions: Transaction[];
  currency: string;
  isLoading: boolean;
  error: string | null;
}

export const TransactionExplorer = ({
  transactions,
  currency,
  isLoading,
  error,
}: TransactionExplorerProps) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const deferredQuery = useDeferredValue(query);

  const categories = useMemo(() => {
    return ["all", ...new Set(transactions.map(getTransactionCategory))].sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    const result = transactions.filter((transaction) => {
      if (category !== "all" && getTransactionCategory(transaction) !== category) {
        return false;
      }

      if (direction !== "all" && transaction.type !== direction) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return getTransactionSearchValue(transaction).includes(normalizedQuery);
    });

    return result.sort((left, right) => {
      let compare = 0;

      if (sortField === "date") {
        compare = left.date.localeCompare(right.date);
      }

      if (sortField === "merchant") {
        compare = getMerchantDisplay(left).localeCompare(getMerchantDisplay(right));
      }

      if (sortField === "category") {
        compare = getTransactionCategory(left).localeCompare(getTransactionCategory(right));
      }

      if (sortField === "amount") {
        compare = left.amount - right.amount;
      }

      return sortOrder === "asc" ? compare : compare * -1;
    });
  }, [category, deferredQuery, direction, sortField, sortOrder, transactions]);

  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredTransactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 12,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  const setSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortOrder(field === "amount" ? "desc" : "asc");
  };

  return (
    <div className="space-y-6">
      <section className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Transaction Explorer</p>
            <p className="mt-2 text-sm text-slate-500">
              Full-window fetch with client-side virtualization keeps search and sorting responsive even when the dataset becomes large or arrives out of order.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {filteredTransactions.length.toLocaleString()} of {transactions.length.toLocaleString()} records
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_220px_220px]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">Search merchant or description</span>
            <input
              id="transaction-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search merchant, memo, category..."
              className="input-base"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-600">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="input-base"
            >
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All categories" : option}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-600">Direction</span>
            <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
              {(["all", "credit", "debit"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDirection(option)}
                  className={clsx(
                    "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
                    direction === option
                      ? "bg-slate-950 text-white"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {option === "all"
                    ? "All"
                    : option === "credit"
                      ? "Credit"
                      : "Debit"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card-surface overflow-hidden">
        <div className="grid grid-cols-[140px_1.5fr_1fr_140px] gap-4 border-b border-slate-200 px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          <SortButton label="Date" active={sortField === "date"} order={sortOrder} onClick={() => setSort("date")} />
          <SortButton label="Merchant" active={sortField === "merchant"} order={sortOrder} onClick={() => setSort("merchant")} />
          <SortButton label="Category" active={sortField === "category"} order={sortOrder} onClick={() => setSort("category")} />
          <SortButton label="Amount" active={sortField === "amount"} order={sortOrder} align="right" onClick={() => setSort("amount")} />
        </div>

        {isLoading ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            Loading transactions for the active scoring window…
          </div>
        ) : error ? (
          <div className="px-6 py-14 text-center text-sm text-rose-600">{error}</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No transactions match the current filters.
          </div>
        ) : (
          <div ref={parentRef} className="h-[720px] overflow-auto">
            <div
              className="relative"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualRows.map((virtualRow) => {
                const transaction = filteredTransactions[virtualRow.index];
                const categoryLabel = getTransactionCategory(transaction);
                const isPositive = transaction.amount >= 0;

                return (
                  <div
                    key={transaction.id}
                    className="absolute left-0 top-0 w-full border-b border-slate-100 px-6 py-4"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="grid grid-cols-[140px_1.5fr_1fr_140px] gap-4">
                      <div className="text-sm text-slate-500">
                        {formatDateLabel(transaction.date, "MMM d, yyyy")}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {getMerchantDisplay(transaction)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {transaction.description}
                        </p>
                      </div>
                      <div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                          {categoryLabel}
                        </span>
                      </div>
                      <div
                        className={clsx(
                          "text-right font-display text-2xl font-semibold tracking-tight",
                          isPositive ? "text-emerald-600" : "text-slate-900",
                        )}
                      >
                        {isPositive ? "+" : "−"}
                        {formatCurrency(Math.abs(transaction.amount), currency, 2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const SortButton = ({
  label,
  active,
  order,
  align,
  onClick,
}: {
  label: string;
  active: boolean;
  order: "asc" | "desc";
  align?: "right";
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 text-left transition hover:text-slate-700",
        align === "right" && "justify-end text-right",
        active && "text-slate-700",
      )}
    >
      <span>{label}</span>
      {active ? <span>{order === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
};
