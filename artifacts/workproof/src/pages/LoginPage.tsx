import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogin } from "@workspace/api-client-react";
import { Shield } from "lucide-react";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user as any);
        navigate("/dashboard");
      },
      onError: (err: any) => {
        setError(err?.data?.error ?? "Invalid credentials");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,8%)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[hsl(186,100%,42%)] flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide">WorkLens</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-1">Tamper-proof workforce platform</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,17%)] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] focus:ring-1 focus:ring-[hsl(186,100%,42%)/30%] transition-colors"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] focus:ring-1 focus:ring-[hsl(186,100%,42%)/30%] transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-xs text-[hsl(215,20%,55%)]">
            No account?{" "}
            <a href="/register" className="text-[hsl(186,100%,42%)] hover:underline">Register organization</a>
          </p>
        </form>
      </div>
    </div>
  );
}
