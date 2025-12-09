import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  CalendarDays, Plus, X, ChevronDown, CheckCircle2,
  XCircle, Clock, AlertTriangle, Loader2, User, Building2
} from "lucide-react";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave", icon: "🏖️" },
  { value: "sick", label: "Sick Leave", icon: "🤒" },
  { value: "emergency", label: "Emergency", icon: "⚠️" },
  { value: "unpaid", label: "Unpaid Leave", icon: "💸" },
  { value: "other", label: "Other", icon: "📋" },
];

function leaveTypeLabel(type: string) {
  return LEAVE_TYPES.find(t => t.value === type) ?? { label: type, icon: "📋" };
}

function daysCount(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

type StatusKey = "pending" | "manager_approved" | "approved" | "rejected";
const STATUS_CONFIG: Record<StatusKey, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20", icon: <Clock className="w-3 h-3" /> },
  manager_approved: { label: "Mgr Approved", color: "text-blue-300 bg-blue-400/10 border-blue-400/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  approved: { label: "Approved", color: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "Rejected", color: "text-red-300 bg-red-400/10 border-red-400/20", icon: <XCircle className="w-3 h-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as StatusKey] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 font-medium ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function ApprovalLeg({ label, status, approverName, approvedAt, note }: {
  label: string; status: string; approverName?: string | null; approvedAt?: string | null; note?: string | null;
}) {
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  return (
    <div className={`rounded-lg border p-3 ${isApproved ? "border-emerald-400/20 bg-emerald-400/5" : isRejected ? "border-red-400/20 bg-red-400/5" : "border-[hsl(217,32%,22%)] bg-[hsl(217,32%,15%)]"}`}>
      <div className="flex items-center gap-2 mb-1">
        {isApproved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : isRejected ? <XCircle className="w-3.5 h-3.5 text-red-400" /> : <Clock className="w-3.5 h-3.5 text-yellow-400" />}
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className={`text-[10px] ${isApproved ? "text-emerald-400" : isRejected ? "text-red-400" : "text-yellow-400"}`}>
          {isApproved ? "Approved" : isRejected ? "Rejected" : "Pending"}
        </span>
      </div>
      {approverName && <p className="text-[10px] text-[hsl(215,20%,55%)]">by {approverName}{approvedAt ? ` · ${new Date(approvedAt).toLocaleDateString()}` : ""}</p>}
      {note && <p className="text-[10px] text-[hsl(215,20%,65%)] mt-1 italic">"{note}"</p>}
    </div>
  );
}

export default function LeavesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const role = user?.role ?? "employee";

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionState, setActionState] = useState<{ id: number; type: string } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [isActing, setIsActing] = useState(false);

  const [form, setForm] = useState({
    leaveType: "annual",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const res = await customFetch("/api/v1/leaves") as Response;
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await customFetch("/api/v1/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }) as Response;
      if (!res.ok) { const err = await res.json(); alert((err as any).error ?? "Failed"); return; }
      qc.invalidateQueries({ queryKey: ["leaves"] });
      setShowCreate(false);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const performAction = async (id: number, endpoint: string) => {
    setIsActing(true);
    try {
      const res = await customFetch(`/api/v1/leaves/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: actionNote }),
      }) as Response;
      if (!res.ok) { const err = await res.json(); alert((err as any).error ?? "Action failed"); return; }
      qc.invalidateQueries({ queryKey: ["leaves"] });
      setActionState(null);
      setActionNote("");
    } finally {
      setIsActing(false);
    }
  };

  const isManager = ["manager", "hr_admin", "super_admin"].includes(role);
  const isHR = ["hr_admin", "super_admin"].includes(role);

  const stats = {
    pending: (leaves as any[]).filter((l: any) => l.status === "pending").length,
    approved: (leaves as any[]).filter((l: any) => l.status === "approved").length,
    rejected: (leaves as any[]).filter((l: any) => l.status === "rejected").length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[hsl(186,100%,42%)]" />
            Leave Requests
          </h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">
            {role === "employee" ? "Submit and track your leave requests" : "Review and manage leave requests"}
          </p>
        </div>
        {role === "employee" && (
          <button
            id="btn-request-leave"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Request Leave
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending", value: stats.pending, color: "text-yellow-300", bg: "bg-yellow-400/10 border-yellow-400/20" },
          { label: "Approved", value: stats.approved, color: "text-emerald-300", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "Rejected", value: stats.rejected, color: "text-red-300", bg: "bg-red-400/10 border-red-400/20" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-[hsl(215,20%,55%)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Leaves list */}
      <div className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-[hsl(215,20%,45%)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        )}
        {!isLoading && (leaves as any[]).length === 0 && (
          <div className="text-center py-16 bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl">
            <CalendarDays className="w-10 h-10 text-[hsl(215,20%,35%)] mx-auto mb-3" />
            <p className="text-sm text-[hsl(215,20%,55%)]">No leave requests yet</p>
            {role === "employee" && <p className="text-xs text-[hsl(215,20%,45%)] mt-1">Click "Request Leave" to submit your first request</p>}
          </div>
        )}

        {(leaves as any[]).map((leave: any) => {
          const typeInfo = leaveTypeLabel(leave.leaveType);
          const isExpanded = expandedId === leave.id;
          const days = daysCount(leave.startDate, leave.endDate);

          // What actions can the current user perform?
          const canManagerApprove = isManager && leave.managerApprovalStatus === "pending" && leave.status !== "rejected";
          const canHRApprove = isHR && leave.hrApprovalStatus === "pending" && leave.status !== "rejected";

          return (
            <div
              key={leave.id}
              className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl overflow-hidden transition-all"
            >
              {/* Card header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[hsl(217,32%,15%)] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : leave.id)}
              >
                <div className="text-2xl w-10 h-10 flex items-center justify-center bg-[hsl(217,32%,17%)] rounded-lg flex-shrink-0">
                  {typeInfo.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-white">{typeInfo.label}</p>
                    {role !== "employee" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[hsl(215,20%,55%)]">
                        <User className="w-3 h-3" /> {leave.employeeName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[hsl(215,20%,55%)]">
                    {new Date(leave.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                    {new Date(leave.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    <span className="ml-1.5 text-[hsl(215,20%,45%)]">({days} day{days !== 1 ? "s" : ""})</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={leave.status} />
                  <ChevronDown className={`w-4 h-4 text-[hsl(215,20%,45%)] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-[hsl(217,32%,17%)] p-4 space-y-4">
                  {/* Reason */}
                  <div>
                    <p className="text-[10px] font-semibold text-[hsl(215,20%,55%)] uppercase tracking-wide mb-1">Reason</p>
                    <p className="text-sm text-white bg-[hsl(217,32%,15%)] rounded-lg px-3 py-2">{leave.reason}</p>
                  </div>

                  {/* Approval timeline */}
                  <div>
                    <p className="text-[10px] font-semibold text-[hsl(215,20%,55%)] uppercase tracking-wide mb-2">Approval Status</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <ApprovalLeg
                        label="Manager Review"
                        status={leave.managerApprovalStatus}
                        approverName={leave.managerApproverName}
                        approvedAt={leave.managerApprovedAt}
                        note={leave.managerNote}
                      />
                      <ApprovalLeg
                        label="HR Review"
                        status={leave.hrApprovalStatus}
                        approverName={leave.hrApproverName}
                        approvedAt={leave.hrApprovedAt}
                        note={leave.hrNote}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  {(canManagerApprove || canHRApprove) && (
                    <div>
                      <p className="text-[10px] font-semibold text-[hsl(215,20%,55%)] uppercase tracking-wide mb-2">Your Action</p>

                      {/* Inline action form */}
                      {actionState?.id === leave.id ? (
                        <div className="bg-[hsl(217,32%,15%)] border border-[hsl(217,32%,22%)] rounded-lg p-3 space-y-2">
                          <p className="text-xs text-white font-medium">
                            {actionState!.type.includes("approve") ? "✅" : "❌"}{" "}
                            {actionState!.type.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </p>
                          <textarea
                            value={actionNote}
                            onChange={e => setActionNote(e.target.value)}
                            placeholder="Add a note (optional)..."
                            rows={2}
                            className="w-full bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => performAction(leave.id, actionState!.type)}
                              disabled={isActing}
                              className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 ${
                                actionState!.type.includes("approve")
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 hover:bg-emerald-500/30"
                                  : "bg-red-500/20 text-red-300 border border-red-400/20 hover:bg-red-500/30"
                              }`}
                            >
                              {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                              Confirm
                            </button>
                            <button
                              onClick={() => { setActionState(null); setActionNote(""); }}
                              className="text-xs text-[hsl(215,20%,55%)] hover:text-white px-3 py-1.5 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {canManagerApprove && (
                            <>
                              <button
                                id={`btn-mgr-approve-${leave.id}`}
                                onClick={() => setActionState({ id: leave.id, type: "manager-approve" })}
                                className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 hover:bg-emerald-500/30 rounded-lg px-3 py-1.5 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Manager Approve
                              </button>
                              <button
                                id={`btn-mgr-reject-${leave.id}`}
                                onClick={() => setActionState({ id: leave.id, type: "manager-reject" })}
                                className="flex items-center gap-1.5 text-xs font-semibold bg-red-500/20 text-red-300 border border-red-400/20 hover:bg-red-500/30 rounded-lg px-3 py-1.5 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Manager Reject
                              </button>
                            </>
                          )}
                          {canHRApprove && (
                            <>
                              <button
                                id={`btn-hr-approve-${leave.id}`}
                                onClick={() => setActionState({ id: leave.id, type: "hr-approve" })}
                                className="flex items-center gap-1.5 text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/20 hover:bg-blue-500/30 rounded-lg px-3 py-1.5 transition-colors"
                              >
                                <Building2 className="w-3.5 h-3.5" /> HR Approve
                              </button>
                              <button
                                id={`btn-hr-reject-${leave.id}`}
                                onClick={() => setActionState({ id: leave.id, type: "hr-reject" })}
                                className="flex items-center gap-1.5 text-xs font-semibold bg-red-500/20 text-red-300 border border-red-400/20 hover:bg-red-500/30 rounded-lg px-3 py-1.5 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" /> HR Reject
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-[hsl(215,20%,45%)]">
                    Submitted {new Date(leave.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[hsl(217,32%,22%)]">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[hsl(186,100%,42%)]" /> Request Leave
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, leaveType: t.value }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        form.leaveType === t.value
                          ? "border-[hsl(186,100%,42%)] bg-[hsl(186,100%,42%)/10%] text-white"
                          : "border-[hsl(217,32%,22%)] bg-[hsl(217,32%,17%)] text-[hsl(215,20%,65%)] hover:border-[hsl(217,32%,32%)]"
                      }`}
                    >
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    min={form.startDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
              </div>

              {form.startDate && form.endDate && (
                <div className="bg-[hsl(186,100%,42%)/10%] border border-[hsl(186,100%,42%)/20%] rounded-lg px-3 py-2">
                  <p className="text-xs text-[hsl(186,100%,42%)]">
                    📅 {daysCount(form.startDate, form.endDate)} day{daysCount(form.startDate, form.endDate) !== 1 ? "s" : ""} off
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Reason <span className="text-red-400">*</span></label>
                <textarea
                  required
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Briefly describe the reason for your leave..."
                  rows={3}
                  className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)] resize-none"
                />
              </div>

              <div className="bg-[hsl(217,32%,15%)] border border-[hsl(217,32%,22%)] rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[hsl(215,20%,55%)] leading-relaxed">
                    Your request will be reviewed by your <strong className="text-white">Manager</strong> and <strong className="text-white">HR</strong>. Both must approve for the leave to be granted.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  id="btn-submit-leave"
                  className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
