import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

const DEMO = [
  { role: "Admin", email: "admin@demo.io", pw: "admin123" },
  { role: "Accountant", email: "acct@demo.io", pw: "acct123" },
  { role: "User · Kevin", email: "kevin@demo.io", pw: "kevin123" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("kevin@demo.io");
  const [password, setPassword] = useState("kevin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 to-teal-50 px-4">
      <Card className="w-full max-w-md">
        <CardBody className="p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-500 text-xl font-bold text-white">
              E
            </div>
            <h1 className="text-xl font-bold">Expense Assistant</h1>
            <p className="text-sm text-slate-500">AI 법인카드 경비 관리 · 로그인</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>이메일 / Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div>
              <Label>비밀번호 / Password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button className="w-full" disabled={busy}>
              {busy ? "로그인 중…" : "로그인 / Sign in"}
            </Button>
          </form>
          <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            <p className="mb-1 font-medium text-slate-600">Demo accounts</p>
            {DEMO.map((d) => (
              <button
                key={d.email}
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.pw);
                }}
                className="block w-full text-left hover:text-brand-600"
              >
                {d.role} — {d.email} / {d.pw}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
