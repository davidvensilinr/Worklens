import { useState } from "react";
import { useListTasks, getListTasksQueryKey, useCreateTask, useUpdateTask, useVerifyTask, useListProjects, getListProjectsQueryKey, useListUsers, getListUsersQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Plus, X, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-300 bg-red-400/10 border-red-400/20",
  high: "text-orange-300 bg-orange-400/10 border-orange-400/20",
  medium: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20",
  low: "text-blue-300 bg-blue-400/10 border-blue-400/20",
};
const STATUS_COLORS: Record<string, string> = {
  assigned: "text-[hsl(215,20%,65%)] bg-[hsl(217,32%,17%)] border-[hsl(217,32%,22%)]",
  in_progress: "text-blue-300 bg-blue-400/10 border-blue-400/20",
  escalated: "text-red-400 bg-red-400/10 border-red-400/30",
  submitted: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20",
  verified: "text-green-300 bg-green-400/10 border-green-400/20",
  closed: "text-[hsl(215,20%,45%)] bg-[hsl(217,32%,15%)] border-[hsl(217,32%,18%)]",
};

export default function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [completeTaskId, setCompleteTaskId] = useState<number | null>(null);
  const [viewCheckpointsTaskId, setViewCheckpointsTaskId] = useState<number | null>(null);
  const [escalateTaskId, setEscalateTaskId] = useState<number | null>(null);
  const [checkpointForm, setCheckpointForm] = useState({ title: "" });
  const [completeForm, setCompleteForm] = useState({ proofUrl: "", description: "" });
  const [escalateForm, setEscalateForm] = useState({ reason: "", escalatedToId: "" });
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", projectId: "", assigneeId: "", deadline: "" });

  const filters: any = {};
  if (statusFilter) filters.status = statusFilter;
  if (priorityFilter) filters.priority = priorityFilter;

  const { data: tasks = [], isLoading } = useListTasks(filters, { query: { queryKey: getListTasksQueryKey(filters) } });
  const { data: projects = [] } = useListProjects({ query: { queryKey: getListProjectsQueryKey() } });
  const { data: users = [] } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() } });

  const createMut = useCreateTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setShowCreate(false);
        setForm({ title: "", description: "", priority: "medium", projectId: "", assigneeId: "", deadline: "" });
      },
    },
  });
  const updateMut = useUpdateTask({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }) },
  });
  const verifyMut = useVerifyTask({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }) },
  });
  const completeTaskMut = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: { proofUrl: string, description: string } }) => {
      return customFetch(`/api/v1/tasks/${id}/complete`, { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      setCompleteTaskId(null);
      setCompleteForm({ proofUrl: "", description: "" });
    }
  });

  const escalateTaskMut = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: { reason: string, escalatedToId?: string } }) => {
      return customFetch(`/api/v1/tasks/${id}/escalate`, { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      setEscalateTaskId(null);
      setEscalateForm({ reason: "", escalatedToId: "" });
    }
  });

  const resolveEscalationMut = useMutation({
    mutationFn: async ({ id, escalationId }: { id: number, escalationId: number }) => {
      return customFetch(`/api/v1/tasks/${id}/escalations/${escalationId}/resolve`, { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
    }
  });

  const { data: checkpoints = [] } = useQuery({
    queryKey: ["taskCheckpoints", viewCheckpointsTaskId],
    queryFn: () => customFetch(`/api/v1/tasks/${viewCheckpointsTaskId}/checkpoints`),
    enabled: !!viewCheckpointsTaskId,
  });

  const createCheckpointMut = useMutation({
    mutationFn: async ({ taskId, title }: { taskId: number, title: string }) => {
      return customFetch(`/api/v1/tasks/${taskId}/checkpoints`, { method: "POST", body: JSON.stringify({ title }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskCheckpoints", viewCheckpointsTaskId] });
      setCheckpointForm({ title: "" });
    }
  });

  const updateCheckpointMut = useMutation({
    mutationFn: async ({ taskId, checkpointId, data }: { taskId: number, checkpointId: number, data: any }) => {
      return customFetch(`/api/v1/tasks/${taskId}/checkpoints/${checkpointId}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskCheckpoints", viewCheckpointsTaskId] });
      qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); // Refresh task progress
    }
  });

  const canVerify = user?.role && ["hr_admin", "super_admin", "manager"].includes(user.role);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">{(tasks as any[]).length} tasks</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
          <option value="">All Statuses</option>
          {["assigned", "in_progress", "escalated", "submitted", "verified", "closed"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
          <option value="">All Priorities</option>
          {["critical", "high", "medium", "low"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-[hsl(215,20%,45%)] py-4">Loading...</p>}
        {!isLoading && (tasks as any[]).length === 0 && <p className="text-sm text-[hsl(215,20%,45%)] py-4">No tasks found</p>}
        {(tasks as any[]).map((task: any) => (
          <div key={task.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4 hover:border-[hsl(217,32%,22%)] transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_COLORS[task.status]}`}>{task.status?.replace(/_/g, " ")}</span>
                  {task.isOverdue && <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</span>}
                </div>
                <p className="text-sm font-medium text-white">{task.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(215,20%,55%)]">
                  {task.assigneeName && <span>Assigned to: {task.assigneeName}</span>}
                  {task.projectTitle && <span>Project: {task.projectTitle}</span>}
                  {task.deadline && <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 cursor-pointer group" onClick={() => setViewCheckpointsTaskId(task.id)} title="View Checkpoints">
                  <div className="flex-1 h-1.5 bg-[hsl(217,32%,20%)] rounded-full overflow-hidden group-hover:bg-[hsl(217,32%,25%)] transition-colors">
                    <div className="h-full bg-[hsl(186,100%,42%)] rounded-full transition-all" style={{ width: `${task.progress ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-[hsl(215,20%,45%)] group-hover:text-white transition-colors">{task.progress ?? 0}% Checkpoints</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                <div className="flex gap-2">
                  {task.status === "assigned" && (
                    <button onClick={() => updateMut.mutate({ id: task.id, data: { status: "in_progress" } as any })} className="text-xs border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded px-2 py-1 hover:text-white hover:border-[hsl(186,100%,42%)] transition-colors">Start</button>
                  )}
                  {task.status === "in_progress" && (
                    <button onClick={() => setCompleteTaskId(task.id)} className="text-xs border border-blue-400/20 text-blue-300 rounded px-2 py-1 hover:bg-blue-400/10 transition-colors">Submit Work</button>
                  )}
                  {(task.status === "assigned" || task.status === "in_progress") && (
                    <button onClick={() => setEscalateTaskId(task.id)} className="text-xs border border-red-400/20 text-red-400 rounded px-2 py-1 hover:bg-red-400/10 transition-colors">Escalate</button>
                  )}
                  {task.status === "pending_verification" && canVerify && (
                    <button onClick={() => verifyMut.mutate({ id: task.id, data: { action: "verify" } as any })} className="text-xs border border-green-400/20 text-green-300 rounded px-2 py-1 hover:bg-green-400/10 transition-colors">Verify</button>
                  )}
                </div>
                {task.status === "escalated" && task.activeEscalation && (
                  <div className="flex flex-col items-end gap-1 mt-1">
                    <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">Reason: {task.activeEscalation.reason}</span>
                    <button onClick={() => resolveEscalationMut.mutate({ id: task.id, escalationId: task.activeEscalation.id })} className="text-xs border border-green-400/20 text-green-400 rounded px-2 py-1 hover:bg-green-400/10 transition-colors">Resolve Escalation</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">New Task</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMut.mutate({ data: { title: form.title, description: form.description || undefined, priority: form.priority, projectId: form.projectId ? Number(form.projectId) : undefined, assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined, deadline: form.deadline || undefined } as any }); }} className="space-y-3">
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                    {["critical", "high", "medium", "low"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Assign To</label>
                <select value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">Unassigned</option>
                  {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Project</label>
                <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">None</option>
                  {(projects as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      {completeTaskId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white flex items-center gap-2">Submit Proof of Work</h2>
              <button onClick={() => setCompleteTaskId(null)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-[hsl(215,20%,65%)] mb-4">Provide proof that you have completed this task. It will be sent for peer verification before it's officially marked as complete.</p>
            <form onSubmit={e => { 
              e.preventDefault(); 
              completeTaskMut.mutate({ id: completeTaskId, data: completeForm }); 
            }} className="space-y-4">
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Proof URL (e.g. Pull Request, Doc link)</label>
                <input value={completeForm.proofUrl} onChange={e => setCompleteForm(f => ({ ...f, proofUrl: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Description of Work</label>
                <textarea value={completeForm.description} onChange={e => setCompleteForm(f => ({ ...f, description: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] min-h-[100px]" placeholder="What was accomplished?" />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCompleteTaskId(null)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={completeTaskMut.isPending} className="flex-1 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-lg py-2 text-sm transition-colors disabled:opacity-50">Submit for Verification</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkpoints Modal */}
      {viewCheckpointsTaskId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">Task Checkpoints</h2>
              <button onClick={() => setViewCheckpointsTaskId(null)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
              {(checkpoints as any[]).length === 0 && <p className="text-sm text-[hsl(215,20%,55%)]">No checkpoints added yet.</p>}
              {(checkpoints as any[]).map(cp => (
                <div key={cp.id} className="bg-[hsl(222,47%,15%)] border border-[hsl(217,32%,22%)] rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-white font-medium">{cp.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cp.status === 'approved' || cp.status === 'submitted' ? 'border-green-400/20 text-green-300 bg-green-400/10' : 'border-yellow-400/20 text-yellow-300 bg-yellow-400/10'}`}>{cp.status}</span>
                  </div>
                  {cp.proofUrl ? (
                    <a href={cp.proofUrl} target="_blank" rel="noreferrer" className="text-xs text-[hsl(186,100%,42%)] hover:underline mt-2 inline-block break-all">Proof: {cp.proofUrl}</a>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <input 
                        type="url" 
                        placeholder="Proof URL to mark complete" 
                        className="flex-1 bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded px-2 py-1 text-xs text-white"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateCheckpointMut.mutate({ taskId: viewCheckpointsTaskId, checkpointId: cp.id, data: { proofUrl: e.currentTarget.value, status: "submitted" } });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={e => {
              e.preventDefault();
              createCheckpointMut.mutate({ taskId: viewCheckpointsTaskId, title: checkpointForm.title });
            }} className="mt-auto border-t border-[hsl(217,32%,22%)] pt-4">
              <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Add New Checkpoint</label>
              <div className="flex gap-2">
                <input value={checkpointForm.title} onChange={e => setCheckpointForm({ title: e.target.value })} required className="flex-1 bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" placeholder="e.g. Design Wireframes" />
                <button type="submit" disabled={createCheckpointMut.isPending} className="bg-[hsl(217,32%,22%)] hover:bg-[hsl(217,32%,30%)] text-white px-4 py-2 rounded-lg text-sm transition-colors">+</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Escalate Task Modal */}
      {escalateTaskId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-red-400/30 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white flex items-center gap-2 text-red-400"><AlertTriangle className="w-5 h-5"/> Escalate Task</h2>
              <button onClick={() => setEscalateTaskId(null)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-[hsl(215,20%,65%)] mb-4">If you are blocked or unable to complete this task, escalate it to get help.</p>
            <form onSubmit={e => { 
              e.preventDefault(); 
              escalateTaskMut.mutate({ id: escalateTaskId, data: escalateForm }); 
            }} className="space-y-4">
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Reason for Escalation (Required)</label>
                <textarea value={escalateForm.reason} onChange={e => setEscalateForm(f => ({ ...f, reason: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400 min-h-[80px]" placeholder="Explain the blocker..." />
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Route To (Optional)</label>
                <select value={escalateForm.escalatedToId} onChange={e => setEscalateForm(f => ({ ...f, escalatedToId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-400">
                  <option value="">Leave unrouted (Flags Assignee/Manager)</option>
                  {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEscalateTaskId(null)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={escalateTaskMut.isPending} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg py-2 text-sm transition-colors disabled:opacity-50">Escalate Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
