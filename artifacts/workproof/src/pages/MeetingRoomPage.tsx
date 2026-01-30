import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import { 
  Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff, 
  MessageSquare, CheckSquare, Plus, Send, X, AlertTriangle, Loader2, Reply
} from "lucide-react";

type PeerData = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  name: string;
};

export default function MeetingRoomPage() {
  const params = useParams();
  const meetingId = parseInt(params?.id || "0", 10);
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<"chat" | "actions">("chat");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Meeting & Chat Data ---
  const { data: meeting, isLoading: meetingLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      const res = await customFetch(`/api/v1/meetings/${meetingId}`) as Response;
      if (!res.ok) throw new Error("Failed to load meeting");
      return res.json();
    }
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["meeting-chat", meeting?.conversationId],
    enabled: !!meeting?.conversationId,
    queryFn: async () => {
      const res = await customFetch(`/api/v1/chat/conversations/${meeting.conversationId}/messages`) as Response;
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 3000,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["meeting-actions", meetingId],
    queryFn: async () => {
      const res = await customFetch(`/api/v1/tasks?meetingId=${meetingId}`) as Response;
      if (!res.ok) return [];
      return res.json();
    },
  });

  // --- WebRTC & Socket Refs ---
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ [userId: number]: RTCPeerConnection }>({});
  
  // State to trigger re-renders when streams change
  const [remoteStreams, setRemoteStreams] = useState<{ [userId: number]: MediaStream }>({});
  const [peerNames, setPeerNames] = useState<{ [userId: number]: string }>({});

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  };

  // --- Media Setup ---
  useEffect(() => {
    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        setError("Could not access camera/microphone. Please check permissions.");
      }
    }
    setupMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // --- Socket & Signaling ---
  useEffect(() => {
    if (!token || !meeting) return;

    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-meeting", meetingId);
    });

    const createPeerConnection = (targetUserId: number, targetName: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current[targetUserId] = pc;
      
      setPeerNames(prev => ({ ...prev, [targetUserId]: targetName }));

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("meeting-ice-candidate", {
            targetUserId,
            meetingId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams(prev => ({ ...prev, [targetUserId]: event.streams[0] }));
      };

      return pc;
    };

    socket.on("meeting-user-joined", async ({ userId, name }) => {
      // Create PC and offer
      const pc = createPeerConnection(userId, name);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("meeting-offer", { targetUserId: userId, meetingId, offer });
    });

    socket.on("meeting-offer", async ({ fromUserId, offer, meetingId: mId }) => {
      if (mId !== meetingId) return;
      const pc = createPeerConnection(fromUserId, "Participant");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("meeting-answer", { targetUserId: fromUserId, meetingId, answer });
    });

    socket.on("meeting-answer", async ({ fromUserId, answer, meetingId: mId }) => {
      if (mId !== meetingId) return;
      const pc = peersRef.current[fromUserId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("meeting-ice-candidate", async ({ fromUserId, candidate, meetingId: mId }) => {
      if (mId !== meetingId) return;
      const pc = peersRef.current[fromUserId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });

    socket.on("meeting-user-left", ({ userId }) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    return () => {
      socket.emit("leave-meeting", meetingId);
      socket.disconnect();
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [token, meetingId, meeting]);

  // --- Controls ---
  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !micOn;
      });
      setMicOn(!micOn);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !cameraOn;
      });
      setCameraOn(!cameraOn);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        screenTrack.onended = () => {
          stopScreenShare();
        };

        // Replace track in all peer connections
        Object.values(peersRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        // Update local video
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Screen sharing failed", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      
      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
      });

      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setIsScreenSharing(false);
    }
  };

  const leaveMeeting = () => {
    setLocation("/meetings");
  };

  // --- Chat & Actions Handlers ---
  const [chatMsg, setChatMsg] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim() || !meeting?.conversationId) return;
    
    // Fire and forget, UI will update via refetch
    customFetch(`/api/v1/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: meeting.conversationId,
        content: chatMsg,
        replyToMessageId: replyingTo?.id
      })
    }).then(() => {
      qc.invalidateQueries({ queryKey: ["meeting-chat", meeting.conversationId] });
      // Notify via socket for real-time
      socketRef.current?.emit("send-message", {
        conversationId: meeting.conversationId,
        content: chatMsg,
        replyToMessageId: replyingTo?.id
      });
    });
    
    setChatMsg("");
    setReplyingTo(null);
  };

  // Inline action creator
  const [actionTitle, setActionTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | "">("");

  const createAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTitle.trim()) return;
    
    const res = await customFetch("/api/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: actionTitle,
        priority: "high",
        meetingId: meetingId,
        assigneeId: assigneeId === "" ? undefined : assigneeId,
      })
    }) as Response;

    if (res.ok) {
      setActionTitle("");
      setAssigneeId("");
      qc.invalidateQueries({ queryKey: ["meeting-actions", meetingId] });
    }
  };

  if (meetingLoading) {
    return <div className="h-screen flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-white">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p>{error}</p>
        <button onClick={leaveMeeting} className="mt-6 px-4 py-2 bg-[hsl(217,32%,17%)] rounded-lg">Return to Meetings</button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Top Bar */}
      <div className="h-14 bg-[hsl(222,47%,11%)] border-b border-[hsl(217,32%,17%)] flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-white font-semibold text-lg">{meeting?.title || "Meeting Room"}</h1>
        <div className="text-[hsl(215,20%,65%)] text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          Live
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 p-4 flex flex-col relative">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
            {/* Local Video */}
            <div className="bg-[hsl(217,32%,11%)] rounded-xl overflow-hidden relative border border-[hsl(217,32%,17%)]">
              <video 
                ref={localVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover ${!isScreenSharing ? "scale-x-[-1]" : ""}`}
              />
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
                You {isScreenSharing ? "(Presenting)" : ""}
              </div>
              {(!micOn || !cameraOn) && (
                <div className="absolute top-3 right-3 flex gap-1">
                  {!micOn && <div className="bg-red-500/80 p-1 rounded-full"><MicOff className="w-3 h-3 text-white" /></div>}
                  {!cameraOn && <div className="bg-red-500/80 p-1 rounded-full"><VideoOff className="w-3 h-3 text-white" /></div>}
                </div>
              )}
            </div>

            {/* Remote Videos */}
            {Object.entries(remoteStreams).map(([uid, stream]) => (
              <RemoteVideo key={uid} stream={stream} name={peerNames[parseInt(uid)] || `User ${uid}`} />
            ))}
          </div>

          {/* Controls Bar */}
          <div className="h-20 mt-4 flex items-center justify-center gap-4">
            <button 
              onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] text-white' : 'bg-red-500 text-white'}`}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={toggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${cameraOn ? 'bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] text-white' : 'bg-red-500 text-white'}`}
            >
              {cameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={toggleScreenShare}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-[hsl(186,100%,42%)] text-black' : 'bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] text-white'}`}
            >
              <MonitorUp className="w-5 h-5" />
            </button>
            <div className="w-px h-8 bg-[hsl(217,32%,22%)] mx-2"></div>
            <button 
              onClick={leaveMeeting}
              className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-[hsl(217,32%,17%)] bg-[hsl(222,47%,11%)] flex flex-col">
          <div className="flex border-b border-[hsl(217,32%,17%)]">
            <button 
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === "chat" ? "border-[hsl(186,100%,42%)] text-white" : "border-transparent text-[hsl(215,20%,55%)] hover:text-white"}`}
            >
              <MessageSquare className="w-4 h-4" /> Chat
            </button>
            <button 
              onClick={() => setActiveTab("actions")}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === "actions" ? "border-[hsl(186,100%,42%)] text-white" : "border-transparent text-[hsl(215,20%,55%)] hover:text-white"}`}
            >
              <CheckSquare className="w-4 h-4" /> Actions
            </button>
          </div>

          {/* Chat Panel */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(messages as any[]).map((msg: any) => {
                  const replyTarget = msg.replyToMessageId ? (messages as any[]).find(m => m.id === msg.replyToMessageId) : null;
                  const isMe = msg.senderId === user?.id;

                  return (
                    <div key={msg.id} className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] text-[hsl(215,20%,55%)] mb-1">{msg.senderName}</span>
                      <div className={`relative px-3 py-2 rounded-lg max-w-[85%] text-sm ${isMe ? "bg-[hsl(186,100%,42%)] text-black rounded-tr-sm" : "bg-[hsl(217,32%,17%)] text-white rounded-tl-sm"}`}>
                        
                        {/* Reply Action Button */}
                        <button 
                          onClick={() => setReplyingTo(msg)}
                          className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "-left-8" : "-right-8"} w-6 h-6 rounded-full bg-[hsl(217,32%,17%)] text-[hsl(215,20%,65%)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-white hover:bg-[hsl(217,32%,22%)]`}
                          title="Reply"
                        >
                          <Reply className="w-3 h-3" />
                        </button>

                        {/* Replied Message Preview Block */}
                        {replyTarget && (
                          <div className={`mb-1 p-1.5 rounded border-l-2 text-[10px] ${isMe ? 'bg-black/10 border-black/30' : 'bg-black/30 border-[hsl(186,100%,42%)]'}`}>
                            <p className="font-semibold">{replyTarget.senderId === user?.id ? "You" : replyTarget.senderName || "Unknown"}</p>
                            <p className="opacity-80 line-clamp-1">{replyTarget.content || "Attachment"}</p>
                          </div>
                        )}

                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col bg-[hsl(217,32%,13%)] border-t border-[hsl(217,32%,17%)]">
                {replyingTo && (
                  <div className="px-3 py-2 border-b border-[hsl(217,32%,17%)] flex items-center justify-between bg-[hsl(217,32%,15%)]">
                    <div className="flex flex-col border-l-2 border-[hsl(186,100%,42%)] pl-2 text-[10px]">
                      <span className="text-[hsl(186,100%,42%)] font-semibold mb-0.5">Replying to {replyingTo.senderId === user?.id ? "Yourself" : replyingTo.senderName || "Unknown"}</span>
                      <span className="text-[hsl(215,20%,65%)] line-clamp-1">{replyingTo.content || "Attachment"}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-[hsl(215,20%,55%)] hover:text-white p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="p-3">
                  <form onSubmit={sendChat} className="flex gap-2">
                    <input 
                      type="text" 
                      value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      placeholder="Message..." 
                      className="flex-1 bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                    />
                    <button type="submit" className="bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] text-black p-1.5 rounded-lg flex items-center justify-center">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Actions Panel */}
          {activeTab === "actions" && (
            <div className="flex-1 flex flex-col min-h-0 bg-[hsl(222,47%,11%)]">
              <div className="p-4 border-b border-[hsl(217,32%,17%)]">
                <p className="text-xs text-[hsl(215,20%,55%)] mb-2 leading-relaxed">
                  Meeting Actions are pushed to the global task board for automated follow-up tracking.
                </p>
                <form onSubmit={createAction} className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    value={actionTitle}
                    onChange={e => setActionTitle(e.target.value)}
                    placeholder="New action item..." 
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  />
                  <select
                    value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[hsl(186,100%,42%)]"
                  >
                    <option value="">Unassigned</option>
                    {(meeting?.attendees ?? []).map((att: any) => (
                      <option key={att.userId} value={att.userId}>
                        {att.userName || `User ${att.userId}`}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={!actionTitle.trim()} className="w-full flex justify-center items-center gap-1.5 bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] border border-[hsl(217,32%,22%)] text-white text-xs font-semibold py-1.5 rounded-lg transition-colors disabled:opacity-50">
                    <Plus className="w-3.5 h-3.5" /> Add Action
                  </button>
                </form>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {(actions as any[]).map((action: any) => (
                  <div key={action.id} className="bg-[hsl(217,32%,15%)] border border-[hsl(217,32%,22%)] p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className={`w-3 h-3 mt-0.5 rounded-sm border flex items-center justify-center ${["completed", "verified"].includes(action.status) ? "bg-emerald-500 border-emerald-500" : "border-[hsl(215,20%,55%)]"}`}>
                        {["completed", "verified"].includes(action.status) && <CheckSquare className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-white ${["completed", "verified"].includes(action.status) ? "line-through text-opacity-50" : ""}`}>{action.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            action.status === 'assigned' ? 'bg-blue-500/20 text-blue-300' :
                            action.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>{action.status.replace("_", " ")}</span>
                          {action.assigneeName && <span className="text-[10px] text-[hsl(215,20%,55%)]">@ {action.assigneeName}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(actions as any[]).length === 0 && (
                  <p className="text-center text-xs text-[hsl(215,20%,45%)] py-8">No action items yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component for remote videos to handle srcObject assignment safely
function RemoteVideo({ stream, name }: { stream: MediaStream, name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="bg-[hsl(217,32%,11%)] rounded-xl overflow-hidden relative border border-[hsl(217,32%,17%)]">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
        {name}
      </div>
    </div>
  );
}
