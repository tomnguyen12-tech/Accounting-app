import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError(err.message ?? "Login failed");
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
            <p className="text-sm text-slate-500">AI 법인카드 경비 관리 · 데모 로그인</p>
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
            <Button className="w-full" disabled={busy || !email}>
              {busy ? "처리 중…" : "로그인 / Sign in"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
