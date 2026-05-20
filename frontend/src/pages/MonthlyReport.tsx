import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { db } from "@/lib/db";
import { won, num, fmtDate, currentMonth, CATEGORY_COLORS } from "@/lib/format";
import { Button, Card, CardBody, Input, Label, Select, Spinner, StatCard } from "@/components/ui";
import { CategoryPieChart, DailyBarChart } from "@/components/charts";
import type { CardRow, ReportSummary, Transaction, UserRow } from "@/types";

type PeriodType = "month" | "range";

/**
 * Dynamic monthly report — no hardcoded Kevin/March. Filters by selected
 * user (required), optional card (filtered by user), and period (monthly
 * picker or custom date range). Charts are rendered from db.reportSummary().
 */
export default function MonthlyReport() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);

  // Pending filter state (the form).
  const [userId, setUserId] = useState<string>("");
  const [cardId, setCardId] = useState<string>("");
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [month, setMonth] = useState<string>(currentMonth());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Applied filter state (what's actually shown).
  const [applied, setApplied] = useState<{
    userId: string;
    cardId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const [data, setData] = useState<ReportSummary | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    db.listUsers().then((r) => {
      setUsers(r.users);
      // Default to first user with role USER so the page can apply immediately.
      const first = r.users.find((u) => u.role === "USER") ?? r.users[0];
      if (first) setUserId(first.id);
    });
  }, []);

  // Reset card when user changes; reload that user's cards.
  useEffect(() => {
    setCardId("");
    if (!userId) {
      setCards([]);
      return;
    }
    db.listCards({ userId }).then((r) => setCards(r.cards));
  }, [userId]);

  const resolvePeriod = (): { startDate: string; endDate: string } | null => {
    if (periodType === "month") {
      if (!month) return null;
      const base = dayjs(`${month}-01`);
      return {
        startDate: base.startOf("month").format("YYYY-MM-DD"),
        endDate: base.endOf("month").format("YYYY-MM-DD"),
      };
    }
    if (!dateFrom || !dateTo) return null;
    return { startDate: dateFrom, endDate: dateTo };
  };

  const apply = async () => {
    if (!userId) return;
    const p = resolvePeriod();
    if (!p) return;
    setLoading(true);
    setApplied({ userId, cardId, ...p });
    try {
      const [summary, list] = await Promise.all([
        db.reportSummary({
          userId,
          cardId: cardId ? Number(cardId) : undefined,
          startDate: p.startDate,
          endDate: p.endDate,
        }),
        db.listTransactions({
          userId,
          ...(cardId ? { cardId } : {}),
          from: p.startDate,
          to: p.endDate,
          pageSize: 200,
        }),
      ]);
      setData(summary);
      setTxns(list.rows);
    } finally {
      setLoading(false);
    }
  };

  // Auto-apply once we have a default user + month (so the page isn't blank).
  useEffect(() => {
    if (userId && !applied) apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const drillToCategory = (category: string) => {
    if (!applied) return;
    const params = new URLSearchParams({
      userId: applied.userId,
      from: applied.startDate,
      to: applied.endDate,
      category,
    });
    if (applied.cardId) params.set("cardId", applied.cardId);
    navigate(`/transactions?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">월별 리포트 / Monthly Report</h1>
        <p className="text-sm text-slate-500">
          사용자·카드·기간별 지출 분석 — 모든 위젯은 선택된 필터에 따라 동적으로 갱신됩니다.
        </p>
      </div>

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <Label>User · 사용자 *</Label>
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">— Select user —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Card · 카드</Label>
            <Select value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!userId}>
              <option value="">All cards</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cardNumberMasked}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Period type</Label>
            <Select value={periodType} onChange={(e) => setPeriodType(e.target.value as PeriodType)}>
              <option value="month">Monthly</option>
              <option value="range">Custom date range</option>
            </Select>
          </div>
          {periodType === "month" ? (
            <div className="md:col-span-1">
              <Label>Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <Label>From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex items-end">
            <Button className="w-full" onClick={apply} disabled={!userId || loading}>
              Apply
            </Button>
          </div>
        </CardBody>
      </Card>

      {!applied && !loading && (
        <Card>
          <CardBody className="py-12 text-center text-slate-400">
            Vui lòng chọn user + kỳ rồi bấm <b>Apply</b>.
          </CardBody>
        </Card>
      )}

      {loading && <Spinner />}

      {applied && !loading && data && data.transactionCount === 0 && (
        <Card>
          <CardBody className="py-12 text-center text-slate-400">
            No transactions found for the selected user and period.
          </CardBody>
        </Card>
      )}

      {applied && !loading && data && data.transactionCount > 0 && (
        <>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {data.user?.name ?? "User"}{" "}
              {periodType === "month" && month
                ? `${Number(month.slice(5, 7))}월 카드 이용내역 요약`
                : `${data.period.startDate} ~ ${data.period.endDate}`}
            </h2>
            <p className="text-sm text-slate-500">월별 지출 현황 및 카테고리 분석</p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="총 사용금액"
              value={won(data.totalAmount)}
              accent="text-brand-600"
            />
            <StatCard label="총 거래 건수" value={`${num(data.transactionCount)}건`} />
            <StatCard
              label="사용 카드"
              value={data.card?.cardNumberMasked ?? "All cards"}
            />
            <StatCard
              label="이용 기간"
              value={dayjs(data.period.startDate).format("YYYY.MM.DD")}
              hint={`~ ${dayjs(data.period.endDate).format("YYYY.MM.DD")}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardBody>
                <h3 className="mb-4 text-sm font-semibold text-slate-700">
                  카테고리 지출 분석 / Category breakdown
                </h3>
                <CategoryPieChart
                  data={data.categoryBreakdown.map((c) => ({
                    category: c.category,
                    label: c.label,
                    amount: c.amount,
                    count: c.count,
                    percent: c.percentage,
                  }))}
                />
                <div className="mt-4 space-y-1.5">
                  {data.categoryBreakdown.map((c) => (
                    <button
                      key={c.category}
                      onClick={() => drillToCategory(c.category)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
                      title="Mở danh sách giao dịch của category này"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: CATEGORY_COLORS[c.category] ?? "#94a3b8" }}
                        />
                        {c.category}
                      </span>
                      <span>
                        <b className="text-slate-800">{won(c.amount)}</b> / {c.percentage}%
                      </span>
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardBody>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Top 5 가맹점</h3>
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
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">최대 거래 / Largest</h3>
                  {data.largestTransaction ? (
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        {won(data.largestTransaction.amount)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {data.largestTransaction.merchantName} ·{" "}
                        {fmtDate(data.largestTransaction.transactionDate)}
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
              <DailyBarChart data={data.dailySpending} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="mb-4 text-sm font-semibold text-slate-700">
                상세 거래 내역 / Transactions ({txns.length})
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
                        <td className="py-2 text-right text-slate-500">{won(t.vatAmount)}</td>
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
