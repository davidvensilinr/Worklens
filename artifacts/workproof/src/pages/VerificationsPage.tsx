import { useState } from "react";
import { useListClaims, useCreateClaim, useApproveClaim, getListClaimsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, XCircle, FileText, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function VerificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: claims = [], isLoading } = useListClaims({ query: { queryKey: getListClaimsQueryKey() } });

  const createMut = useCreateClaim({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListClaimsQueryKey() }) } });
  const approveMut = useApproveClaim({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListClaimsQueryKey() }) } });

  const [claimType, setClaimType] = useState("project_delivery");
  const [description, setDescription] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: { claimType, description, proofUrl } as any });
    setDescription("");
    setProofUrl("");
  };

  const myClaims = claims.filter((c: any) => c.userId === user?.id);
  const othersClaims = claims.filter((c: any) => c.userId !== user?.id && c.status === "pending");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[hsl(186,100%,42%)]" />
            Proof-of-Work Ledger
          </h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-1">Submit claims and cross-verify peers to automatically calculate HR metrics.</p>
        </div>
        <a 
          href="/api/v1/ml-export" 
          download 
          className="flex items-center gap-2 bg-[hsl(222,47%,15%)] hover:bg-[hsl(222,47%,20%)] text-white border border-[hsl(217,32%,22%)] rounded-xl px-4 py-2 transition-colors font-medium text-sm"
        >
          <Download className="w-4 h-4" /> Export ML Dataset
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submit Claim Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,17%)] rounded-xl p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Submit Claim</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[hsl(215,20%,55%)] mb-1">Claim Type</label>
                <select 
                  value={claimType} 
                  onChange={e => setClaimType(e.target.value)}
                  className="w-full bg-[hsl(222,47%,15%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="project_delivery">Project Delivery</option>
                  <option value="education">Education / Degree</option>
                  <option value="skill_certification">Skill Certification</option>
                  <option value="performance">Performance Milestone</option>
                  <option value="attendance_photo">Attendance Photo Verification</option>
                  <option value="survey_environment">Survey: Environment Satisfaction (1-4)</option>
                  <option value="survey_involvement">Survey: Job Involvement (1-4)</option>
                  <option value="survey_job_satisfaction">Survey: Job Satisfaction (1-4)</option>
                  <option value="survey_relationship">Survey: Relationship (1-4)</option>
                  <option value="survey_wlb">Survey: Work-Life Balance (1-4)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(215,20%,55%)] mb-1">Description / Value</label>
                <input 
                  type="text" 
                  required
                  placeholder={claimType.startsWith("survey") ? "Enter 1 (Low) to 4 (High)" : "What did you achieve?"}
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-[hsl(222,47%,15%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              {!claimType.startsWith("survey") && (
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,20%,55%)] mb-1">Proof URL (Optional)</label>
                  <input 
                    type="url" 
                    placeholder="Link to document/repo"
                    value={proofUrl} 
                    onChange={e => setProofUrl(e.target.value)}
                    className="w-full bg-[hsl(222,47%,15%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              )}
              <button 
                type="submit" 
                disabled={createMut.isPending}
                className="w-full bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold rounded-lg py-2 transition-colors disabled:opacity-50"
              >
                Submit Claim
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Action Required (Peers) */}
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(186,100%,42%)/30%] rounded-xl p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              Action Required <span className="bg-[hsl(186,100%,42%)] text-black text-xs font-bold px-2 py-0.5 rounded-full">{othersClaims.length}</span>
            </h2>
            <div className="space-y-3">
              {othersClaims.length === 0 && <p className="text-sm text-[hsl(215,20%,55%)]">No pending claims from peers.</p>}
              {othersClaims.map((c: any) => (
                <div key={c.id} className="bg-[hsl(222,47%,15%)] border border-[hsl(217,32%,22%)] rounded-lg p-4 flex items-start justify-between">
                  <div>
                    <span className="text-xs text-[hsl(186,100%,42%)] font-medium bg-[hsl(186,100%,42%)/10%] px-2 py-1 rounded">{c.claimType}</span>
                    <p className="text-white text-sm mt-2">{c.description}</p>
                    {c.claimType === "attendance_photo" && c.proofUrl ? (
                      <div className="mt-3">
                        <img src={c.proofUrl} alt="Attendance Clock In" className="w-48 h-auto rounded-lg border border-[hsl(217,32%,22%)] object-cover" />
                      </div>
                    ) : (
                      c.proofUrl && <a href={c.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-[hsl(215,20%,65%)] hover:text-white flex items-center gap-1 mt-2"><FileText className="w-3 h-3"/> View Proof</a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => approveMut.mutate({ claimId: c.id, data: { status: "rejected", reason: "Insufficient proof" } as any })}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Reject"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => approveMut.mutate({ claimId: c.id, data: { status: "verified", reason: "Looks good" } as any })}
                      className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                      title="Verify"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My History */}
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,17%)] rounded-xl p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">My Claim History</h2>
            <div className="space-y-3">
              {myClaims.length === 0 && <p className="text-sm text-[hsl(215,20%,55%)]">You haven't submitted any claims.</p>}
              {myClaims.map((c: any) => (
                <div key={c.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">{c.description}</p>
                    <p className="text-xs text-[hsl(215,20%,55%)] mt-1">{c.claimType}</p>
                  </div>
                  <div>
                    {c.status === "verified" && <span className="text-xs text-green-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Verified</span>}
                    {c.status === "rejected" && <span className="text-xs text-red-400 font-medium flex items-center gap-1"><XCircle className="w-3 h-3"/> Rejected</span>}
                    {c.status === "pending" && <span className="text-xs text-[hsl(215,20%,65%)] font-medium">Pending...</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
