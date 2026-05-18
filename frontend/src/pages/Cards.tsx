import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, Input, Label, Select, Spinner } from "@/components/ui";
import type { CardRow, Department, UserRow } from "@/types";

export default function CardsPage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    cardNumber: "",
    issuer: "",
    holderUserId: "",
    departmentId: "",
  });
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/cards"), api.get("/users"), api.get("/departments")])
      .then(([c, u, d]) => {
        setCards(c.data.cards);
        setUsers(u.data.users);
        setDepts(d.data.departments);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/cards", {
        cardNumber: form.cardNumber,
        issuer: form.issuer || undefined,
        holderUserId: form.holderUserId ? Number(form.holderUserId) : null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      });
      setForm({ cardNumber: "", issuer: "", holderUserId: "", departmentId: "" });
      load();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? "Failed");
    }
  };

  const assign = async (cardId: number, holderUserId: string) => {
    await api.put(`/cards/${cardId}`, {
      holderUserId: holderUserId ? Number(holderUserId) : null,
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">법인카드 관리 / Corporate Cards</h1>
        <p className="text-sm text-slate-500">카드 등록 및 사용자 배정</p>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">카드 추가 / Add card</h2>
          <form onSubmit={create} className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <Label>카드번호</Label>
              <Input
                placeholder="4835000000007498"
                value={form.cardNumber}
                onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>발급사</Label>
              <Input
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              />
            </div>
            <div>
              <Label>소유자</Label>
              <Select
                value={form.holderUserId}
                onChange={(e) => setForm({ ...form, holderUserId: e.target.value })}
              >
                <option value="">-</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>부서</Label>
              <Select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">-</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button>추가</Button>
            </div>
          </form>
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
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
                  <th className="pb-2">카드번호</th>
                  <th className="pb-2">발급사</th>
                  <th className="pb-2">소유자 배정</th>
                  <th className="pb-2">부서</th>
                  <th className="pb-2 text-right">거래</th>
                  <th className="pb-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2.5 font-mono">{c.cardNumberMasked}</td>
                    <td className="py-2.5">{c.issuer ?? "-"}</td>
                    <td className="py-2.5">
                      <Select
                        className="w-40"
                        value={c.holder?.id ?? ""}
                        onChange={(e) => assign(c.id, e.target.value)}
                      >
                        <option value="">미배정</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </Select>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
