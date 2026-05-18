import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, Input, Label, Select, Spinner } from "@/components/ui";

interface Rule {
  id: number;
  keyword: string;
  category: string;
  priority: number;
  active: boolean;
}

export default function Settings() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ keyword: "", category: "기타", priority: 50 });

  const load = () => {
    setLoading(true);
    api
      .get("/category-rules")
      .then((r) => {
        setRules(r.data.rules);
        setCategories(r.data.categories);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    await api.post("/category-rules", form);
    setForm({ keyword: "", category: "기타", priority: 50 });
    load();
  };

  const toggle = async (rule: Rule) => {
    await api.put(`/category-rules/${rule.id}`, { active: !rule.active });
    load();
  };

  const remove = async (id: number) => {
    await api.delete(`/category-rules/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">분류 규칙 / Category Rules</h1>
        <p className="text-sm text-slate-500">
          가맹점명 키워드 → 카테고리 자동 분류 규칙 (우선순위 낮을수록 먼저 적용)
        </p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={add} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <Label>키워드</Label>
              <Input
                placeholder="예: 스타벅스"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>카테고리</Label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} · {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>우선순위</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end">
              <Button>규칙 추가</Button>
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
                  <th className="pb-2">키워드</th>
                  <th className="pb-2">카테고리</th>
                  <th className="pb-2 text-right">우선순위</th>
                  <th className="pb-2">상태</th>
                  <th className="pb-2 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{r.keyword}</td>
                    <td className="py-2">{r.category}</td>
                    <td className="py-2 text-right">{r.priority}</td>
                    <td className="py-2">
                      <button onClick={() => toggle(r)}>
                        <Badge
                          className={
                            r.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }
                        >
                          {r.active ? "active" : "off"}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => remove(r.id)}
                        className="text-xs text-rose-500 hover:underline"
                      >
                        삭제
                      </button>
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
