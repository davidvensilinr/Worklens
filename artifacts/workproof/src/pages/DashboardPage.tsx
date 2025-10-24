import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useGetDepartmentMetrics, getGetDepartmentMetricsQueryKey, useGetRiskFlags, getGetRiskFlagsQueryKey, useGetRecentActivity, getGetRecentActivityQueryKey, customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, Folder, CheckSquare, AlertTriangle, Clock, Award, TrendingUp, Activity, CameraOff } from "lucide-react";

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent?: boolean }) {
  return (
    <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[hsl(215,20%,55%)] uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-2xl font-bold ${accent ? "text-[hsl(186,100%,42%)]" : "text-white"}`}>{value}</p>
          {sub && <p className="text-xs text-[hsl(215,20%,55%)] mt-0.5">{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-lg bg-[hsl(186,100%,42%)/10%] flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-[hsl(186,100%,42%)]" />
        </div>
      </div>
    </div>
  );
}

const RISK_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  low: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

function pct(val: number | null | undefined) {
  if (val == null) return "N/A";
  return `${Math.round(val * 100)}%`;
}

export default function DashboardPage() {
  const { data: summary, isLoading: loadingSum } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: deptMetrics } = useGetDepartmentMetrics({ query: { queryKey: getGetDepartmentMetricsQueryKey() } });
  const { data: riskFlags } = useGetRiskFlags({ query: { queryKey: getGetRiskFlagsQueryKey() } });
  const { data: recentActivity } = useGetRecentActivity({ query: { queryKey: getGetRecentActivityQueryKey() } });

  const { data: attendanceWarnings = [] } = useQuery({
    queryKey: ["attendanceWarnings"],
    queryFn: async () => {
      const res = (await customFetch("/api/v1/attendance/warnings")) as Response;
      return res.json();
    }
  });

  const chartData = deptMetrics?.map((d: any) => ({
    name: d.departmentName,
    "On-Time Tasks": Math.round((d.avgTaskOnTimeRate ?? 0) * 100),
    "Doc Approval": Math.round((d.avgDocumentApprovalRate ?? 0) * 100),
    "Training": Math.round((d.avgTrainingCompletionRate ?? 0) * 100),
  })) ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">HR Dashboard</h1>
        <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Real-time organizational performance overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Employees" value={summary?.totalEmployees ?? "—"} icon={Users} />
        <StatCard label="Active Projects" value={summary?.activeProjects ?? "—"} icon={Folder} />
        <StatCard label="Tasks Overdue" value={summary?.tasksOverdue ?? "—"} icon={AlertTriangle} accent={!!summary?.tasksOverdue} />
        <StatCard label="Avg On-Time Rate" value={pct(summary?.avgTaskOnTimeRate)} icon={TrendingUp} />
        <StatCard label="Attendance Today" value={pct(summary?.attendanceRateToday)} icon={Clock} />
        <StatCard label="Completed This Month" value={summary?.tasksCompletedThisMonth ?? "—"} sub="tasks" icon={CheckSquare} />
        <StatCard label="Recognitions" value={summary?.recognitionsThisMonth ?? "—"} sub="this month" icon={Award} />
        <StatCard label="Departments" value={summary?.totalDepartments ?? "—"} icon={Activity} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Department metrics chart */}
        <div className="lg:col-span-2 bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-4">Department Performance (%)</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,32%,20%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(222,47%,11%)", border: "1px solid hsl(217,32%,22%)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="On-Time Tasks" fill="hsl(186,100%,42%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Doc Approval" fill="hsl(186,80%,30%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Training" fill="hsl(217,32%,30%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-[hsl(215,20%,45%)] text-sm">No department data yet</div>
          )}
        </div>

        {/* Risk flags and Warnings column */}
        <div className="space-y-6">
          <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-4">Risk Flags</h2>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {(riskFlags as any[])?.length ? (riskFlags as any[]).map((flag: any) => (
                <div key={flag.userId} className={`border rounded-lg px-3 py-2 ${RISK_COLORS[flag.riskLevel]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{flag.userName}</span>
                    <span className="text-[10px] uppercase font-bold">{flag.riskLevel}</span>
                  </div>
                  <p className="text-[10px] opacity-80">{flag.reasons[0]}</p>
                </div>
              )) : (
                <p className="text-xs text-[hsl(215,20%,45%)]">No risk flags — all green</p>
              )}
            </div>
          </div>

          <div className="bg-[hsl(222,47%,13%)] border border-orange-500/30 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-4">
              <CameraOff className="w-4 h-4" /> Attendance Warnings
            </h2>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {attendanceWarnings.length ? attendanceWarnings.map((warn: any) => (
                <div key={warn.id} className="border border-orange-400/20 bg-orange-400/10 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-orange-300">{warn.userName}</span>
                    <span className="text-[10px] uppercase font-bold text-orange-400">&gt;24H UNVERIFIED</span>
                  </div>
                  <p className="text-[10px] text-orange-200/80">Photo from {new Date(warn.clockIn).toLocaleDateString()} has not been verified by peers.</p>
                </div>
              )) : (
                <p className="text-xs text-[hsl(215,20%,45%)]">No pending photo verifications &gt; 24h.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-1">
          {(recentActivity as any[])?.slice(0, 15).map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-[hsl(217,32%,15%)] last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(186,100%,42%)] flex-shrink-0" />
              <span className="text-xs text-[hsl(215,20%,75%)] flex-1">{item.description}</span>
              <span className="text-[10px] text-[hsl(215,20%,45%)] flex-shrink-0">
                {new Date(item.timestamp).toLocaleDateString()}
              </span>
            </div>
          )) ?? <p className="text-xs text-[hsl(215,20%,45%)]">No activity yet</p>}
        </div>
      </div>
    </div>
  );
}
