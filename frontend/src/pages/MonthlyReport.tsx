import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { won, num, fmtDate, currentMonth } from "@/lib/format";
import { Card, CardBody, Select, Input, Spinner, StatCard } from "@/components/ui";
import { CategoryPieChart, DailyBarChart } from "@/components/charts";
import type { UserDashboard, UserRow, Transaction } from "@/types";

export default function MonthlyReport() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [month, setMonth] = useState("2026-03");
  const [data, setData] = useState<UserDashboard | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.listUsers().then((r) => {
      const list: UserRow[] = r.users.filter((u: UserRow) => u.role === "USER");
      setUsers(list);
      if (list.length) setUserId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      db.userMonthlyDashboard(userId, month),
      db.listTransactions({ userId, month, pageSize: 200 }),
    ])
      .then(([d, t]) => {
        setData(d);
        setTxns(t.rows);
      })
      .finally(() => setLoading(false));
  }, [userId, month]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">월별 리포트 / Monthly Report</h1>
          <p className="text-sm text-slate-500">사용자별 지출 현황 및 카테고리 분석</p>
        </div>
        <div className="flex gap-3">
          <Select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-40"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{data.title}</h2>
            <p className="text-sm text-slate-500">{data.subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="총 사용금액"
              value={won(data.summary.totalAmount)}
              accent="text-brand-600"
            />
            <StatCard label="총 거래 건수" value={`${num(data.summary.totalCount)}건`} />
            <StatCard
              label="사용 카드"
              value={data.summary.cards[0] ?? "-"}
              hint={data.summary.cards.slice(1).join(", ")}
            />
            <StatCard
              label="이용 기간"
              value={data.summary.periodLabel}
              hint={`${data.summary.periodStart} ~ ${data.summary.periodEnd}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardBody>
                <h3 className="mb-4 text-sm font-semibold text-slate-700">
                  카테고리 지출 분석 / Category pie
                </h3>
                <CategoryPieChart data={data.byCategory} />
                <div className="mt-4 space-y-1.5">
                  {data.byCategory.map((c) => (
                    <div
                      key={c.category}
                      className="flex justify-between text-sm text-slate-600"
                    >
                      <span>{c.category}</span>
                      <span>
                        <b className="text-slate-800">{won(c.amount)}</b> / {c.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardBody>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    Top 5 가맹점
                  </h3>
                  <ol className="space-y-2 text-sm">
                    {data.topMerchants.map((m, i) => (
                      <li key={m.merchantName} className="flex justify-between">
                        <span className="truncate">
                          <span className="mr-2 text-slate-400">{i + 1}</span>
                          {m.merchantName}
                        </span>
                        <span className="font-medium">{won(m.amount)}</span>
                      </li>
                    ))}
                  </ol>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">
                    최대 거래 / Largest
                  </h3>
                  {data.largest ? (
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        {won(data.largest.amount)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {data.largest.merchantName} ·{" "}
                        {fmtDate(data.largest.transactionDate)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">-</p>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          <Card>
            <CardBody>
              <h3 className="mb-4 text-sm font-semibold text-slate-700">
                일별 지출 / Daily spending
              </h3>
              <DailyBarChart data={data.daily} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="mb-4 text-sm font-semibold text-slate-700">
                상세 거래 내역 / Detailed transactions ({txns.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr>
                      <th className="pb-2">일자</th>
                      <th className="pb-2">가맹점</th>
                      <th className="pb-2">카테고리</th>
                      <th className="pb-2 text-right">금액</th>
                      <th className="pb-2 text-right">부가세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="py-2">{fmtDate(t.transactionDate)}</td>
                        <td className="py-2">{t.merchantName}</td>
                        <td className="py-2">{t.category}</td>
                        <td className="py-2 text-right font-medium">{won(t.amount)}</td>
                        <td className="py-2 text-right text-slate-500">
                          {won(t.vatAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
