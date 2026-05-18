import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { won, fmtDate, STATUS_STYLES } from "@/lib/format";
import { Badge, Button, Card, CardBody, Input, Label, Select, Spinner } from "@/components/ui";
import type { CardRow, Department, TransactionPage, UserRow } from "@/types";

const STATUSES = [
  "DRAFT",
  "AI_EXTRACTED",
  "SUBMITTED",
  "NEEDS_REVISION",
  "APPROVED",
  "REJECTED",
];
const CATEGORIES = [
  "식음료",
  "교통",
  "숙박/여행",
  "레저",
  "소프트웨어",
  "사무용품",
  "접대비",
  "기타",
];

const EMPTY = {
  month: "",
  from: "",
  to: "",
  userId: "",
  departmentId: "",
  cardId: "",
  category: "",
  merchant: "",
  minAmount: "",
  maxAmount: "",
  status: "",
  sourceType: "",
  missingPurpose: "",
  missingReceipt: "",
  approved: "",
};

export default function Transactions() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string>>({ ...EMPTY });
  const [applied, setApplied] = useState<Record<string, string>>({ ...EMPTY });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TransactionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);

  useEffect(() => {
    api.get("/users").then((r) => setUsers(r.data.users));
    api.get("/cards").then((r) => setCards(r.data.cards));
    api.get("/departments").then((r) => setDepts(r.data.departments));
  }, []);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, pageSize: 25 };
    for (const [k, v] of Object.entries(applied)) if (v) p[k] = v;
    return p;
  }, [applied, page]);

  useEffect(() => {
    setLoading(true);
    api
      .get<TransactionPage>("/transactions", { params })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [params]);

  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const apply = () => {
    setPage(1);
    setApplied({ ...filters });
  };
  const reset = () => {
    setFilters({ ...EMPTY });
    setApplied({ ...EMPTY });
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">거래내역 / Transactions</h1>
        <p className="text-sm text-slate-500">필터링 · 검토 · 사용목적 입력</p>
      </div>

      <Card>
        <CardBody className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <div>
            <Label>월 · Month</Label>
            <Input type="month" value={filters.month} onChange={(e) => set("month", e.target.value)} />
          </div>
          <div>
            <Label>시작일 · From</Label>
            <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <Label>종료일 · To</Label>
            <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
          </div>
          <div>
            <Label>사용자 · User</Label>
            <Select value={filters.userId} onChange={(e) => set("userId", e.target.value)}>
              <option value="">전체</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>부서 · Dept</Label>
            <Select
              value={filters.departmentId}
              onChange={(e) => set("departmentId", e.target.value)}
            >
              <option value="">전체</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>카드 · Card</Label>
            <Select value={filters.cardId} onChange={(e) => set("cardId", e.target.value)}>
              <option value="">전체</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cardNumberMasked}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>카테고리 · Category</Label>
            <Select value={filters.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">전체</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>가맹점 · Merchant</Label>
            <Input value={filters.merchant} onChange={(e) => set("merchant", e.target.value)} />
          </div>
          <div>
            <Label>최소금액 · Min</Label>
            <Input
              type="number"
              value={filters.minAmount}
              onChange={(e) => set("minAmount", e.target.value)}
            />
          </div>
          <div>
            <Label>최대금액 · Max</Label>
            <Input
              type="number"
              value={filters.maxAmount}
              onChange={(e) => set("maxAmount", e.target.value)}
            />
          </div>
          <div>
            <Label>상태 · Status</Label>
            <Select value={filters.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">전체</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>소스 · Source</Label>
            <Select
              value={filters.sourceType}
              onChange={(e) => set("sourceType", e.target.value)}
            >
              <option value="">전체</option>
              <option value="EXCEL">Excel</option>
              <option value="PDF">PDF</option>
              <option value="IMAGE">Image</option>
              <option value="MANUAL">Manual</option>
            </Select>
          </div>
          <div>
            <Label>사용목적 누락</Label>
            <Select
              value={filters.missingPurpose}
              onChange={(e) => set("missingPurpose", e.target.value)}
            >
              <option value="">전체</option>
              <option value="true">누락만</option>
            </Select>
          </div>
          <div>
            <Label>영수증 누락</Label>
            <Select
              value={filters.missingReceipt}
              onChange={(e) => set("missingReceipt", e.target.value)}
            >
              <option value="">전체</option>
              <option value="true">누락만</option>
            </Select>
          </div>
          <div>
            <Label>승인여부</Label>
            <Select value={filters.approved} onChange={(e) => set("approved", e.target.value)}>
              <option value="">전체</option>
              <option value="true">승인됨</option>
              <option value="false">미승인</option>
            </Select>
          </div>
          <div className="col-span-2 flex items-end gap-2 md:col-span-4 xl:col-span-2">
            <Button onClick={apply} className="flex-1">
              필터 적용 / Apply
            </Button>
            <Button variant="secondary" onClick={reset}>
              초기화
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {loading || !data ? (
            <Spinner />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  총 {data.total.toLocaleString()}건 · 합계{" "}
                  <b className="text-slate-800">{won(data.totalAmount)}</b>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr>
                      <th className="pb-2">일자</th>
                      <th className="pb-2">사용자</th>
                      <th className="pb-2">가맹점</th>
                      <th className="pb-2">카테고리</th>
                      <th className="pb-2 text-right">금액</th>
                      <th className="pb-2">사용목적</th>
                      <th className="pb-2">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => navigate(`/transactions/${t.id}`)}
                        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="py-2.5">{fmtDate(t.transactionDate)}</td>
                        <td className="py-2.5">{t.user?.name ?? "-"}</td>
                        <td className="py-2.5">{t.merchantName}</td>
                        <td className="py-2.5">{t.category}</td>
                        <td className="py-2.5 text-right font-medium">{won(t.amount)}</td>
                        <td className="py-2.5">
                          {t.purpose ? (
                            <span className="text-slate-600">{t.purpose}</span>
                          ) : (
                            <span className="text-rose-500">미입력</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <Badge className={STATUS_STYLES[t.status]}>{t.status}</Badge>
                        </td>
                      </tr>
                    ))}
                    {!data.rows.length && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          결과 없음 / No results
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {data.page} / {data.totalPages || 1} 페이지
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    이전
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
