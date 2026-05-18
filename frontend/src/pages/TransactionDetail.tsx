import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { won, fmtDate, STATUS_STYLES } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Spinner,
} from "@/components/ui";
import type { Transaction } from "@/types";

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [purpose, setPurpose] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const canReview = user?.role === "ADMIN" || user?.role === "ACCOUNTANT";

  const load = () =>
    db.getTransaction(Number(id)).then((r) => {
      const t: Transaction = r.transaction;
      setTx(t);
      setPurpose(t.purpose);
      setMemo(t.memo);
      setCategory(t.category ?? "기타");
    });

  useEffect(() => {
    load();
  }, [id]);

  if (!tx) return <Spinner />;

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await db.updateTransaction(Number(id), { purpose, memo, category }, user?.id);
      await load();
      setMsg("저장되었습니다 / Saved");
    } catch (e: any) {
      setMsg(e.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const review = async (action: string) => {
    setBusy(true);
    setMsg("");
    try {
      await db.reviewTransaction(Number(id), action as any, user?.id);
      await load();
    } catch (e: any) {
      setMsg(e.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-slate-500 hover:text-brand-600"
      >
        ← 목록으로 / Back
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tx.merchantName}</h1>
          <p className="text-sm text-slate-500">
            {fmtDate(tx.transactionDate)} · {tx.cardNumberMasked}
          </p>
        </div>
        <Badge className={STATUS_STYLES[tx.status]}>{tx.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="금액 / Amount" value={<b>{won(tx.amount)}</b>} />
            <Field label="부가세 / VAT" value={won(tx.vatAmount)} />
            <Field label="할인 / Discount" value={won(tx.discountAmount)} />
            <Field label="거래일 / Date" value={fmtDate(tx.transactionDate)} />
            <Field label="승인일 / Approval" value={fmtDate(tx.approvalDate)} />
            <Field label="결제일 / Payment" value={fmtDate(tx.paymentDate)} />
            <Field label="승인번호" value={tx.approvalNumber ?? "-"} />
            <Field label="가맹점번호" value={tx.merchantNumber ?? "-"} />
            <Field label="소스 / Source" value={tx.sourceType} />
            <Field label="사용자" value={tx.user?.name ?? "-"} />
            <Field label="부서" value={tx.department?.name ?? "-"} />
            <Field
              label="AI 신뢰도"
              value={
                tx.confidenceScore != null
                  ? `${Math.round(tx.confidenceScore * 100)}%`
                  : "-"
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                사용목적 입력 / Purpose
              </h3>
              <p className="text-xs text-slate-400">
                AI가 카테고리를 제안합니다. 사용목적은 사용자가 직접 입력해야 합니다.
              </p>
            </div>
            <div>
              <Label>카테고리 (AI 제안) · Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>
                사용목적 · Purpose <span className="text-rose-500">*필수</span>
              </Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="예: 영업팀 거래처 미팅 식사"
              />
            </div>
            <div>
              <Label>메모 · Memo (선택)</Label>
              <Input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="추가 설명"
              />
            </div>
            <Button onClick={save} disabled={busy} className="w-full">
              저장 / Save
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !purpose.trim()}
              onClick={() => review("SUBMIT")}
              className="w-full"
            >
              제출 / Submit for approval
            </Button>
            {!purpose.trim() && (
              <p className="text-xs text-rose-500">제출하려면 사용목적이 필요합니다.</p>
            )}

            {canReview && (
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <p className="text-xs font-medium text-slate-500">
                  검토 (회계/관리자) / Review
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="primary" disabled={busy} onClick={() => review("APPROVE")}>
                    승인
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => review("REJECT")}>
                    반려
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => review("REQUEST_REVISION")}
                  >
                    수정요청
                  </Button>
                </div>
              </div>
            )}
            {msg && <p className="text-center text-sm text-brand-600">{msg}</p>}
          </CardBody>
        </Card>
      </div>

      {!!tx.reviewLogs?.length && (
        <Card>
          <CardBody>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              검토 이력 / Review log
            </h3>
            <ul className="space-y-2 text-sm">
              {tx.reviewLogs.map((l) => (
                <li key={l.id} className="flex justify-between border-b border-slate-100 pb-2">
                  <span>
                    <b>{l.action}</b> {l.fromStatus} → {l.toStatus}{" "}
                    {l.comment && <span className="text-slate-400">· {l.comment}</span>}
                  </span>
                  <span className="text-slate-400">
                    {l.reviewer?.name} · {fmtDate(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
