import { useState } from "react";
import { useLocation } from "wouter";
import { useListUsers, getListUsersQueryKey, useListDepartments, getListDepartmentsQueryKey, useCreateUser, customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, X } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "text-purple-300 bg-purple-400/10 border-purple-400/20",
  hr_admin: "text-blue-300 bg-blue-400/10 border-blue-400/20",
  manager: "text-[hsl(186,100%,42%)] bg-[hsl(186,100%,42%)/10%] border-[hsl(186,100%,42%)/20%]",
  employee: "text-[hsl(215,20%,65%)] bg-[hsl(217,32%,17%)] border-[hsl(217,32%,22%)]",
};

function roleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function initials(name: string) {
  return name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
}

// Removed auto-calculation logic for manual input

export default function EmployeesPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "employee", jobTitle: "", departmentId: "", teamId: "", managerId: "", managerAssignedFrom: "", hireDate: "", dateOfBirth: "", standardWorkingHours: "8", workStartTime: "09:00", workEndTime: "17:00", homeLocation: "", officeLocation: "", distanceFromHome: "", education: "", gender: "", numCompaniesWorked: "", jobLevel: "", totalWorkingYearsBeforeHire: "", yearsSinceLastPromotion: "" });

  const qc = useQueryClient();
  const { data: users = [], isLoading } = useListUsers({ search, ...(deptFilter ? { departmentId: Number(deptFilter) } : {}) }, { query: { queryKey: getListUsersQueryKey({ search, departmentId: deptFilter ? Number(deptFilter) : undefined }) } });
  const { data: departments = [] } = useListDepartments({ query: { queryKey: getListDepartmentsQueryKey() } });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await customFetch("/api/v1/teams") as Response;
      return res.ok ? res.json() : [];
    }
  });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setShowCreate(false);
        setForm({ name: "", email: "", role: "employee", jobTitle: "", departmentId: "", teamId: "", managerId: "", managerAssignedFrom: "", hireDate: "", dateOfBirth: "", standardWorkingHours: "8", workStartTime: "09:00", workEndTime: "17:00", homeLocation: "", officeLocation: "", distanceFromHome: "", education: "", gender: "", numCompaniesWorked: "", jobLevel: "", totalWorkingYearsBeforeHire: "", yearsSinceLastPromotion: "" });
      },
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        name: form.name, email: form.email, role: form.role,
        jobTitle: form.jobTitle || undefined,
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
        teamId: form.teamId ? Number(form.teamId) : undefined,
        managerId: form.managerId ? Number(form.managerId) : undefined,
        managerAssignedFrom: form.managerAssignedFrom || undefined,
        hireDate: form.hireDate || undefined,
        dateOfBirth: form.dateOfBirth,
        homeLocation: form.homeLocation || undefined,
        officeLocation: form.officeLocation || undefined,
        distanceFromHome: form.distanceFromHome ? Number(form.distanceFromHome) : undefined,
        education: form.education ? Number(form.education) : undefined,
        gender: form.gender ? Number(form.gender) : undefined,
        numCompaniesWorked: form.numCompaniesWorked ? Number(form.numCompaniesWorked) : undefined,
        jobLevel: form.jobLevel ? Number(form.jobLevel) : undefined,
        totalWorkingYearsBeforeHire: form.totalWorkingYearsBeforeHire ? Number(form.totalWorkingYearsBeforeHire) : undefined,
        yearsSinceLastPromotion: form.yearsSinceLastPromotion ? Number(form.yearsSinceLastPromotion) : undefined,
        standardWorkingHours: Number(form.standardWorkingHours),
        workStartTime: form.workStartTime || "09:00",
        workEndTime: form.workEndTime || "17:00",
      } as any,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Employees</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">{(users as any[]).length} members</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,20%,45%)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[hsl(215,20%,45%)] focus:outline-none focus:border-[hsl(186,100%,42%)]"
          />
        </div>
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
        >
          <option value="">All Departments</option>
          {(departments as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(217,32%,17%)]">
              {["Employee", "Role", "Department", "Manager", "Hire Date"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[hsl(215,20%,55%)] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">Loading...</td></tr>
            )}
            {!isLoading && (users as any[]).map((u: any) => (
              <tr
                key={u.id}
                onClick={() => navigate(`/employees/${u.id}`)}
                className="border-b border-[hsl(217,32%,15%)] hover:bg-[hsl(217,32%,17%)/50%] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(186,100%,42%)/15%] border border-[hsl(186,100%,42%)/20%] flex items-center justify-center">
                      <span className="text-xs font-bold text-[hsl(186,100%,42%)]">{initials(u.name)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{u.name}</p>
                      <p className="text-xs text-[hsl(215,20%,55%)]">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${ROLE_COLORS[u.role] ?? ""}`}>{roleLabel(u.role)}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{u.departmentName ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{u.managerName ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{u.hireDate ? new Date(u.hireDate).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[hsl(217,32%,22%)]">
              <h2 className="font-semibold text-white">Add Employee</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleCreate} className="space-y-3">
              {[
                { key: "name", label: "Full Name", type: "text", required: true },
                { key: "email", label: "Email", type: "email", required: true },
                { key: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
                { key: "jobTitle", label: "Job Title", type: "text", required: false },
                { key: "hireDate", label: "Hire Date", type: "date", required: false },
                { key: "standardWorkingHours", label: "Daily Working Hours", type: "number", required: true },
              ].map(({ key, label, type, required }) => (
                <div key={key}>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
              ))}
              {/* Work Schedule */}
              <div className="bg-[hsl(217,32%,15%)] border border-[hsl(217,32%,22%)] rounded-lg p-3">
                <p className="text-xs font-semibold text-[hsl(186,100%,42%)] mb-2">🕐 Work Schedule</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Start Time</label>
                    <input
                      type="time"
                      value={form.workStartTime}
                      onChange={e => setForm(f => ({ ...f, workStartTime: e.target.value }))}
                      className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">End Time</label>
                    <input
                      type="time"
                      value={form.workEndTime}
                      onChange={e => setForm(f => ({ ...f, workEndTime: e.target.value }))}
                      className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[hsl(215,20%,45%)] mt-2">Used to automatically detect late clock-ins</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Education Level</label>
                  <select value={form.education} onChange={e => setForm(f => ({ ...f, education: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                    <option value="">None</option>
                    <option value="1">Below College</option>
                    <option value="2">College</option>
                    <option value="3">Bachelor</option>
                    <option value="4">Master</option>
                    <option value="5">Doctor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Gender</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                    <option value="">Select...</option>
                    <option value="0">Female</option>
                    <option value="1">Male</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Job Level</label>
                  <select value={form.jobLevel} onChange={e => setForm(f => ({ ...f, jobLevel: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                    <option value="">Select...</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Total Working Years</label>
                  <input
                    type="number"
                    value={form.totalWorkingYearsBeforeHire}
                    onChange={e => setForm(f => ({ ...f, totalWorkingYearsBeforeHire: e.target.value }))}
                    placeholder="e.g. 5"
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Num Companies Worked</label>
                  <input
                    type="number"
                    value={form.numCompaniesWorked}
                    onChange={e => setForm(f => ({ ...f, numCompaniesWorked: e.target.value }))}
                    placeholder="e.g. 2"
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Yrs Since Last Promotion</label>
                  <input
                    type="number"
                    value={form.yearsSinceLastPromotion}
                    onChange={e => setForm(f => ({ ...f, yearsSinceLastPromotion: e.target.value }))}
                    placeholder="e.g. 1"
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  {["employee", "manager", "hr_admin", "super_admin"].map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Department</label>
                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">None</option>
                  {(departments as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Team</label>
                <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">None</option>
                  {(teams as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Manager</label>
                <select value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
                  <option value="">None</option>
                  {(users as any[]).filter(u => u.role !== 'employee').map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {form.managerId && (
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Manager Assigned From Date</label>
                  <input
                    type="date"
                    value={form.managerAssignedFrom}
                    onChange={e => setForm(f => ({ ...f, managerAssignedFrom: e.target.value }))}
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Home Location</label>
                  <input 
                    type="text"
                    value={form.homeLocation} 
                    onChange={e => setForm(f => ({ ...f, homeLocation: e.target.value }))} 
                    placeholder="e.g. North Suburbs"
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Office Location</label>
                  <input 
                    type="text"
                    value={form.officeLocation} 
                    onChange={e => setForm(f => ({ ...f, officeLocation: e.target.value }))} 
                    placeholder="e.g. Downtown Office"
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Distance From Home (km)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.distanceFromHome}
                  onChange={e => setForm(f => ({ ...f, distanceFromHome: e.target.value }))}
                  placeholder="Enter distance manually"
                  className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-[hsl(217,32%,22%)] mt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
