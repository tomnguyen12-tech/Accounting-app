import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { won } from "@/lib/format";
import { Badge, Button, Card, CardBody, Label, Select, Spinner } from "@/components/ui";
import type { CardRow, UserRow } from "@/types";

interface PreviewRow {
  rowIndex: number;
  transactionDate: string | null;
  merchantName: string;
  amount: number;
  vatAmount: number;
  cardNumberMasked: string;
  approvalNumber: string | null;
  errors: string[];
  duplicate: boolean;
  [k: string]: unknown;
}

interface Preview {
  headers: string[];
  autoMapping: Record<string, string | null>;
  rows: PreviewRow[];
  summary: { total: number; valid: number; invalid: number; duplicates: number };
}

const FIELDS = [
  "transaction_date",
  "approval_date",
  "payment_date",
  "card_number",
  "approval_number",
  "merchant_name",
  "merchant_number",
  "amount",
  "vat_amount",
  "discount_amount",
  "exchange_fee",
  "cancel_status",
  "transaction_type",
  "sales_type",
];

export default function ImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [cards, setCards] = useState<CardRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cardId, setCardId] = useState("");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    api.get("/cards").then((r) => setCards(r.data.cards));
    api.get("/users").then((r) => setUsers(r.data.users));
  }, []);

  const doPreview = async (override?: Record<string, string | null>) => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    if (override) fd.append("mapping", JSON.stringify(override));
    try {
      const { data } = await api.post<Preview>("/import/excel/preview", fd);
      setPreview(data);
      // Keep the user's override if they supplied one; else use auto-detected.
      setMapping(override ?? data.autoMapping);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { data } = await api.post("/import/excel/commit", {
        fileName: file?.name ?? "upload.xlsx",
        cardId: cardId ? Number(cardId) : undefined,
        userId: userId ? Number(userId) : undefined,
        mapping,
        rows: preview.rows.filter((r) => !r.duplicate && r.errors.length === 0),
      });
      setResult(
        `가져오기 완료 — 추가 ${data.imported} · 중복 ${data.duplicates} · 오류 ${data.errors}`,
      );
      setPreview(null);
      setFile(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">데이터 가져오기 / Import</h1>
        <p className="text-sm text-slate-500">
          Excel(.xls/.xlsx/.csv) · PDF · 영수증 이미지 — Phase 1: Excel
        </p>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button onClick={() => doPreview()} disabled={!file || busy}>
              미리보기 / Preview
            </Button>
            <span className="text-xs text-slate-400">
              PDF / 이미지 OCR은 Phase 2 (서비스 인터페이스 구현됨)
            </span>
          </div>
          {result && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              {result}{" "}
              <button
                onClick={() => navigate("/transactions")}
                className="ml-2 font-medium underline"
              >
                거래내역 보기 →
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {busy && !preview && <Spinner />}

      {preview && (
        <>
          <Card>
            <CardBody>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  컬럼 매핑 / Column mapping{" "}
                  <span className="text-xs font-normal text-slate-400">
                    (자동 인식 실패 시 수동 지정)
                  </span>
                </h2>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => doPreview(mapping)}
                >
                  이 매핑으로 다시 분석 / Re-parse
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {preview.headers.map((h) => (
                  <div key={h}>
                    <Label>{h}</Label>
                    <Select
                      value={mapping[h] ?? ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [h]: e.target.value || null })
                      }
                    >
                      <option value="">— 무시 —</option>
                      {FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Badge className="bg-sky-100 text-sky-700">전체 {preview.summary.total}</Badge>
                <Badge className="bg-emerald-100 text-emerald-700">
                  유효 {preview.summary.valid}
                </Badge>
                <Badge className="bg-rose-100 text-rose-700">
                  오류 {preview.summary.invalid}
                </Badge>
                <Badge className="bg-amber-100 text-amber-700">
                  중복 {preview.summary.duplicates}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <Label>카드 배정 · Card</Label>
                  <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
                    <option value="">선택</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cardNumberMasked}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>사용자 · User</Label>
                  <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                    <option value="">카드 소유자 자동</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={commit} disabled={busy}>
                    저장 / Save {preview.summary.valid - preview.summary.duplicates} 건
                  </Button>
                </div>
              </div>

              <div className="max-h-96 overflow-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-400">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">일자</th>
                      <th className="p-2">가맹점</th>
                      <th className="p-2 text-right">금액</th>
                      <th className="p-2">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr
                        key={r.rowIndex}
                        className={`border-t border-slate-100 ${
                          r.errors.length
                            ? "bg-rose-50"
                            : r.duplicate
                              ? "bg-amber-50"
                              : ""
                        }`}
                      >
                        <td className="p-2 text-slate-400">{r.rowIndex}</td>
                        <td className="p-2">{r.transactionDate ?? "-"}</td>
                        <td className="p-2">{r.merchantName || "-"}</td>
                        <td className="p-2 text-right">{won(r.amount)}</td>
                        <td className="p-2">
                          {r.errors.length ? (
                            <span className="text-rose-600">{r.errors.join(", ")}</span>
                          ) : r.duplicate ? (
                            <span className="text-amber-600">중복 / duplicate</span>
                          ) : (
                            <span className="text-emerald-600">OK</span>
                          )}
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
