import { useState } from "react";
import { useListMeetings, getListMeetingsQueryKey, useCreateMeeting, useRespondToMeeting, useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Calendar, Check, XCircle, Clock, Video } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "text-blue-300 bg-blue-400/10 border-blue-400/20",
  in_progress: "text-[hsl(186,100%,42%)] bg-[hsl(186,100%,42%)/10%] border-[hsl(186,100%,42%)/20%]",
  completed: "text-green-300 bg-green-400/10 border-green-400/20",
  cancelled: "text-red-300 bg-red-400/10 border-red-400/20",
};

export default function MeetingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", scheduledAt: "", durationMinutes: "30", agenda: "", attendeeIds: [] as number[] });

  const { data: meetings = [], isLoading } = useListMeetings({}, { query: { queryKey: getListMeetingsQueryKey() } });
  const { data: users = [] } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() } });

  const createMut = useCreateMeeting({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
        setShowCreate(false);
        setForm({ title: "", scheduledAt: "", durationMinutes: "30", agenda: "", attendeeIds: [] });
      },
    },
  });
  const respondMut = useRespondToMeeting({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() }) },
  });

  const sorted = [...(meetings as any[])].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const getMyResponse = (meeting: any): string | undefined => {
    const att = (meeting.attendees ?? []).find((a: any) => a.userId === user?.id);
    return att?.response;
  };

  const toggleAttendee = (userId: number) => {
    setForm(f => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(userId)
        ? f.attendeeIds.filter(id => id !== userId)
        : [...f.attendeeIds, userId],
    }));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Meetings</h1>
          <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">{(meetings as any[]).length} meetings</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors">
          <Plus className="w-4 h-4" /> Schedule Meeting
        </button>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-[hsl(215,20%,45%)]">Loading...</p>}
        {sorted.length === 0 && !isLoading && <p className="text-sm text-[hsl(215,20%,45%)]">No meetings scheduled</p>}
        {sorted.map((meeting: any) => {
          const myResponse = getMyResponse(meeting);
          const isAttendee = (meeting.attendees ?? []).some((a: any) => a.userId === user?.id);
          const accepted = (meeting.attendees ?? []).filter((a: any) => a.response === "accepted").length;
          const st = STATUS_COLORS[meeting.status] ?? STATUS_COLORS.scheduled;
          return (
            <div key={meeting.id} className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${st}`}>{meeting.status}</span>
                    <span className="text-xs text-[hsl(215,20%,45%)]">{accepted}/{(meeting.attendees ?? []).length} accepted</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{meeting.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-[hsl(215,20%,55%)]">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(meeting.scheduledAt).toLocaleString()}</span>
                    {meeting.durationMinutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meeting.durationMinutes}min</span>}
                    <span>Org: {meeting.organizerName}</span>
                  </div>
                  {meeting.agenda && <p className="text-xs text-[hsl(215,20%,45%)] mt-1.5 italic">{meeting.agenda}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {isAttendee && meeting.status === "scheduled" && (
                    <div className="flex gap-2">
                      <button onClick={() => respondMut.mutate({ id: meeting.id, data: { response: "accepted" } as any })} className={`flex items-center gap-1 text-xs rounded px-2 py-1 border transition-colors ${myResponse === "accepted" ? "bg-green-400/20 border-green-400/30 text-green-300" : "border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] hover:border-green-400/30 hover:text-green-300"}`}>
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button onClick={() => respondMut.mutate({ id: meeting.id, data: { response: "declined" } as any })} className={`flex items-center gap-1 text-xs rounded px-2 py-1 border transition-colors ${myResponse === "declined" ? "bg-red-400/10 border-red-400/30 text-red-400" : "border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] hover:border-red-400/30 hover:text-red-400"}`}>
                        <XCircle className="w-3 h-3" /> Decline
                      </button>
                    </div>
                  )}
                  {isAttendee && ["scheduled", "in_progress"].includes(meeting.status) && myResponse !== "declined" && (
                    <Link
                      to={`/meetings/${meeting.id}/room`}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-[hsl(186,100%,42%)] text-black px-3 py-1.5 rounded-lg hover:bg-[hsl(186,100%,38%)] transition-colors mt-2"
                    >
                      <Video className="w-3.5 h-3.5" /> Join Room
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-white">Schedule Meeting</h2>
              <button onClick={() => setShowCreate(false)} className="text-[hsl(215,20%,55%)] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMut.mutate({ data: { title: form.title, scheduledAt: form.scheduledAt, durationMinutes: Number(form.durationMinutes), agenda: form.agenda || undefined, attendeeIds: form.attendeeIds } as any }); }} className="space-y-3">
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Title</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Date & Time</label><input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} required className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" /></div>
                <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Duration (min)</label><input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]" /></div>
              </div>
              <div><label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Agenda</label><textarea value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} rows={2} className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)] resize-none" /></div>
              <div>
                <label className="block text-xs text-[hsl(215,20%,55%)] mb-1">Attendees</label>
                <div className="max-h-32 overflow-y-auto space-y-1 bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg p-2">
                  {(users as any[]).filter((u: any) => u.id !== user?.id).map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:text-white text-[hsl(215,20%,65%)] text-xs py-0.5">
                      <input type="checkbox" checked={form.attendeeIds.includes(u.id)} onChange={() => toggleAttendee(u.id)} className="accent-[hsl(186,100%,42%)]" />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-[hsl(217,32%,22%)] text-[hsl(215,20%,65%)] rounded-lg py-2 text-sm hover:bg-[hsl(217,32%,17%)] transition-colors">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="flex-1 bg-[hsl(186,100%,42%)] text-black font-semibold rounded-lg py-2 text-sm hover:bg-[hsl(186,100%,38%)] transition-colors disabled:opacity-50">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
