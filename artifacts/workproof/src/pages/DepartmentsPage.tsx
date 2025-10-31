import { useState } from "react";
import { useListDepartments, getListDepartmentsQueryKey, useCreateDepartment, useUpdateDepartment, useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Building2, Pencil } from "lucide-react";

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", headId: "" });

  const { data: departments = [], isLoading } = useListDepartments({ query: { queryKey: getListDepartmentsQueryKey() } });
  const { data: users = [] } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() } });

  const createMut = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
        setShowCreate(false);
        setForm({ name: "", headId: "" });
      },
    },
  });
  const updateMut = useUpdateDepartment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
        setEditId(null);
        setForm({ name: "", headId: "" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, headId: form.headId ? Number(form.headId) : undefined } as any;
    if (editId) {
      updateMut.mutate({ id: editId, data });
    } else {
      createMut.mutate({ data });
    }
  };

  const openEdit = (dept: any) => {
    setEditId(dept.id);
    setForm({ name: dept.name, headId: dept.headId?.toString() ?? "" });
    setShowCreate(true);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Departments</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">{(departments as any[]).length} departments</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditId(null); setForm({ name: "", headId: "" }); }} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-sm text-[hsl(215,20%,45%)]">Loading...</p>}
        {(departments as any[]).map((d: any) => (
          <div key={d.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4 hover:border-[hsl(186,100%,42%)/30%] transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(186,100%,42%)/10%] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[hsl(186,100%,42%)]" />
              </div>
              <button onClick={() => openEdit(d)} className="text-[hsl(215,20%,45%)] hover:text-white transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <h3 className="font-semibold text-white text-sm">{d.name}</h3>
            <p className="text-xs text-[hsl(215,20%,55%)] mt-1">{d.employeeCount ?? 0} employees</p>
            {d.headName && <p className="text-xs text-[hsl(215,20%,45%)] mt-0.5">Head: {d.headName}</p>}
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">{editId ? "Edit Department" : "Add Department"}</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Department Head</label>
                <select value={form.headId} onChange={e => setForm(f => ({ ...f, headId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
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
