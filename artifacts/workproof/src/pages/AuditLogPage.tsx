import { useState } from "react";
import { useListAuditLog, getListAuditLogQueryKey, useVerifyAuditIntegrity, getVerifyAuditIntegrityQueryKey } from "@workspace/api-client-react";
import { Shield, CheckCircle, XCircle, Hash } from "lucide-react";

export default function AuditLogPage() {
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const { data: entries = [], isLoading } = useListAuditLog(
    { limit: 100 },
    { query: { queryKey: getListAuditLogQueryKey({ limit: 100 }) } }
  );

  const { data: integrity, refetch: refetchIntegrity, isFetching: verifying } = useVerifyAuditIntegrity({
    query: {
      enabled: false,
      queryKey: getVerifyAuditIntegrityQueryKey(),
    },
  });

  const handleVerify = async () => {
    const result = await refetchIntegrity();
    setVerifyResult(result.data);
  };

  const filtered = eventTypeFilter
    ? (entries as any[]).filter((e: any) => e.eventType.includes(eventTypeFilter))
    : (entries as any[]);

  const uniqueTypes = [...new Set((entries as any[]).map((e: any) => e.eventType))].sort();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Audit Log</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Blockchain-style tamper-proof event chain</p>
        </div>
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-2 border border-[hsl(186,100%,42%)/30%] text-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,42%)/10%] text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
        >
          <Shield className="w-4 h-4" /> {verifying ? "Verifying..." : "Verify Integrity"}
        </button>
      </div>

      {/* Integrity result */}
      {verifyResult && (
        <div className={`rounded-xl border p-4 mb-4 flex items-center gap-3 ${verifyResult.verified ? "border-green-400/20 bg-green-400/10" : "border-red-400/20 bg-red-400/10"}`}>
          {verifyResult.verified ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
          <div>
            <p className={`text-sm font-medium ${verifyResult.verified ? "text-green-300" : "text-red-300"}`}>{verifyResult.message}</p>
            <p className="text-xs text-[hsl(215,20%,55%)] mt-0.5">{verifyResult.totalEntries} entries checked</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4">
        <select value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)} className="bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]">
          <option value="">All Event Types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(217,32%,17%)]">
              {["#", "Actor", "Event", "Entity", "Timestamp", "Hash"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[hsl(215,20%,55%)] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">Loading...</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">No audit entries found</td></tr>}
            {filtered.map((entry: any) => (
              <tr key={entry.id} className="border-b border-[hsl(217,32%,15%)] last:border-0 hover:bg-[hsl(217,32%,17%)/30%] transition-colors font-mono text-xs">
                <td className="px-4 py-2.5 text-[hsl(215,20%,45%)]">{entry.id}</td>
                <td className="px-4 py-2.5 text-[hsl(215,20%,65%)]">{entry.actorName ?? entry.actorId}</td>
                <td className="px-4 py-2.5">
                  <span className="text-[hsl(186,100%,42%)]">{entry.eventType}</span>
                </td>
                <td className="px-4 py-2.5 text-[hsl(215,20%,55%)]">{entry.entityId ?? "—"}</td>
                <td className="px-4 py-2.5 text-[hsl(215,20%,55%)]">{new Date(entry.timestamp).toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <Hash className="w-3 h-3 text-[hsl(215,20%,45%)]" />
                    <span className="text-[hsl(215,20%,45%)] truncate max-w-[100px]">{entry.hash?.slice(0, 12)}...</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
