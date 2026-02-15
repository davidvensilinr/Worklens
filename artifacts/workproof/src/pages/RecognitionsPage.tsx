import { useState } from "react";
import { useListRecognitions, getListRecognitionsQueryKey, useCreateRecognition, useListPromotions, getListPromotionsQueryKey, useCreatePromotion, useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Award, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BADGES = ["Star Performer", "Innovation Award", "Team Player", "Leadership Excellence", "Customer Champion", "Problem Solver", "Mentor of the Month"];

export default function RecognitionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"recognitions" | "promotions">("recognitions");
  const [showRecCreate, setShowRecCreate] = useState(false);
  const [showPromCreate, setShowPromCreate] = useState(false);
  const [recForm, setRecForm] = useState({ recipientId: "", badge: BADGES[0], message: "" });
  const [promForm, setPromForm] = useState({ userId: "", oldRole: "", newRole: "", notes: "" });

  const { data: recognitions = [], isLoading: loadRec } = useListRecognitions({}, { query: { queryKey: getListRecognitionsQueryKey() } });
  const { data: promotions = [], isLoading: loadProm } = useListPromotions({}, { query: { queryKey: getListPromotionsQueryKey() } });
  const { data: users = [] } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() } });

  const createRecMut = useCreateRecognition({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRecognitionsQueryKey() }); setShowRecCreate(false); setRecForm({ recipientId: "", badge: BADGES[0], message: "" }); } } });
  const createPromMut = useCreatePromotion({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }); setShowPromCreate(false); setPromForm({ userId: "", oldRole: "", newRole: "", notes: "" }); } } });

  const canPromote = user?.role && ["hr_admin", "super_admin"].includes(user.role);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Recognitions & Promotions</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Celebrate team achievements</p>
        </div>
        <div className="flex gap-2">
          {tab === "recognitions" && (
            <button onClick={() => setShowRecCreate(true)} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
              <Plus className="w-4 h-4" /> Give Recognition
            </button>
          )}
          {tab === "promotions" && canPromote && (
            <button onClick={() => setShowPromCreate(true)} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
              <Plus className="w-4 h-4" /> Record Promotion
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-[hsl(217,32%,17%)] rounded-lg p-1 w-fit">
        {(["recognitions", "promotions"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-[hsl(186,100%,42%)] text-black" : "text-[hsl(215,20%,65%)] hover:text-white"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "recognitions" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadRec && <p className="text-sm text-[hsl(215,20%,45%)]">Loading...</p>}
          {(recognitions as any[]).length === 0 && !loadRec && <p className="text-sm text-[hsl(215,20%,45%)] col-span-3">No recognitions yet — be the first to give one!</p>}
          {(recognitions as any[]).map((r: any) => (
            <div key={r.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4 hover:border-[hsl(186,100%,42%)/20%] transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-[hsl(186,100%,42%)/15%] border border-[hsl(186,100%,42%)/20%] flex items-center justify-center">
                  <Award className="w-4 h-4 text-[hsl(186,100%,42%)]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[hsl(186,100%,42%)]">{r.badge}</p>
                  <p className="text-xs text-[hsl(215,20%,55%)]">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-white mb-1">To: {r.recipientName}</p>
              <p className="text-xs text-[hsl(215,20%,55%)]">From: {r.giverName}</p>
              {r.message && <p className="text-xs text-[hsl(215,20%,45%)] mt-2 italic">"{r.message}"</p>}
            </div>
          ))}
        </div>
      )}

      {tab === "promotions" && (
        <div className="space-y-3">
          {loadProm && <p className="text-sm text-[hsl(215,20%,45%)]">Loading...</p>}
          {(promotions as any[]).length === 0 && !loadProm && <p className="text-sm text-[hsl(215,20%,45%)]">No promotions recorded yet</p>}
          {(promotions as any[]).map((p: any) => (
            <div key={p.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-[hsl(186,100%,42%)/10%] flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4.5 h-4.5 text-[hsl(186,100%,42%)]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{p.userName}</p>
                <p className="text-xs text-[hsl(215,20%,55%)]">{p.oldRole} <span className="text-[hsl(186,100%,42%)]">→</span> {p.newRole}</p>
                {p.notes && <p className="text-xs text-[hsl(215,20%,45%)] mt-0.5">{p.notes}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-[hsl(215,20%,45%)]">{new Date(p.promotedAt).toLocaleDateString()}</p>
                <p className="text-xs text-[hsl(215,20%,55%)]">by {p.promotedByName}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showRecCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">Give Recognition</h2>
              <button onClick={() => setShowRecCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createRecMut.mutate({ data: { recipientId: Number(recForm.recipientId), badge: recForm.badge, message: recForm.message || undefined } as any }); }} className="space-y-3">
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Recipient</label>
                <select value={recForm.recipientId} onChange={e => setRecForm(f => ({ ...f, recipientId: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">Select employee...</option>
                  {(users as any[]).filter((u: any) => u.id !== user?.id).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Badge</label>
                <select value={recForm.badge} onChange={e => setRecForm(f => ({ ...f, badge: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  {BADGES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Message</label>
                <textarea value={recForm.message} onChange={e => setRecForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder="Optional personal note..." className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRecCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={createRecMut.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">Give Badge</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPromCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">Record Promotion</h2>
              <button onClick={() => setShowPromCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createPromMut.mutate({ data: { userId: Number(promForm.userId), oldRole: promForm.oldRole, newRole: promForm.newRole, notes: promForm.notes || undefined } as any }); }} className="space-y-3">
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Employee</label>
                <select value={promForm.userId} onChange={e => setPromForm(f => ({ ...f, userId: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">Select...</option>
                  {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {[{ key: "oldRole", label: "Previous Role" }, { key: "newRole", label: "New Role" }, { key: "notes", label: "Notes" }].map(({ key, label }) => (
                <div key={key}><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">{label}</label>
                  <input value={promForm[key as keyof typeof promForm]} onChange={e => setPromForm(f => ({ ...f, [key]: e.target.value }))} required={key !== "notes"} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPromCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={createPromMut.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
