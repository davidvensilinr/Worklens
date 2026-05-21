import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { KeyRound } from "lucide-react";

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const { user, token, login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${apiUrl}/api/v1/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to change password");
        return;
      }

      // Update user state to reflect password changed
      if (user) {
        login(token!, { ...user, mustChangePassword: false } as any);
      }

      navigate("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,8%)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide">Change Password</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-1 text-center">
            You must change your default password before continuing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,17%)] rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] focus:ring-1 focus:ring-[hsl(186,100%,42%)/30%] transition-colors"
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] focus:ring-1 focus:ring-[hsl(186,100%,42%)/30%] transition-colors"
              placeholder="Enter new password (min 6 chars)"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[hsl(215,20%,65%)] mb-1.5 uppercase tracking-wide">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] focus:ring-1 focus:ring-[hsl(186,100%,42%)/30%] transition-colors"
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] disabled:opacity-50 text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? "Changing..." : "Change Password"}
          </button>

          <p className="text-center text-[10px] text-[hsl(215,20%,45%)]">
            Your default password was <span className="font-mono text-[hsl(215,20%,55%)]">Welcome@123</span>
          </p>
        </form>
      </div>
    </div>
  );
}
