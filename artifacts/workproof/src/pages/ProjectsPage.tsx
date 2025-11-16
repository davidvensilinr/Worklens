import { useState } from "react";
import { useListProjects, getListProjectsQueryKey, useCreateProject, useUpdateProject, useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Folder } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-300 bg-green-400/10 border-green-400/20",
  completed: "text-[hsl(186,100%,42%)] bg-[hsl(186,100%,42%)/10%] border-[hsl(186,100%,42%)/20%]",
  on_hold: "text-yellow-300 bg-yellow-400/10 border-yellow-400/20",
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", managerId: "" });

  const { data: projects = [], isLoading } = useListProjects({ query: { queryKey: getListProjectsQueryKey() } });
  const { data: users = [] } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() } });

  const createMut = useCreateProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setShowCreate(false);
        setForm({ title: "", description: "", deadline: "", managerId: "" });
      },
    },
  });
  const updateMut = useUpdateProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setEditProject(null);
        setForm({ title: "", description: "", deadline: "", managerId: "" });
      },
    },
  });

  const openEdit = (proj: any) => {
    setEditProject(proj);
    setForm({
      title: proj.title,
      description: proj.description ?? "",
      deadline: proj.deadline ? new Date(proj.deadline).toISOString().split("T")[0] : "",
      managerId: proj.managerId?.toString() ?? "",
    });
    setShowCreate(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      title: form.title,
      description: form.description || undefined,
      deadline: form.deadline || undefined,
      managerId: form.managerId ? Number(form.managerId) : undefined,
    };
    if (editProject) updateMut.mutate({ id: editProject.id, data });
    else createMut.mutate({ data });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Projects</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">{(projects as any[]).length} projects</p>
        </div>
        <button onClick={() => { setEditProject(null); setForm({ title: "", description: "", deadline: "", managerId: "" }); setShowCreate(true); }} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-sm text-[hsl(215,20%,45%)]">Loading...</p>}
        {(projects as any[]).map((proj: any) => {
          const progress = proj.taskCount > 0 ? Math.round((proj.completedTaskCount / proj.taskCount) * 100) : 0;
          return (
            <div key={proj.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4 hover:border-[hsl(217,32%,25%)] transition-colors cursor-pointer" onClick={() => openEdit(proj)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-[hsl(186,100%,42%)/10%] flex items-center justify-center">
                  <Folder className="w-4.5 h-4.5 text-[hsl(186,100%,42%)]" />
                </div>
                <span className={`text-[10px] border rounded-full px-2 py-0.5 ${STATUS_COLORS[proj.status] ?? ""}`}>{proj.status?.replace(/_/g, " ")}</span>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">{proj.title}</h3>
              {proj.description && <p className="text-xs text-[hsl(215,20%,55%)] mb-3 line-clamp-2">{proj.description}</p>}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[hsl(215,20%,55%)]">
                  <span>{proj.completedTaskCount}/{proj.taskCount} tasks</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-[hsl(217,32%,20%)] rounded-full overflow-hidden">
                  <div className="h-full bg-[hsl(186,100%,42%)] rounded-full" style={{ width: `${progress}%` }} />
                </div>
                {proj.deadline && <p className="text-[10px] text-[hsl(215,20%,45%)]">Due: {new Date(proj.deadline).toLocaleDateString()}</p>}
                {proj.managerName && <p className="text-[10px] text-[hsl(215,20%,45%)]">Manager: {proj.managerName}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">{editProject ? "Edit Project" : "New Project"}</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
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
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Manager</label>
                  <select value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                    <option value="">None</option>
                    {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {editProject && (
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Status</label>
                  <select onChange={e => updateMut.mutate({ id: editProject.id, data: { status: e.target.value } as any })} defaultValue={editProject.status} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                    {["active", "completed", "on_hold"].map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors">
                  {editProject ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
