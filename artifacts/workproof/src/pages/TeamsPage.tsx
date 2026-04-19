import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, useListUsers, getListUsersQueryKey, useListDepartments, getListDepartmentsQueryKey } from "@workspace/api-client-react";
import { Plus, X, Users, Pencil } from "lucide-react";

export default function TeamsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", departmentId: "", leadId: "" });

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await customFetch("/api/v1/teams") as Response;
      if (!res.ok) throw new Error("Failed to load teams");
      return res.json();
    }
  });

  const { data: users = [] } = useListUsers();
  const { data: departments = [] } = useListDepartments({ query: { queryKey: getListDepartmentsQueryKey() } });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await customFetch("/api/v1/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }) as Response;
      if (!res.ok) throw new Error("Failed to create team");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setShowCreate(false);
      setForm({ name: "", departmentId: "", leadId: "" });
    }
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await customFetch(`/api/v1/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }) as Response;
      if (!res.ok) throw new Error("Failed to update team");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setEditId(null);
      setForm({ name: "", departmentId: "", leadId: "" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { 
      name: form.name, 
      departmentId: Number(form.departmentId),
      leadId: form.leadId ? Number(form.leadId) : undefined 
    };
    if (editId) {
      updateMut.mutate({ id: editId, data });
    } else {
      createMut.mutate(data);
    }
  };

  const openEdit = (team: any) => {
    setEditId(team.id);
    setForm({ 
      name: team.name, 
      departmentId: team.departmentId?.toString() ?? "",
      leadId: team.leadId?.toString() ?? "" 
    });
    setShowCreate(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Teams</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">{(teams as any[]).length} teams across departments</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditId(null); setForm({ name: "", departmentId: "", leadId: "" }); }} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
          <Plus className="w-4 h-4" /> Create Team
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-sm text-[hsl(215,20%,45%)]">Loading...</p>}
        {(teams as any[]).map((t: any) => (
          <div key={t.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4 hover:border-[hsl(186,100%,42%)/30%] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(186,100%,42%)/10%] flex items-center justify-center">
                <Users className="w-5 h-5 text-[hsl(186,100%,42%)]" />
              </div>
              <button onClick={() => openEdit(t)} className="text-[hsl(215,20%,45%)] hover:text-white transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <h3 className="font-semibold text-white text-sm">{t.name}</h3>
            <p className="text-xs text-[hsl(215,20%,55%)] mt-1">Dept: {t.departmentName}</p>
            {t.leadName && <p className="text-xs text-[hsl(215,20%,45%)] mt-0.5">Lead: {t.leadName}</p>}
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">{editId ? "Edit Team" : "Create Team"}</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Department</label>
                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">Select Department</option>
                  {(departments as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Team Lead (Optional)</label>
                <select value={form.leadId} onChange={e => setForm(f => ({ ...f, leadId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">None</option>
                  {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors">
                  {editId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
