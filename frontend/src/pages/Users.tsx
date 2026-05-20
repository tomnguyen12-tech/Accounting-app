import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { Badge, Card, CardBody, Spinner } from "@/components/ui";
import type { UserRow } from "@/types";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.listUsers()
      .then((r) => setUsers(r.users))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사용자 관리 / Users</h1>
        <p className="text-sm text-slate-500">
          데모 모드 — 사용자는 schema.sql 시드로 생성됩니다 (인증/이메일 없음)
        </p>
      </div>

      <Card>
        <CardBody className="text-sm text-slate-600">
          <p className="font-medium text-slate-700">계정 생성 / Creating accounts</p>
          <p className="mt-1">
            인증은 데모 모드입니다 — 새 사용자는 SQL Editor 또는{" "}
            <code>supabase/schema.sql</code>의 seed 블록을 통해 추가하세요. 비밀번호는
            검증되지 않으며, 이메일이 <code>users</code> 테이블에 존재하면 로그인됩니다.
          </p>
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
                {!users.length && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      아직 가입한 사용자가 없습니다. 로그인 화면에서 가입하세요.
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
