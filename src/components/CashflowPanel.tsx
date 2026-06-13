import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, formatRatio } from "../lib/format";
import type { MonthlyCashflow } from "../types";

interface CashflowPanelProps {
  currency: string;
  monthlyCashflow: MonthlyCashflow[];
}

export const CashflowPanel = ({
  currency,
  monthlyCashflow,
}: CashflowPanelProps) => {
  return (
    <div className="space-y-6">
      <section className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Monthly Cashflow</p>
            <p className="mt-2 text-sm text-slate-500">
              Income, total expenses, and net surplus across the active scoring window.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {monthlyCashflow.length} months in view
          </div>
        </div>

        <div className="mt-6 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyCashflow}>
              <CartesianGrid strokeDasharray="4 6" stroke="#dbe3f0" />
              <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value, currency)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "1px solid #dbe3f0",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Bar dataKey="income" fill="var(--accent-emerald)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--accent-rose)" radius={[8, 8, 0, 0]} />
              <Line
                type="monotone"
                dataKey="net"
                stroke="var(--accent-amber)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--accent-amber)" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card-surface overflow-hidden">
        <div className="grid grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] gap-4 border-b border-slate-200 px-6 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          <div>Month</div>
          <div>Income</div>
          <div>Expenses</div>
          <div>Net</div>
          <div>Coverage</div>
        </div>
        <div className="divide-y divide-slate-200">
          {monthlyCashflow.map((month) => (
            <div
              key={month.key}
              className="grid grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] gap-4 px-6 py-4 text-sm"
            >
              <div className="font-medium text-slate-700">{month.label}</div>
              <div className="font-semibold text-emerald-600">
                {formatCurrency(month.income, currency)}
              </div>
              <div className="font-semibold text-rose-500">
                {formatCurrency(month.expenses, currency)}
              </div>
              <div className="font-semibold text-slate-900">
                {formatCurrency(month.net, currency)}
              </div>
              <div className="font-medium text-slate-600">
                {month.coverage ? formatRatio(month.coverage) : "n/a"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
