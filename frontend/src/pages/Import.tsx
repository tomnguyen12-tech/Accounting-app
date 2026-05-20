import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { dedupeKey, parseWorkbook, ParsedRow } from "@/lib/excel";
import { won, fmtDate } from "@/lib/format";
import { Badge, Button, Card, CardBody, Input, Label, Select, Spinner } from "@/components/ui";
import type { CardRow, UserRow } from "@/types";

type PreviewRow = ParsedRow & { duplicate: boolean };
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

function StepHeader({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">
        {n}
      </span>
      <span className="font-semibold text-slate-800">{title}</span>
      {hint && <span className="text-xs text-slate-400">— {hint}</span>}
    </div>
  );
}

export default function ImportPage() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Step state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [userId, setUserId] = useState("");                  // Step 1 — required
  const [cardId, setCardId] = useState("");                  // Step 2 — optional (Auto)
  const [periodType, setPeriodType] = useState<"month" | "range" | "auto">("auto"); // Step 3
  const [month, setMonth] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [file, setFile] = useState<File | null>(null);        // Step 4
  const [preview, setPreview] = useState<Preview | null>(null); // Step 5
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ jobId: number | null; imported: number; duplicates: number; errors: number } | null>(null);

  // Step 1 lists ONLY employees who already hold a card (assigned in Corporate
  // Cards). This makes the import flow's owner choice consistent with the
  // card→employee mapping rather than the full user roster.
  useEffect(() => {
    db.listCardHolders().then((r) => setUsers(r.users));
  }, []);

  // Step 2: when user changes, reload that user's cards and reset card pick.
  useEffect(() => {
    if (!userId) {
      setCards([]);
      setCardId("");
      return;
    }
    setCardId("");
    db.listCards({ userId }).then((r) => setCards(r.cards));
  }, [userId]);

  const detectedPeriod = (() => {
    if (!preview) return null;
    const dates = preview.rows.map((r) => r.transactionDate).filter((d): d is string => !!d).sort();
    if (!dates.length) return null;
    return { from: dates[0], to: dates[dates.length - 1] };
  })();

  const doPreview = async (override?: Record<string, string | null>) => {
    if (!file || !userId) return;
    setBusy(true);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer, override as any);
      const dup = await db.excelDuplicates(parsed.rows);
      const rows: PreviewRow[] = parsed.rows.map((r) => ({
        ...r,
        duplicate: r.errors.length === 0 && dup.has(dedupeKey(r)),
      }));
      setPreview({
        headers: parsed.headers,
        autoMapping: parsed.autoMapping,
        rows,
        summary: {
          total: rows.length,
          valid: rows.filter((r) => r.errors.length === 0).length,
          invalid: rows.filter((r) => r.errors.length > 0).length,
          duplicates: rows.filter((r) => r.duplicate).length,
        },
      });
      setMapping(override ?? (parsed.autoMapping as Record<string, string | null>));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview || !userId) return;
    setBusy(true);
    try {
      const period =
        periodType === "month"
          ? { importMonth: month || null, dateFrom: null, dateTo: null }
          : periodType === "range"
            ? { importMonth: null, dateFrom: dateFrom || null, dateTo: dateTo || null }
            : { importMonth: null, dateFrom: null, dateTo: null };
      const res = await db.commitExcel({
        fileName: file?.name ?? "upload.xlsx",
        userId,
        cardId: cardId ? Number(cardId) : null,
        ...period,
        createdById: me?.id,
        rows: preview.rows.filter((r) => !r.duplicate && r.errors.length === 0),
      });
      setResult(res);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  };

  const selectedUser = users.find((u) => u.id === userId);
  const selectedCard = cards.find((c) => c.id === Number(cardId));
  const canPreview = !!userId && !!file;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">데이터 가져오기 / Import</h1>
        <p className="text-sm text-slate-500">
          Mọi giao dịch sẽ được gán cho user đã chọn. Card tuỳ chọn (lọc theo user).
        </p>
      </div>

      <Card>
        <CardBody className="space-y-5">
          <div>
            <StepHeader
              n={1}
              title="Employee (card holder)"
              hint="bắt buộc — chỉ nhân viên đang giữ thẻ trong Corporate Cards"
            />
            <div className="mt-2">
              <Select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={!userId ? "border-rose-200" : ""}
                disabled={!users.length}
              >
                <option value="">— Chọn nhân viên (bắt buộc) —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </option>
                ))}
              </Select>
              {!users.length && (
                <p className="mt-1 text-xs text-rose-500">
                  Chưa có nhân viên nào được gắn thẻ. Vào <b>Corporate Cards</b> tạo thẻ +
                  gán nhân viên trước.
                </p>
              )}
            </div>
          </div>

          <div>
            <StepHeader
              n={2}
              title="Payment Card"
              hint={userId ? "tuỳ chọn — chỉ thẻ của user này" : "chọn user trước"}
            />
            <div className="mt-2">
              <Select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                disabled={!userId}
              >
                <option value="">No card / Auto detect from file</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cardNumberMasked} {c.issuer ? `· ${c.issuer}` : ""}
                  </option>
                ))}
              </Select>
              {userId && !cards.length && (
                <p className="mt-1 text-xs text-slate-400">
                  User này chưa có thẻ — sẽ thử dò card_number từ file, hoặc lưu card_id = null.
                </p>
              )}
            </div>
          </div>

          <div>
            <StepHeader n={3} title="Period" hint="tuỳ chọn — bỏ trống = tự suy từ ngày trong file" />
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div>
                <Label>Loại</Label>
                <Select value={periodType} onChange={(e) => setPeriodType(e.target.value as any)}>
                  <option value="auto">Auto (suy từ file)</option>
                  <option value="month">Monthly</option>
                  <option value="range">Custom date range</option>
                </Select>
              </div>
              {periodType === "month" && (
                <div>
                  <Label>Import month</Label>
                  <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
              )}
              {periodType === "range" && (
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
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <StepHeader n={4} title="Upload file" hint=".xls / .xlsx / .csv  (PDF/이미지: Phase 2)" />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xls,.xlsx,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={!userId}
                className="text-sm"
              />
              <Button onClick={() => doPreview()} disabled={!canPreview || busy}>
                Step 5 — 미리보기 / Preview
              </Button>
              {!userId && (
                <span className="text-xs text-rose-500">Phải chọn user ở Step 1 trước.</span>
              )}
            </div>
          </div>

          {result && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              Hoàn tất — import job <b>#{result.jobId ?? "?"}</b> · thêm{" "}
              <b>{result.imported}</b> · trùng <b>{result.duplicates}</b> · lỗi{" "}
              <b>{result.errors}</b>.
              <button
                onClick={() =>
                  navigate(
                    `/transactions?${result.jobId ? `importJobId=${result.jobId}&` : ""}userId=${userId}`,
                  )
                }
                className="ml-2 font-medium underline"
              >
                Xem giao dịch →
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
                <Button variant="secondary" disabled={busy} onClick={() => doPreview(mapping)}>
                  이 매핑으로 다시 분석 / Re-parse
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {preview.headers.map((h) => (
                  <div key={h}>
                    <Label>{h}</Label>
                    <Select
                      value={mapping[h] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [h]: e.target.value || null })}
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
              <StepHeader n={5} title="Preview" hint="kiểm tra dữ liệu trước khi xác nhận" />
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Detected user</p>
                  <p className="font-medium">{selectedUser?.name ?? "-"}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Detected card</p>
                  <p className="font-medium">
                    {selectedCard
                      ? selectedCard.cardNumberMasked
                      : preview.rows[0]?.cardNumberMasked
                        ? `${preview.rows[0]?.cardNumberMasked} (từ file)`
                        : "Auto / null"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Detected period</p>
                  <p className="font-medium">
                    {periodType === "month" && month
                      ? month
                      : periodType === "range" && (dateFrom || dateTo)
                        ? `${fmtDate(dateFrom)} ~ ${fmtDate(dateTo)}`
                        : detectedPeriod
                          ? `${fmtDate(detectedPeriod.from)} ~ ${fmtDate(detectedPeriod.to)}`
                          : "-"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge className="bg-sky-100 text-sky-700">전체 {preview.summary.total}</Badge>
                <Badge className="bg-emerald-100 text-emerald-700">
                  유효 {preview.summary.valid}
                </Badge>
                <Badge className="bg-rose-100 text-rose-700">오류 {preview.summary.invalid}</Badge>
                <Badge className="bg-amber-100 text-amber-700">
                  중복 {preview.summary.duplicates}
                </Badge>
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
                          r.errors.length ? "bg-rose-50" : r.duplicate ? "bg-amber-50" : ""
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

              <div>
                <StepHeader n={6} title="Confirm import" />
                <div className="mt-2">
                  <Button onClick={commit} disabled={busy || !userId}>
                    저장 / Confirm — {preview.summary.valid - preview.summary.duplicates} 건 vào{" "}
                    <b>{selectedUser?.name ?? "?"}</b>
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
