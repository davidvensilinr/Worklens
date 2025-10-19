import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useRegister } from "@workspace/api-client-react";
import { Shield } from "lucide-react";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ organizationName: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user as any);
        navigate("/dashboard");
      },
      onError: (err: any) => {
        setError(err?.data?.error ?? "Registration failed");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    registerMutation.mutate({ data: form });
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,8%)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[hsl(186,100%,42%)] flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide">Create Organization</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-1">Set up your WorkLens workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,17%)] rounded-xl p-6 space-y-4">
          {[
            { key: "organizationName", label: "Organization Name", type: "text", placeholder: "Acme Corp" },
            { key: "name", label: "Your Full Name", type: "text", placeholder: "Jane Smith" },
            { key: "email", label: "Work Email", type: "email", placeholder: "jane@company.com" },
            { key: "password", label: "Password", type: "password", placeholder: "••••••••" },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required
                className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] focus:ring-1 focus:ring-[hsl(186,100%,42%)/30%] transition-colors"
                placeholder={placeholder}
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {registerMutation.isPending ? "Creating..." : "Create Organization"}
          </button>

          <p className="text-center text-xs text-[hsl(215,20%,55%)]">
            Already have an account?{" "}
            <a href="/login" className="text-[hsl(186,100%,42%)] hover:underline">Sign in</a>
          </p>
        </form>
      </div>
    </div>
  );
}
