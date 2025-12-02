import { useState, useRef } from "react";
import { useListAttendance, getListAttendanceQueryKey, useCreateAttendance, useClockOut, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut, Wifi, Heart, Sun, MapPin, Loader2, X, CheckCircle2, AlertCircle, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Webcam from "react-webcam";

export default function AttendancePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [isRemote, setIsRemote] = useState(false);
  const [isSick, setIsSick] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const { data: records = [], isLoading } = useListAttendance({}, { query: { queryKey: getListAttendanceQueryKey() } });

  const clockInMut = useCreateAttendance({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }) },
  });
  const clockOutMut = useClockOut({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() }) },
  });

  const todayRecords = (records as any[]).filter((r: any) => r.userId === user?.id && r.date === today);
  const activeRecord = todayRecords.find((r: any) => !r.clockOut);
  const myClockedIn = !!activeRecord;
  const totalHoursToday = todayRecords.reduce((sum: number, r: any) => sum + (r.hoursWorked || 0), 0);

  const handleClockIn = () => {
    setShowCamera(true);
  };

  const handleCaptureAndSubmit = async () => {
    setIsSubmitting(true);
    setIsLocating(true);

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      alert("Failed to capture photo. Please ensure camera permissions are granted.");
      setIsSubmitting(false);
      setIsLocating(false);
      return;
    }

    // Convert base64 to Blob
    const res = await fetch(imageSrc);
    const blob = await res.blob();

    const submitWithLocation = async (lat: number | null, lng: number | null) => {
      try {
        const formData = new FormData();
        formData.append("photo", blob, "photo.jpg");
        formData.append("date", today);
        formData.append("isRemote", String(isRemote));
        formData.append("isSick", String(isSick));
        if (lat !== null) formData.append("latitude", String(lat));
        if (lng !== null) formData.append("longitude", String(lng));

        await customFetch("/api/v1/attendance", {
          method: "POST",
          body: formData as any,
        });

        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        setShowCamera(false);
      } catch (err) {
        console.error("Clock in failed:", err);
        alert("Failed to clock in. Please try again.");
      } finally {
        setIsSubmitting(false);
        setIsLocating(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => submitWithLocation(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          console.warn("Geolocation error, submitting without location:", err);
          submitWithLocation(null, null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      submitWithLocation(null, null);
    }
  };

  const handleClockOut = () => {
    if (activeRecord) clockOutMut.mutate({ id: activeRecord.id });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Attendance</h1>
        <p className="text-sm text-[hsl(215,20%,55%)] mt-0.5">Track daily presence and hours worked</p>
      </div>

      {/* Today's panel */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Today — {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h2>
            {myClockedIn && <p className="text-xs text-[hsl(186,100%,42%)] mt-0.5">Clocked in at {new Date(activeRecord.clockIn).toLocaleTimeString()}</p>}
            {totalHoursToday > 0 && <p className="text-xs text-[hsl(215,20%,55%)] mt-0.5">Worked {totalHoursToday.toFixed(1)}h</p>}
          </div>
          <div className="flex items-center gap-2">
            {!myClockedIn && (
              <>
                <label className="flex items-center gap-1.5 text-xs text-[hsl(215,20%,65%)] cursor-pointer">
                  <input type="checkbox" checked={isRemote} onChange={e => setIsRemote(e.target.checked)} className="accent-[hsl(186,100%,42%)]" />
                  <Wifi className="w-3 h-3" /> Remote
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[hsl(215,20%,65%)] cursor-pointer">
                  <input type="checkbox" checked={isSick} onChange={e => setIsSick(e.target.checked)} className="accent-[hsl(186,100%,42%)]" />
                  <Heart className="w-3 h-3" /> Sick
                </label>
                <button onClick={handleClockIn} disabled={clockInMut.isPending || isLocating} className="flex items-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                  {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} 
                  {isLocating ? "Locating..." : "Clock In"}
                </button>
              </>
            )}
            {myClockedIn && (
              <button onClick={handleClockOut} disabled={clockOutMut.isPending} className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 text-red-400 hover:bg-red-500/30 text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-50">
                <LogOut className="w-4 h-4" /> Clock Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Records table */}
      <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(217,32%,17%)]">
              {["Employee", "Date", "Clock In", "Location", "Clock Out", "Hours", "Type"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[hsl(215,20%,55%)] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">Loading...</td></tr>}
            {!isLoading && (records as any[]).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[hsl(215,20%,45%)]">No records yet</td></tr>}
            {(records as any[]).slice(0, 50).map((r: any) => (
              <tr key={r.id} className="border-b border-[hsl(217,32%,15%)] last:border-0 hover:bg-[hsl(217,32%,17%)/30%] transition-colors">
                <td className="px-4 py-3 text-sm text-white">{r.userName ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{r.date}</td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{r.clockIn ? new Date(r.clockIn).toLocaleTimeString() : "—"}</td>
                <td className="px-4 py-3 text-sm">
                  {r.latitude && r.longitude ? (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[hsl(186,100%,42%)] hover:underline bg-[hsl(186,100%,42%)/10%] px-2 py-1 rounded-md"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      View Map
                    </a>
                  ) : (
                    <span className="text-[hsl(215,20%,45%)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{r.clockOut ? new Date(r.clockOut).toLocaleTimeString() : <span className="text-[hsl(186,100%,42%)] text-xs">Active</span>}</td>
                <td className="px-4 py-3 text-sm text-[hsl(215,20%,65%)]">{r.hoursWorked ? `${r.hoursWorked.toFixed(1)}h` : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {r.isLate && <span className="text-[10px] text-red-300 bg-red-400/10 border border-red-400/20 rounded-full px-1.5 py-0.5">Late {r.minutesLate}m</span>}
                    {r.isOvertime && <span className="text-[10px] text-orange-300 bg-orange-400/10 border border-orange-400/20 rounded-full px-1.5 py-0.5">OT</span>}
                    {r.isRemote && <span className="text-[10px] text-blue-300 bg-blue-400/10 border border-blue-400/20 rounded-full px-1.5 py-0.5 flex items-center gap-0.5"><Wifi className="w-2.5 h-2.5" />Remote</span>}
                    {r.isSick && <span className="text-[10px] text-red-300 bg-red-400/10 border border-red-400/20 rounded-full px-1.5 py-0.5">Sick</span>}
                    {!r.isLate && !r.isOvertime && !r.isRemote && !r.isSick && <span className="text-[10px] text-[hsl(215,20%,45%)]"><Sun className="w-2.5 h-2.5 inline" /> Office</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(217,32%,17%)]">
              <h2 className="text-white font-semibold flex items-center gap-2"><Camera className="w-5 h-5 text-[hsl(186,100%,42%)]"/> Capture Photo</h2>
              <button onClick={() => setShowCamera(false)} className="text-[hsl(215,20%,65%)] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative bg-black aspect-video flex flex-col justify-center">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-4 border-[hsl(186,100%,42%)]/20 pointer-events-none rounded-lg m-2"></div>
            </div>
            <div className="p-4 bg-[hsl(222,47%,11%)]">
              <button 
                onClick={handleCaptureAndSubmit}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black font-semibold text-sm rounded-lg px-4 py-3 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {isSubmitting ? "Uploading & Clocking In..." : "Capture & Clock In"}
              </button>
              <p className="text-xs text-center text-[hsl(215,20%,55%)] mt-3 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Photo will be verified by peers.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
