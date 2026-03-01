import { useState } from "react";
import { useGetOrganizationPerformanceSnapshot, getGetOrganizationPerformanceSnapshotQueryKey, useGetEmployeePerformanceSnapshot, getGetEmployeePerformanceSnapshotQueryKey, useTriggerAppraisal, useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Play, ChevronDown, ChevronRight } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="bg-[hsl(222,47%,8%)] border border-[hsl(217,32%,15%)] rounded-lg p-4 text-xs text-[hsl(186,100%,55%)] overflow-auto max-h-96 font-mono leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function MLApiPage() {
  const qc = useQueryClient();
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [appraisalPeriod, setAppraisalPeriod] = useState("");
  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");

  const { data: users = [] } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() } });
  const { data: orgSnapshot, isLoading: loadOrg } = useGetOrganizationPerformanceSnapshot(undefined, { query: { queryKey: getGetOrganizationPerformanceSnapshotQueryKey() } });
  const { data: empSnapshot, isLoading: loadEmp } = useGetEmployeePerformanceSnapshot(
    selectedEmpId ?? 0,
    { query: { enabled: !!selectedEmpId, queryKey: getGetEmployeePerformanceSnapshotQueryKey(selectedEmpId ?? 0) } }
  );

  const triggerMut = useTriggerAppraisal({
    mutation: { onSuccess: () => alert("Appraisal triggered!") },
  });

  const radarData = empSnapshot?.satisfactionProxyMetrics ? [
    { subject: "Environment", value: (empSnapshot.satisfactionProxyMetrics as any).environmentSatisfactionScore },
    { subject: "Work-Life", value: (empSnapshot.satisfactionProxyMetrics as any).workLifeBalanceScore },
    { subject: "Involvement", value: (empSnapshot.satisfactionProxyMetrics as any).jobInvolvementScore },
    { subject: "Relationships", value: (empSnapshot.satisfactionProxyMetrics as any).relationshipSatisfactionScore },
    { subject: "Job Sat.", value: (empSnapshot.satisfactionProxyMetrics as any).jobSatisfactionScore },
  ] : [];

  const wb = empSnapshot?.workBehaviorMetrics as any;
  const em = empSnapshot?.engagementMetrics as any;
  const ai = empSnapshot?.auditIntegrity as any;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-[hsl(186,100%,42%)]" /> ML Performance API
        </h1>
        <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Structured performance snapshots for external ML pipelines</p>
      </div>

      {/* Trigger appraisal */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Trigger Appraisal Run</h2>
        <div className="flex gap-3">
          <input value={appraisalPeriod} onChange={e => setAppraisalPeriod(e.target.value)} placeholder="Period e.g. 2026-Q2" className="flex-1 bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" />
          <button onClick={() => triggerMut.mutate({ data: { period: appraisalPeriod } as any })} disabled={!appraisalPeriod || triggerMut.isPending} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] text-black font-semibold text-sm rounded-lg px-4 py-2 hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">
            <Play className="w-4 h-4" /> Trigger
          </button>
        </div>
      </div>

      {/* Employee snapshot */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Employee Performance Snapshot</h2>
          <div className="flex gap-1 bg-[hsl(217,32%,17%)] rounded-lg p-1">
            {(["visual", "json"] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === m ? "bg-[hsl(186,100%,42%)] text-black" : "text-[hsl(215,20%,65%)] hover:text-white"}`}>{m}</button>
            ))}
          </div>
        </div>

        <select value={selectedEmpId ?? ""} onChange={e => setSelectedEmpId(Number(e.target.value) || null)} className="bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] mb-4">
          <option value="">Select employee...</option>
          {(users as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {loadEmp && <p className="text-xs text-[hsl(215,20%,45%)]">Loading snapshot...</p>}

        {empSnapshot && viewMode === "json" && <JsonView data={empSnapshot} />}

        {empSnapshot && viewMode === "visual" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-[hsl(217,32%,17%)] rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">{empSnapshot.empName}</p>
                <p className="text-xs text-[hsl(215,20%,55%)]">Period: {empSnapshot.appraisalPeriod} • {empSnapshot.snapshotDate}</p>
              </div>
              {ai && (
                <div className={`flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 ${ai.tamperProofVerified ? "text-green-300 bg-green-400/10 border-green-400/20" : "text-red-300 bg-red-400/10 border-red-400/20"}`}>
                  {ai.tamperProofVerified ? "Verified" : "Unverified"} • {Math.round((ai.dataCompletenessScore ?? 0) * 100)}% complete
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Radar chart */}
              {radarData.length > 0 && (
                <div>
                  <p className="text-xs text-[hsl(215,20%,55%)] mb-2 uppercase tracking-wide">Satisfaction Proxy (1–5)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(217,32%,22%)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(215,20%,55%)", fontSize: 10 }} />
                      <Radar dataKey="value" stroke="hsl(186,100%,42%)" fill="hsl(186,100%,42%)" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Work behavior */}
              {wb && (
                <div>
                  <p className="text-xs text-[hsl(215,20%,55%)] mb-2 uppercase tracking-wide">Work Behavior</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Hours/Week", `${wb.workHoursPerWeek}h`],
                      ["Overtime", `${wb.overtimeHours}h`],
                      ["Tasks On-Time", `${Math.round((wb.tasksCompletedOnTimeRate ?? 0) * 100)}%`],
                      ["Doc On-Time", `${Math.round((wb.onTimeSubmissionRate ?? 0) * 100)}%`],
                      ["Training Count", wb.trainingTimesLastYear],
                      ["Experience", `${wb.totalWorkExperienceYears}y`],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-[hsl(217,32%,17%)] rounded p-2">
                        <p className="text-[10px] text-[hsl(215,20%,45%)]">{label}</p>
                        <p className="text-sm font-bold text-white">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Org snapshot */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Organization Snapshot ({(orgSnapshot as any[])?.length ?? 0} employees)</h2>
        {loadOrg && <p className="text-xs text-[hsl(215,20%,45%)]">Loading...</p>}
        {orgSnapshot && <JsonView data={orgSnapshot} />}
      </div>
    </div>
  );
}
