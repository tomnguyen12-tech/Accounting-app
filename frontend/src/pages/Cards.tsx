import { FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/db";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Spinner,
} from "@/components/ui";
import type { CardRow } from "@/types";

type FormState = {
  cardNumber: string;
  issuer: string;
  holderName: string;
  holderEmail: string;
  departmentName: string;
};

const EMPTY: FormState = {
  cardNumber: "",
  issuer: "",
  holderName: "",
  holderEmail: "",
  departmentName: "",
};

export default function CardsPage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    db.listCards()
      .then((r) => setCards(r.cards))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startEdit = (c: CardRow) => {
    setEditingId(c.id);
    setForm({
      cardNumber: c.cardNumberMasked, // shown as-is; user can keep or replace
      issuer: c.issuer ?? "",
      holderName: c.holder?.name ?? "",
      holderEmail: "",                 // unknown from list payload; user retypes only if changing
      departmentName: c.department?.name ?? "",
    });
    setErr("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY });
    setErr("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (editingId) {
        // On edit, only send fields that look intentional. Skip cardNumber if
        // unchanged (still in masked format like "4835-****-****-7498").
        const looksMasked = form.cardNumber.includes("*");
        await db.updateCard(editingId, {
          cardNumber: looksMasked ? undefined : form.cardNumber,
          issuer: form.issuer,
          holderName: form.holderName,
          holderEmail: form.holderEmail || undefined,
          departmentName: form.departmentName,
        });
      } else {
        if (!form.cardNumber.trim()) throw new Error("Card number is required");
        if (!form.holderName.trim() && !form.holderEmail.trim())
          throw new Error("Holder name hoặc email là bắt buộc");
        await db.createCard({
          cardNumber: form.cardNumber,
          issuer: form.issuer || undefined,
          holderName: form.holderName || undefined,
          holderEmail: form.holderEmail || undefined,
          departmentName: form.departmentName || undefined,
        });
      }
      setForm({ ...EMPTY });
      setEditingId(null);
      load();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: CardRow) => {
    const ok = window.confirm(
      `Xoá thẻ ${c.cardNumberMasked}?\nMọi giao dịch/import job liên quan sẽ bị gỡ liên kết (card_id = null), không bị xoá.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await db.deleteCard(c.id);
      if (editingId === c.id) cancelEdit();
      load();
    } catch (e: any) {
      alert(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">법인카드 관리 / Corporate Cards</h1>
        <p className="text-sm text-slate-500">
          Mọi thông tin nhập tay. Nhân viên/phòng ban chưa tồn tại sẽ được tự tạo.
        </p>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            {editingId ? `Edit card #${editingId}` : "Add card"}
          </h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <Label>Card number *</Label>
              <Input
                placeholder="4835000000007498"
                value={form.cardNumber}
                onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>Issuer</Label>
              <Input
                placeholder="Shinhan / Hyundai / …"
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              />
            </div>
            <div>
              <Label>Holder name *</Label>
              <Input
                placeholder="Tên nhân viên (tự tạo nếu chưa có)"
                value={form.holderName}
                onChange={(e) => setForm({ ...form, holderName: e.target.value })}
              />
            </div>
            <div>
              <Label>Holder email</Label>
              <Input
                placeholder="dùng để đăng nhập (auto nếu để trống)"
                value={form.holderEmail}
                onChange={(e) => setForm({ ...form, holderEmail: e.target.value })}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                placeholder="Sales / Engineering / …"
                value={form.departmentName}
                onChange={(e) => setForm({ ...form, departmentName: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-5">
              <Button disabled={busy}>{editingId ? "Save changes" : "Add card"}</Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
              {err && <span className="ml-3 text-sm text-rose-600">{err}</span>}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {loading ? (
            <Spinner />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr>
                  <th className="pb-2">Card number</th>
                  <th className="pb-2">Issuer</th>
                  <th className="pb-2">Holder</th>
                  <th className="pb-2">Department</th>
                  <th className="pb-2 text-right">Transactions</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2.5 font-mono">{c.cardNumberMasked}</td>
                    <td className="py-2.5">{c.issuer ?? "-"}</td>
                    <td className="py-2.5">{c.holder?.name ?? "-"}</td>
                    <td className="py-2.5">{c.department?.name ?? "-"}</td>
                    <td className="py-2.5 text-right">{c._count.transactions}</td>
                    <td className="py-2.5">
                      <Badge
                        className={
                          c.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }
                      >
                        {c.active ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => startEdit(c)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        onClick={() => remove(c)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {!cards.length && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Chưa có thẻ — thêm thẻ ở form bên trên.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
