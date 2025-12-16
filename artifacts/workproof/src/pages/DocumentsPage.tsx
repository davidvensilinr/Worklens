import { useState } from "react";
import { useListDocuments, getListDocumentsQueryKey, useCreateDocument, useSubmitDocument, useVerifyDocument } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-[hsl(215,20%,65%)] bg-[hsl(217,32%,17%)] border-[hsl(217,32%,22%)]" },
  submitted: { label: "Submitted", color: "text-blue-300 bg-blue-400/10 border-blue-400/20" },
  under_review: { label: "Under Review", color: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20" },
  approved: { label: "Approved", color: "text-green-300 bg-green-400/10 border-green-400/20" },
  rejected: { label: "Rejected", color: "text-red-300 bg-red-400/10 border-red-400/20" },
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [verifyDoc, setVerifyDoc] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", fileType: "pdf" });
  const [rejectReason, setRejectReason] = useState("");

  const { data: docs = [], isLoading } = useListDocuments(
    statusFilter ? { status: statusFilter } : {},
    { query: { queryKey: getListDocumentsQueryKey(statusFilter ? { status: statusFilter } : {}) } }
  );

  const createMut = useCreateDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        setShowCreate(false);
        setForm({ title: "", description: "", deadline: "", fileType: "pdf" });
      },
    },
  });
  const submitMut = useSubmitDocument({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() }) },
  });
  const verifyMut = useVerifyDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        setVerifyDoc(null);
        setRejectReason("");
      },
    },
  });

  const canVerify = user?.role && ["hr_admin", "super_admin", "manager"].includes(user.role);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Documents</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Tamper-proof document workspace</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["", "pending", "submitted", "under_review", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${statusFilter === s ? "bg-[hsl(186,100%,42%)] border-[hsl(186,100%,42%)] text-black font-semibold" : "border-[hsl(217,32%,22%)] text-[hsl(215,20%,55%)] hover:text-white hover:border-[hsl(217,32%,30%)]"}`}
          >
            {s === "" ? "All" : STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(217,32%,17%)]">
              {["Document", "Uploader", "Status", "Deadline", "Version", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[hsl(215,20%,55%)] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">Loading...</td></tr>}
            {!isLoading && (docs as any[]).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">No documents found</td></tr>}
            {(docs as any[]).map((doc: any) => {
              const st = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending;
              return (
                <tr key={doc.id} className="border-b border-[hsl(217,32%,15%)] last:border-0 hover:bg-[hsl(217,32%,17%)/30%] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[hsl(186,100%,42%)] flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">{doc.title}</p>
                        {doc.description && <p className="text-xs text-[hsl(215,20%,55%)] truncate max-w-xs">{doc.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{doc.uploaderName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${st.color}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{doc.deadline ? new Date(doc.deadline).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">v{doc.version}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {doc.status === "pending" && doc.uploaderId === user?.id && (
                        <button onClick={() => submitMut.mutate({ id: doc.id })} className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 border border-blue-400/20 rounded px-2 py-1 transition-colors">
                          <Send className="w-3 h-3" /> Submit
                        </button>
                      )}
                      {doc.status === "submitted" && canVerify && (
                        <button onClick={() => setVerifyDoc(doc)} className="flex items-center gap-1 text-xs text-[hsl(186,100%,42%)] border border-[hsl(186,100%,42%)/20%] rounded px-2 py-1 transition-colors">
                          Review
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">Upload Document</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMut.mutate({ data: { title: form.title, description: form.description || undefined, deadline: form.deadline || undefined, fileType: form.fileType } as any }); }} className="space-y-3">
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
                </div>
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">File Type</label>
                  <select value={form.fileType} onChange={e => setForm(f => ({ ...f, fileType: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                    {["pdf", "docx", "xlsx", "pptx", "txt"].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">
                  {createMut.isPending ? "Creating..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify modal */}
      {verifyDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Review Document</h2>
              <button onClick={() => setVerifyDoc(null)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-[hsl(215,20%,65%)] mb-4">"{verifyDoc.title}"</p>
            <div>
              <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Rejection Reason (if rejecting)</label>
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] mb-4" placeholder="Optional" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => verifyMut.mutate({ id: verifyDoc.id, data: { action: "reject", rejectionReason: rejectReason || undefined } as any })} className="flex-1 flex items-center justify-center gap-1.5 border border-red-400/30 text-red-400 rounded-lg py-2 text-sm hover:bg-red-400/10 transition-colors">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button onClick={() => verifyMut.mutate({ id: verifyDoc.id, data: { action: "approve" } as any })} className="flex-1 flex items-center justify-center gap-1.5 bg-green-500/20 border border-green-400/30 text-green-400 rounded-lg py-2 text-sm hover:bg-green-500/30 transition-colors">
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
