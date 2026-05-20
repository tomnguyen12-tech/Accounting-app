import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import { Badge, Button, Card, CardBody, Input, Label, Select, Spinner } from "@/components/ui";
import { fmtDate, num } from "@/lib/format";
import type { CardRow, ImportJob, UserRow } from "@/types";

/**
 * Import jobs roster — every uploaded file as a row. Each job links back to
 * the user/owner, optional card, period and counts; click to drill into the
 * transactions that this file produced.
 */
export default function ImportJobs() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [filters, setFilters] = useState({
    userId: "",
    cardId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [applied, setApplied] = useState(filters);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.listUsers().then((r) => setUsers(r.users));
  }, []);

  useEffect(() => {
    setCards([]);
    setFilters((f) => ({ ...f, cardId: "" }));
    if (!filters.userId) return;
    db.listCards({ userId: filters.userId }).then((r) => setCards(r.cards));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.userId]);

  const args = useMemo(
    () => ({
      userId: applied.userId || undefined,
      cardId: applied.cardId ? Number(applied.cardId) : undefined,
      dateFrom: applied.dateFrom || undefined,
      dateTo: applied.dateTo || undefined,
    }),
    [applied],
  );

  useEffect(() => {
    setLoading(true);
    db.listImportJobs(args)
      .then((r) => setJobs(r.jobs))
      .finally(() => setLoading(false));
  }, [args]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Jobs / 업로드 이력</h1>
        <p className="text-sm text-slate-500">
          Mỗi file đã upload tạo 1 job — gắn rõ owner, card, kỳ, số dòng thành công/thất bại.
        </p>
      </div>

      <Card>
        <CardBody className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <Label>User</Label>
            <Select
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Card</Label>
            <Select
              value={filters.cardId}
              onChange={(e) => setFilters({ ...filters, cardId: e.target.value })}
              disabled={!filters.userId}
            >
              <option value="">All cards</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cardNumberMasked}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Uploaded from</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div>
            <Label>Uploaded to</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button className="flex-1" onClick={() => setApplied(filters)}>
              Apply
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const empty = { userId: "", cardId: "", dateFrom: "", dateTo: "" };
                setFilters(empty);
                setApplied(empty);
              }}
            >
              Reset
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {loading ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-400">
                  <tr>
                    <th className="pb-2">#</th>
                    <th className="pb-2">File</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Owner</th>
                    <th className="pb-2">Card</th>
                    <th className="pb-2">Period</th>
                    <th className="pb-2 text-right">Total / OK / Fail</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr
                      key={j.id}
                      onClick={() => navigate(`/transactions?importJobId=${j.id}`)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-2.5 text-slate-400">#{j.id}</td>
                      <td className="py-2.5 font-medium">{j.originalName}</td>
                      <td className="py-2.5">{j.type}</td>
                      <td className="py-2.5">{j.user?.name ?? "-"}</td>
                      <td className="py-2.5 font-mono text-xs">
                        {j.card?.cardNumberMasked ?? "-"}
                      </td>
                      <td className="py-2.5 text-xs">
                        {j.importMonth
                          ? j.importMonth
                          : j.dateFrom || j.dateTo
                            ? `${fmtDate(j.dateFrom)} ~ ${fmtDate(j.dateTo)}`
                            : "-"}
                      </td>
                      <td className="py-2.5 text-right">
                        {num(j.totalRows)} /{" "}
                        <span className="text-emerald-600">{num(j.successCount)}</span> /{" "}
                        <span className="text-rose-600">{num(j.failedCount)}</span>
                      </td>
                      <td className="py-2.5">
                        <Badge className="bg-slate-100 text-slate-600">{j.status}</Badge>
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">{fmtDate(j.createdAt)}</td>
                    </tr>
                  ))}
                  {!jobs.length && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Chưa có import job nào — upload từ trang <b>Import</b> để tạo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
