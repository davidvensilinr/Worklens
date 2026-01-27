import React, { useEffect, useRef, useState } from "react";
import { X, Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from "lucide-react";
import { Socket } from "socket.io-client";

interface CallModalProps {
  socket: Socket | null;
  targetUserId: number;
  targetUserName: string;
  isIncoming: boolean;
  incomingOffer?: RTCSessionDescriptionInit;
  onClose: () => void;
}

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

export default function CallModal({ socket, targetUserId, targetUserName, isIncoming, incomingOffer, onClose }: CallModalProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(!isIncoming);
  const [status, setStatus] = useState(isIncoming ? "Incoming call..." : "Calling...");

  useEffect(() => {
    if (!socket) return;
    const handleCallEnded = (data: { fromUserId: number }) => {
      if (data.fromUserId === targetUserId) {
        cleanupAndClose();
      }
    };
    socket.on("call-ended", handleCallEnded);
    return () => {
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, targetUserId]);

  useEffect(() => {
    if (!socket || !hasAccepted) return;

    let pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { targetUserId, candidate: event.candidate });
      }
    };

    // Handle incoming streams
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setStatus("Connected");
      }
    };

    // Socket event listeners for this call
    const handleAnswer = async (data: { fromUserId: number, answer: RTCSessionDescriptionInit }) => {
      if (data.fromUserId === targetUserId) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const handleIceCandidate = async (data: { fromUserId: number, candidate: RTCIceCandidateInit }) => {
      if (data.fromUserId === targetUserId && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    };

    socket.on("call-answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    // Setup media and start call
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        if (isIncoming && incomingOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call-answer", { targetUserId, answer });
        } else {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call-offer", { targetUserId, offer });
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        setStatus("Failed to access camera/microphone");
      }
    };

    startMedia();

    return () => {
      socket.off("call-answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      cleanupAndClose(false); // pass false so we don't call onClose in cleanup if we are unmounting
    };
  }, [socket, targetUserId, isIncoming, incomingOffer, hasAccepted]);

  const cleanupAndClose = (triggerOnClose = true) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (socket) {
      socket.emit("call-ended", { targetUserId });
    }
    if (triggerOnClose) {
      onClose();
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  if (isIncoming && !hasAccepted) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
        <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center">
          <div className="w-24 h-24 bg-[hsl(186,100%,42%)/20] rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
            <Phone className="w-10 h-10 text-[hsl(186,100%,42%)]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{targetUserName}</h2>
          <p className="text-[hsl(215,20%,55%)] mb-8">Incoming video call...</p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => cleanupAndClose(true)}
              className="px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors flex-1"
            >
              Decline
            </button>
            <button 
              onClick={() => setHasAccepted(true)}
              className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex-1"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,22%)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[hsl(222,47%,8%)] border-b border-[hsl(217,32%,22%)]">
          <div>
            <h2 className="font-semibold text-white">{targetUserName}</h2>
            <p className="text-xs text-[hsl(215,20%,55%)]">{status}</p>
          </div>
        </div>

        {/* Video Area */}
        <div className="relative bg-black aspect-video flex-1 flex items-center justify-center">
          {/* Remote Video (Full size) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          
          {/* Local Video (PiP) */}
          <div className="absolute bottom-4 right-4 w-48 aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 border-[hsl(217,32%,22%)] shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 p-6 bg-[hsl(222,47%,8%)] border-t border-[hsl(217,32%,22%)]">
          <button 
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isAudioMuted ? "bg-red-500/20 text-red-500" : "bg-[hsl(217,32%,17%)] text-white hover:bg-[hsl(217,32%,22%)]"}`}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={() => cleanupAndClose(true)}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-red-500/20"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button 
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isVideoMuted ? "bg-red-500/20 text-red-500" : "bg-[hsl(217,32%,17%)] text-white hover:bg-[hsl(217,32%,22%)]"}`}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      <style>{`
        .mirror { transform: scaleX(-1); }
      `}</style>
    </div>
  );
}
