import { useState } from "react";
import { useListTrainingPrograms, getListTrainingProgramsQueryKey, useCreateTrainingProgram, useListTrainings, getListTrainingsQueryKey, useCreateTraining, useCompleteTraining } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, GraduationCap, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_COLORS: Record<string, string> = {
  enrolled: "text-blue-300 bg-blue-400/10 border-blue-400/20",
  in_progress: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20",
  completed: "text-green-300 bg-green-400/10 border-green-400/20",
  failed: "text-red-300 bg-red-400/10 border-red-400/20",
};

export default function TrainingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"programs" | "enrollments">("programs");
  const [showCreate, setShowCreate] = useState(false);
  const [showComplete, setShowComplete] = useState<any>(null);
  const [progForm, setProgForm] = useState({ title: "", description: "", durationHours: "", deadline: "" });
  const [score, setScore] = useState("");

  const { data: programs = [], isLoading: loadProg } = useListTrainingPrograms({ query: { queryKey: getListTrainingProgramsQueryKey() } });
  const { data: trainings = [], isLoading: loadTrain } = useListTrainings({}, { query: { queryKey: getListTrainingsQueryKey() } });

  const createProgramMut = useCreateTrainingProgram({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTrainingProgramsQueryKey() }); setShowCreate(false); setProgForm({ title: "", description: "", durationHours: "", deadline: "" }); } } });
  const enrollMut = useCreateTraining({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListTrainingsQueryKey() }) } });
  const completeMut = useCompleteTraining({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTrainingsQueryKey() }); setShowComplete(null); setScore(""); } } });

  const myTrainings = (trainings as any[]).filter((t: any) => t.userId === user?.id);
  const isEnrolled = (programId: number) => myTrainings.some((t: any) => t.programId === programId);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Training</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Programs and enrollment tracking</p>
        </div>
        {tab === "programs" && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
            <Plus className="w-4 h-4" /> New Program
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-[hsl(217,32%,17%)] rounded-lg p-1 w-fit">
        {(["programs", "enrollments"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-[hsl(186,100%,42%)] text-black" : "text-[hsl(215,20%,65%)] hover:text-white"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "programs" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {loadProg && <p className="text-sm text-[hsl(215,20%,45%)]">Loading...</p>}
          {(programs as any[]).map((prog: any) => {
            const enrolled = isEnrolled(prog.id);
            return (
              <div key={prog.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(186,100%,42%)/10%] flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-4.5 h-4.5 text-[hsl(186,100%,42%)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{prog.title}</h3>
                    <p className="text-xs text-[hsl(215,20%,55%)]">{prog.enrollmentCount ?? 0} enrolled</p>
                  </div>
                </div>
                {prog.description && <p className="text-xs text-[hsl(215,20%,55%)] mb-3">{prog.description}</p>}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[hsl(215,20%,45%)]">
                    {prog.durationHours && <span>{prog.durationHours}h</span>}
                    {prog.deadline && <span> • Due {new Date(prog.deadline).toLocaleDateString()}</span>}
                  </div>
                  {!enrolled ? (
                    <button onClick={() => enrollMut.mutate({ data: { programId: prog.id } as any })} className="text-xs bg-[hsl(186,100%,42%)/10%] border border-[hsl(186,100%,42%)/20%] text-[hsl(186,100%,42%)] rounded-lg px-3 py-1 hover:bg-[hsl(186,100%,42%)/20%] transition-colors">
                      Enroll
                    </button>
                  ) : (
                    <span className="text-xs text-green-300 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Enrolled</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "enrollments" && (
        <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(217,32%,17%)]">
                {["Employee", "Program", "Status", "Score", "Hours", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[hsl(215,20%,55%)] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadTrain && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">Loading...</td></tr>}
              {(trainings as any[]).map((t: any) => (
                <tr key={t.id} className="border-b border-[hsl(217,32%,15%)] last:border-0 hover:bg-[hsl(217,32%,17%)/30%] transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{t.userName ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{t.programTitle ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_COLORS[t.status] ?? ""}`}>{t.status}</span></td>
                  <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{t.score ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{t.hoursSpent ? `${t.hoursSpent}h` : "—"}</td>
                  <td className="px-4 py-3">
                    {["enrolled", "in_progress"].includes(t.status) && t.userId === user?.id && (
                      <button onClick={() => setShowComplete(t)} className="text-xs border border-[hsl(186,100%,42%)/20%] text-[hsl(186,100%,42%)] rounded px-2 py-1 hover:bg-[hsl(186,100%,42%)/10%] transition-colors">
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">New Training Program</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createProgramMut.mutate({ data: { title: progForm.title, description: progForm.description || undefined, durationHours: progForm.durationHours ? Number(progForm.durationHours) : undefined, deadline: progForm.deadline || undefined } as any }); }} className="space-y-3">
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Title</label><input value={progForm.title} onChange={e => setProgForm(f => ({ ...f, title: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" /></div>
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Description</label><textarea value={progForm.description} onChange={e => setProgForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Duration (hours)</label><input type="number" value={progForm.durationHours} onChange={e => setProgForm(f => ({ ...f, durationHours: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" /></div>
                <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Deadline</label><input type="date" value={progForm.deadline} onChange={e => setProgForm(f => ({ ...f, deadline: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={createProgramMut.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Complete Training</h2>
              <button onClick={() => setShowComplete(null)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-[hsl(215,20%,65%)] mb-4">"{showComplete.programTitle}"</p>
            <div>
              <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Score (0–100)</label>
              <input type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] mb-4" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowComplete(null)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
              <button onClick={() => completeMut.mutate({ id: showComplete.id, data: { score: Number(score) } as any })} disabled={!score || completeMut.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">Submit Score</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
