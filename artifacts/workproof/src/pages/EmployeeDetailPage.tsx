import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch, useGetUser, getGetUserQueryKey, useGetEmployeePerformanceSnapshot, getGetEmployeePerformanceSnapshotQueryKey, useListPromotions, getListPromotionsQueryKey, useListRecognitions, getListRecognitionsQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Award, TrendingUp, Users } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

function initials(name: string) {
  return name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
}

function MetricCard({ label, value, unit = "" }: { label: string; value: number | string | null | undefined; unit?: string }) {
  return (
    <div className="bg-[hsl(217,32%,17%)] rounded-lg p-3">
      <p className="text-[10px] text-[hsl(215,20%,55%)] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value != null ? `${value}${unit}` : "—"}</p>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();

  const { data: user, isLoading } = useGetUser(id, { query: { enabled: !!id, queryKey: getGetUserQueryKey(id) } });
  const { data: snapshot } = useGetEmployeePerformanceSnapshot(id, { query: { enabled: !!id, queryKey: getGetEmployeePerformanceSnapshotQueryKey(id) } });
  const { data: promotions = [] } = useListPromotions({ userId: id }, { query: { queryKey: getListPromotionsQueryKey({ userId: id }) } });
  const { data: recognitions = [] } = useListRecognitions({ recipientId: id }, { query: { queryKey: getListRecognitionsQueryKey({ recipientId: id }) } });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await customFetch("/api/v1/teams") as any;
      return res.ok ? res.json() : [];
    }
  });

  const { data: managerHistory = [] } = useQuery({
    queryKey: ["manager-history", id],
    queryFn: async () => {
      const res = await customFetch(`/api/v1/users/${id}/manager-history`) as any;
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  const radarData = snapshot?.satisfactionProxyMetrics ? [
    { subject: "Environment", value: (snapshot.satisfactionProxyMetrics as any).environmentSatisfactionScore ?? 0 },
    { subject: "Work-Life", value: (snapshot.satisfactionProxyMetrics as any).workLifeBalanceScore ?? 0 },
    { subject: "Involvement", value: (snapshot.satisfactionProxyMetrics as any).jobInvolvementScore ?? 0 },
    { subject: "Relationships", value: (snapshot.satisfactionProxyMetrics as any).relationshipSatisfactionScore ?? 0 },
    { subject: "Job Sat.", value: (snapshot.satisfactionProxyMetrics as any).jobSatisfactionScore ?? 0 },
  ] : [];

  if (isLoading) return <div className="p-6 text-[hsl(215,20%,55%)] text-sm">Loading...</div>;
  if (!user) return <div className="p-6 text-[hsl(215,20%,55%)] text-sm">Employee not found</div>;

  const wb = snapshot?.workBehaviorMetrics as any;
  const em = snapshot?.engagementMetrics as any;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate("/employees")} className="flex items-center gap-2 text-sm text-[hsl(215,20%,55%)] hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Employees
      </button>

      {/* Profile card */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-[hsl(186,100%,42%)/15%] border-2 border-[hsl(186,100%,42%)/30%] flex items-center justify-center">
          <span className="text-xl font-bold text-[hsl(186,100%,42%)]">{initials(user.name as string)}</span>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{user.name}</h1>
          <p className="text-sm text-[hsl(215,20%,55%)]">
            {(user as any).jobTitle ?? "No title"} • {(user as any).departmentName ?? "No department"} 
            {(user as any).teamId ? ` • ${teams.find((t: any) => t.id === (user as any).teamId)?.name ?? "Unknown Team"}` : ""}
          </p>
          <p className="text-xs text-[hsl(215,20%,45%)] mt-1">{user.email}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[hsl(215,20%,55%)]">Hire Date</p>
          <p className="text-sm font-medium text-white">{(user as any).hireDate ? new Date((user as any).hireDate).toLocaleDateString() : "—"}</p>
        </div>
      </div>

      {/* Work behavior metrics */}
      {wb && (
        <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[hsl(186,100%,42%)]" /> Work Behavior Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCard label="Work Hrs / Week" value={wb.workHoursPerWeek} unit="h" />
            <MetricCard label="Overtime Hours" value={wb.overtimeHours} unit="h" />
            <MetricCard label="Sick Days" value={wb.sickDays} />
            <MetricCard label="Projects Handled" value={wb.projectsHandled} />
            <MetricCard label="Tasks On Time" value={wb.tasksCompletedOnTimeRate != null ? `${Math.round(wb.tasksCompletedOnTimeRate * 100)}%` : null} />
            <MetricCard label="Doc On Time" value={wb.onTimeSubmissionRate != null ? `${Math.round(wb.onTimeSubmissionRate * 100)}%` : null} />
            <MetricCard label="Training Count" value={wb.trainingTimesLastYear} />
            <MetricCard label="Experience Yrs" value={wb.totalWorkExperienceYears} unit="y" />
            <MetricCard label="Standard Hrs/Day" value={(user as any).standardWorkingHours ?? 8} unit="h" />
          </div>
        </div>
      )}

      {/* Engagement + Radar */}
      {em && radarData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Engagement Metrics</h2>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Meeting Attendance" value={em.meetingAttendanceRate != null ? `${Math.round(em.meetingAttendanceRate * 100)}%` : null} />
              <MetricCard label="Collab Score" value={em.collaborationScore} />
              <MetricCard label="Communication" value={em.communicationFrequencyScore} />
              <MetricCard label="Action Items" value={em.actionItemsCompletedRate != null ? `${Math.round(em.actionItemsCompletedRate * 100)}%` : null} />
            </div>
          </div>
          <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-2">Satisfaction Proxy (1–5)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(217,32%,22%)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                <Radar dataKey="value" stroke="hsl(186,100%,42%)" fill="hsl(186,100%,42%)" fillOpacity={0.2} />
                <Tooltip contentStyle={{ background: "hsl(222,47%,11%)", border: "1px solid hsl(217,32%,22%)", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Promotions & Recognitions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Promotion History</h2>
          {(promotions as any[]).length === 0 ? (
            <p className="text-xs text-[hsl(215,20%,45%)]">No promotions yet</p>
          ) : (
            <div className="space-y-2">
              {(promotions as any[]).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-[hsl(217,32%,15%)] last:border-0">
                  <div>
                    <p className="text-xs text-white">{p.oldRole} <span className="text-[hsl(186,100%,42%)]">→</span> {p.newRole}</p>
                    <p className="text-[10px] text-[hsl(215,20%,45%)]">by {p.promotedByName}</p>
                  </div>
                  <span className="text-[10px] text-[hsl(215,20%,45%)]">{new Date(p.promotedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-[hsl(186,100%,42%)]" /> Recognitions</h2>
          {(recognitions as any[]).length === 0 ? (
            <p className="text-xs text-[hsl(215,20%,45%)]">No recognitions yet</p>
          ) : (
            <div className="space-y-2">
              {(recognitions as any[]).map((r: any) => (
                <div key={r.id} className="bg-[hsl(217,32%,17%)] rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[hsl(186,100%,42%)]">{r.badge}</span>
                    <span className="text-[10px] text-[hsl(215,20%,45%)]">from {r.giverName}</span>
                  </div>
                  {r.message && <p className="text-[10px] text-[hsl(215,20%,55%)] mt-0.5">{r.message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manager History */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-[hsl(186,100%,42%)]" /> Manager Assignment History</h2>
        {managerHistory.length === 0 ? (
          <p className="text-xs text-[hsl(215,20%,45%)]">No manager history recorded</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[hsl(217,32%,17%)]">
            <table className="w-full text-left">
              <thead className="bg-[hsl(217,32%,17%)]">
                <tr>
                  <th className="px-4 py-2 text-[10px] font-medium text-[hsl(215,20%,55%)] uppercase">Manager Name</th>
                  <th className="px-4 py-2 text-[10px] font-medium text-[hsl(215,20%,55%)] uppercase">Assigned From</th>
                  <th className="px-4 py-2 text-[10px] font-medium text-[hsl(215,20%,55%)] uppercase">Assigned Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(217,32%,17%)]">
                {managerHistory.map((h: any) => (
                  <tr key={h.id} className="hover:bg-[hsl(217,32%,17%)/50%] transition-colors">
                    <td className="px-4 py-2 text-xs text-white">{h.managerName ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-[hsl(215,20%,55%)]">{new Date(h.assignedFrom).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-xs text-[hsl(215,20%,55%)]">
                      {h.assignedUntil ? new Date(h.assignedUntil).toLocaleDateString() : <span className="text-[hsl(186,100%,42%)]">Current</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
