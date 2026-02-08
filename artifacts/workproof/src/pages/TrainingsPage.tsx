import { useState, useRef } from "react";
import { useListTrainingCertifications, getListTrainingCertificationsQueryKey, useReviewTrainingCertification, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle2, XCircle, Clock, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function TrainingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reviewItem, setReviewItem] = useState<any>(null);
  const [assignHours, setAssignHours] = useState("");

  const { data: certifications = [], isLoading } = useListTrainingCertifications({ query: { queryKey: getListTrainingCertificationsQueryKey() } });

  const reviewMut = useReviewTrainingCertification({
    mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTrainingCertificationsQueryKey() }); setReviewItem(null); setAssignHours(""); } },
  });

  const handleUploadSubmit = async () => {
    if (!uploadTitle.trim()) { alert("Please enter a title"); return; }
    const file = fileInputRef.current?.files?.[0];
    if (!file) { alert("Please select a file"); return; }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle);
      formData.append("document", file);

      await customFetch("/api/v1/training-certifications", {
        method: "POST",
        body: formData as any,
      });

      qc.invalidateQueries({ queryKey: getListTrainingCertificationsQueryKey() });
      setShowUpload(false);
      setUploadTitle("");
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload certification");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = (status: "approved" | "rejected") => {
    if (status === "approved" && !assignHours) {
      alert("Please assign training hours for approval");
      return;
    }
    reviewMut.mutate({ id: reviewItem.id, data: { status, trainingHours: Number(assignHours) } });
  };

  const isHrOrManager = user?.role === "hr_admin" || user?.role === "super_admin" || user?.role === "manager";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Training Ledger</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Verified public ledger of employee training and certifications</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
          <Upload className="w-4 h-4" /> Upload Certification
        </button>
      </div>

      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(217,32%,17%)] bg-[hsl(222,47%,11%)]">
              {["Employee", "Certification", "Document", "Status", "Hours", "Reviewer"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[hsl(215,20%,55%)] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">Loading ledger...</td></tr>}
            {!isLoading && (certifications as any[]).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">No certifications uploaded yet</td></tr>}
            {!isLoading && (certifications as any[]).map((cert: any) => (
              <tr key={cert.id} className="border-b border-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,17%)]/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-sm text-white">{cert.userName || 'Unknown'}</div>
                  <div className="text-xs text-[hsl(215,20%,55%)] capitalize">{cert.userRole}</div>
                </td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{cert.title}</td>
                <td className="px-4 py-3">
                  <a href={cert.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[hsl(186,100%,42%)] hover:underline">
                    <FileText className="w-3.5 h-3.5" /> View Doc
                  </a>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {cert.status === "pending" && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-medium"><Clock className="w-3 h-3" /> Pending</span>}
                    {cert.status === "approved" && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Approved</span>}
                    {cert.status === "rejected" && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium"><XCircle className="w-3 h-3" /> Rejected</span>}
                    
                    {cert.status === "pending" && isHrOrManager && (
                      <button onClick={() => setReviewItem(cert)} className="ml-2 px-2 py-1 text-xs bg-[hsl(217,32%,25%)] hover:bg-[hsl(217,32%,30%)] text-white rounded transition-colors">
                        Review
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-white">{cert.trainingHours != null ? `${cert.trainingHours}h` : '-'}</td>
                <td className="px-4 py-3 text-xs text-[hsl(215,20%,55%)]">{cert.reviewerName || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(217,32%,17%)]">
              <h3 className="font-semibold text-white">Upload Certification</h3>
              <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-[hsl(217,32%,17%)] rounded-lg transition-colors text-[hsl(215,20%,65%)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[hsl(215,20%,55%)] mb-1">Training/Course Title</label>
                <input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. AWS Solutions Architect" className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(215,20%,55%)] mb-1">Proof Document (PDF, Image)</label>
                <input type="file" ref={fileInputRef} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="w-full text-sm text-[hsl(215,20%,65%)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[hsl(186,100%,42%)] file:text-black hover:file:bg-[hsl(186,100%,38%)] file:cursor-pointer" />
              </div>
            </div>
            <div className="p-4 border-t border-[hsl(217,32%,17%)] flex justify-end gap-3">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm font-medium text-[hsl(215,20%,65%)] hover:text-white transition-colors">Cancel</button>
              <button onClick={handleUploadSubmit} disabled={isSubmitting} className="px-4 py-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {isSubmitting ? "Uploading..." : "Submit Proof"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(217,32%,17%)]">
              <h3 className="font-semibold text-white">Review Certification</h3>
              <button onClick={() => setReviewItem(null)} className="p-1 hover:bg-[hsl(217,32%,17%)] rounded-lg transition-colors text-[hsl(215,20%,65%)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-[hsl(215,20%,55%)] mb-0.5">Employee</p>
                <p className="text-sm font-medium text-white">{reviewItem.userName}</p>
              </div>
              <div>
                <p className="text-xs text-[hsl(215,20%,55%)] mb-0.5">Training Title</p>
                <p className="text-sm text-white">{reviewItem.title}</p>
              </div>
              <div>
                <a href={reviewItem.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] text-sm text-white rounded-lg transition-colors">
                  <FileText className="w-4 h-4" /> Open Uploaded Document
                </a>
              </div>
              <div className="pt-2">
                <label className="block text-xs font-medium text-[hsl(215,20%,55%)] mb-1">Assign Training Credit (Hours)</label>
                <input type="number" value={assignHours} onChange={e => setAssignHours(e.target.value)} placeholder="e.g. 5" className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
              </div>
            </div>
            <div className="p-4 border-t border-[hsl(217,32%,17%)] flex justify-end gap-3">
              <button onClick={() => handleReview("rejected")} disabled={reviewMut.isPending} className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-50">Reject</button>
              <button onClick={() => handleReview("approved")} disabled={reviewMut.isPending} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                Approve & Credit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
