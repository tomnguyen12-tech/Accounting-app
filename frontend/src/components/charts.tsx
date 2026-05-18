import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategorySlice } from "@/types";
import { CATEGORY_COLORS, won } from "@/lib/format";

/** Deliverable #10 — category spending pie chart. */
export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  if (!data.length)
    return <p className="py-12 text-center text-sm text-slate-400">데이터 없음 / No data</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          innerRadius={64}
          outerRadius={110}
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell key={d.category} fill={CATEGORY_COLORS[d.category] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number, _n, p: any) =>
            [`${won(v)} (${p.payload.percent ?? ""}%)`, p.payload.category]
          }
        />
        <Legend
          formatter={(_v, _e, i) => {
            const d = data[i as number];
            return `${d.category} · ${d.percent ?? ""}%`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DailyBarChart({ data }: { data: { date: string; amount: number }[] }) {
  if (!data.length)
    return <p className="py-12 text-center text-sm text-slate-400">데이터 없음 / No data</p>;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => won(v)} />
        <Bar dataKey="amount" fill="#14b8a6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
