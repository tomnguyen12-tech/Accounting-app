import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, CardBody, Input, Label, Select, Spinner } from "@/components/ui";
import type { Department, UserRow } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
    departmentId: "",
  });
  const [err, setErr] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([api.get("/users"), api.get("/departments")])
      .then(([u, d]) => {
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
      await api.post("/users", {
        ...form,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      });
      setForm({ name: "", email: "", password: "", role: "USER", departmentId: "" });
      load();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사용자 관리 / Users</h1>
        <p className="text-sm text-slate-500">관리자가 사용자를 생성하고 카드를 배정합니다</p>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">사용자 추가 / Add user</h2>
          <form onSubmit={create} className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div>
              <Label>이름</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>이메일</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>비밀번호</Label>
              <Input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>역할</Label>
              <Select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="USER">USER</option>
                <option value="ACCOUNTANT">ACCOUNTANT</option>
                <option value="ADMIN">ADMIN</option>
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
            <div className="col-span-2 flex items-end md:col-span-5">
              <Button>추가 / Create</Button>
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
                  <th className="pb-2">이름</th>
                  <th className="pb-2">이메일</th>
                  <th className="pb-2">역할</th>
                  <th className="pb-2">부서</th>
                  <th className="pb-2 text-right">카드</th>
                  <th className="pb-2 text-right">거래</th>
                  <th className="pb-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-2.5 font-medium">{u.name}</td>
                    <td className="py-2.5 text-slate-500">{u.email}</td>
                    <td className="py-2.5">{u.role}</td>
                    <td className="py-2.5">{u.department?.name ?? "-"}</td>
                    <td className="py-2.5 text-right">{u._count.cards}</td>
                    <td className="py-2.5 text-right">{u._count.transactions}</td>
                    <td className="py-2.5">
                      <Badge
                        className={
                          u.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }
                      >
                        {u.active ? "active" : "inactive"}
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
