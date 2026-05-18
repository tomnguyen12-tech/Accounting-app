import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { won, num, currentMonth } from "@/lib/format";
import { Card, CardBody, Input, Spinner, StatCard } from "@/components/ui";
import { CategoryPieChart } from "@/components/charts";
import type { DashboardSummary } from "@/types";

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardSummary>("/dashboard/summary", { params: { month } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">대시보드 / Dashboard</h1>
          <p className="text-sm text-slate-500">회사 전체 월별 지출 현황</p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="총 지출금액 · Total" value={won(data.summary.totalAmount)} />
            <StatCard label="총 거래 건수 · Count" value={`${num(data.summary.totalCount)}건`} />
            <StatCard label="사용자 · Users" value={num(data.summary.userCount)} />
            <StatCard label="카드 · Cards" value={num(data.summary.cardCount)} />
            <StatCard
              label="검토 필요 · Review"
              value={num(data.summary.needsReview)}
              accent="text-orange-600"
            />
            <StatCard
              label="사용목적 누락 · No purpose"
              value={num(data.summary.missingPurpose)}
              accent="text-rose-600"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  카테고리별 지출 / Spending by category
                </h2>
                <CategoryPieChart data={data.byCategory} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  카테고리 상세 / Category breakdown
                </h2>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr>
                      <th className="pb-2">카테고리</th>
                      <th className="pb-2 text-right">금액</th>
                      <th className="pb-2 text-right">건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCategory.map((c) => (
                      <tr key={c.category} className="border-t border-slate-100">
                        <td className="py-2">
                          {c.category}{" "}
                          <span className="text-xs text-slate-400">· {c.label}</span>
                        </td>
                        <td className="py-2 text-right font-medium">{won(c.amount)}</td>
                        <td className="py-2 text-right text-slate-500">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Link
                  to="/report"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
                >
                  사용자별 월간 리포트 보기 →
                </Link>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
