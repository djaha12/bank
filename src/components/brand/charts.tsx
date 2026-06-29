"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND_COLORS = ["#6366f1", "#38bdf8", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#94a3b8"];

/** Spending donut. `data` amounts are MAJOR units (numbers) for chart scale. */
export function SpendingDonut({
  data,
}: {
  data: { name: string; value: number; color?: string }[];
}) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={96} paddingAngle={3} stroke="none">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? BRAND_COLORS[i % BRAND_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(222 40% 9%)",
            border: "1px solid hsl(217 33% 18%)",
            borderRadius: 12,
            color: "white",
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CashflowChart({
  data,
}: {
  data: { month: string; inflow: number; outflow: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(215 20% 65%)" />
        <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} stroke="hsl(215 20% 65%)" />
        <Tooltip
          cursor={{ fill: "hsl(217 33% 17% / 0.4)" }}
          contentStyle={{
            background: "hsl(222 40% 9%)",
            border: "1px solid hsl(217 33% 18%)",
            borderRadius: 12,
            color: "white",
            fontSize: 12,
          }}
        />
        <Bar dataKey="inflow" fill="#10b981" radius={[6, 6, 0, 0]} />
        <Bar dataKey="outflow" fill="#6366f1" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BalanceArea({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} fill="url(#balGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
