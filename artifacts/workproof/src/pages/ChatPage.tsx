import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import { useListConversations, useCreateConversation, useListMessages, getListMessagesQueryKey, getListConversationsQueryKey, useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Phone, Video, Paperclip, Image as ImageIcon, File, UserPlus, Reply, X, MessageSquare } from "lucide-react";
import CallModal from "@/components/CallModal";

interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  replyToMessageId?: number | null;
  createdAt: string;
}

export default function ChatPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Call state
  const [activeCall, setActiveCall] = useState<{ targetUserId: number, targetUserName: string, isIncoming: boolean, incomingOffer?: RTCSessionDescriptionInit } | null>(null);

  // Queries
  const { data: conversations } = useListConversations({ query: { queryKey: getListConversationsQueryKey() } });
  const { data: initialMessages } = useListMessages(activeConversationId!, {
    query: {
      queryKey: getListMessagesQueryKey(activeConversationId!),
      enabled: !!activeConversationId,
    }
  });
  const { data: users = [] } = useListUsers();

  const safeConversations = (conversations || []) as any[];
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (initialMessages) {
      setLiveMessages(initialMessages as ChatMessage[]);
    } else {
      setLiveMessages([]);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (!token) return;

    // The Vite proxy redirects /api to the backend, but socket.io uses a different path.
    // By default, socket.io will connect to window.location.host, which is correct with the proxy.
    const newSocket = io("/", {
      auth: { token },
      path: "/socket.io",
      transports: ["websocket"]
    });

    setSocket(newSocket);

    newSocket.on("new-message", (msg: ChatMessage) => {
      // Always add the sender name if missing but we know it from participants
      setLiveMessages(prev => {
        // Only append if it's for the currently active conversation
        if (msg.conversationId === activeConversationId) {
           // Prevent duplicates if we already have it (though unlikely with WebSockets in this simple setup)
           if (!prev.some(m => m.id === msg.id)) {
              return [...prev, msg];
           }
        }
        return prev;
      });
      
      // Invalidate conversation list to update "last message" previews (if we had them)
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    });

    // WebRTC Signaling handlers
    newSocket.on("call-offer", (data) => {
      // Find who is calling
      const conv = safeConversations.find(c => c.id === data.conversationId);
      const callerName = conv?.participants?.find((p: any) => p.userId === data.fromUserId)?.name || "Someone";
      
      setActiveCall({
        targetUserId: data.fromUserId,
        targetUserName: callerName,
        isIncoming: true,
        incomingOffer: data.offer
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token, activeConversationId, conversations, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages]);

  useEffect(() => {
    if (socket && activeConversationId) {
      socket.emit("join-conversation", activeConversationId);
    }
  }, [socket, activeConversationId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !socket || !activeConversationId) return;

    socket.emit("send-message", {
      conversationId: activeConversationId,
      content: messageInput,
      replyToMessageId: replyingTo?.id
    });
    setMessageInput("");
    setReplyingTo(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId || !socket) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/chat/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      
      if (data.url) {
        socket.emit("send-message", {
          conversationId: activeConversationId,
          content: "",
          attachmentUrl: data.url,
          attachmentType: file.type.startsWith("image/") ? "image" : "file",
          replyToMessageId: replyingTo?.id
        });
        setReplyingTo(null);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const startCall = (withVideo: boolean) => {
    if (!activeConversationId) return;
    
    // Find target user id (assuming 1-on-1 for now)
    const conv = safeConversations.find(c => c.id === activeConversationId);
    if (!conv || conv.isGroup) {
      alert("Calls are only supported for 1-on-1 chats currently.");
      return;
    }

    const targetUser = conv.participants.find((p: any) => p.userId !== user?.id);
    if (!targetUser) return;

    setActiveCall({
      targetUserId: targetUser.userId,
      targetUserName: targetUser.name,
      isIncoming: false
    });
  };

  const createConversationMutation = useCreateConversation({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setActiveConversationId((data as any).id);
        setShowNewChatModal(false);
      }
    }
  });

  const activeConvDetails = safeConversations.find(c => c.id === activeConversationId);

  return (
    <div className="flex h-full bg-[hsl(222,47%,11%)] rounded-xl border border-[hsl(217,32%,17%)] overflow-hidden m-6">
      
      {/* Sidebar: Conversation List */}
      <div className="w-80 flex flex-col border-r border-[hsl(217,32%,17%)] bg-[hsl(222,47%,8%)]">
        <div className="p-4 border-b border-[hsl(217,32%,17%)] flex items-center justify-between">
          <h2 className="font-bold text-white">Messages</h2>
          <button 
            onClick={() => setShowNewChatModal(true)}
            className="w-8 h-8 rounded-lg bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] flex items-center justify-center text-[hsl(215,20%,65%)] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {safeConversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`w-full text-left p-4 border-b border-[hsl(217,32%,17%)] transition-colors ${activeConversationId === conv.id ? "bg-[hsl(217,32%,17%)]" : "hover:bg-[hsl(217,32%,17%)/50%]"}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[hsl(186,100%,42%)/15%] text-[hsl(186,100%,42%)] flex items-center justify-center font-bold text-sm">
                  {conv.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{conv.name}</h3>
                  <p className="text-xs text-[hsl(215,20%,55%)] truncate">
                    {conv.isGroup ? "Group Chat" : "Direct Message"}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {safeConversations.length === 0 && (
            <div className="p-8 text-center text-sm text-[hsl(215,20%,55%)]">
              No conversations yet. Start one!
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeConversationId ? (
        <div className="flex-1 flex flex-col bg-[hsl(222,47%,11%)]">
          {/* Chat Header */}
          <div className="h-16 border-b border-[hsl(217,32%,17%)] bg-[hsl(222,47%,13%)] flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-[hsl(186,100%,42%)/15%] text-[hsl(186,100%,42%)] flex items-center justify-center font-bold">
                  {activeConvDetails?.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="font-semibold text-white">{activeConvDetails?.name}</h2>
            </div>
            
            {!activeConvDetails?.isGroup && (
              <div className="flex items-center gap-2">
                <button onClick={() => startCall(false)} className="w-9 h-9 rounded-full bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] flex items-center justify-center text-[hsl(215,20%,65%)] transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
                <button onClick={() => startCall(true)} className="w-9 h-9 rounded-full bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] flex items-center justify-center text-[hsl(215,20%,65%)] transition-colors">
                  <Video className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {liveMessages.map((msg, idx) => {
              const isMe = msg.senderId === user?.id;
              // Provide fallback name using participants if missing
              let senderName = msg.senderName;
              if (!senderName && activeConvDetails) {
                 const p = activeConvDetails.participants.find((p: any) => p.userId === msg.senderId);
                 if (p) senderName = p.name;
              }

              const replyTarget = msg.replyToMessageId ? liveMessages.find(m => m.id === msg.replyToMessageId) : null;

              return (
                <div key={msg.id || `temp-${idx}`} className={`flex flex-col group ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-[hsl(215,20%,45%)] mb-1 mx-1">
                    {isMe ? "You" : senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  <div className={`relative max-w-[70%] rounded-2xl p-3 ${isMe ? "bg-[hsl(186,100%,42%)] text-black" : "bg-[hsl(217,32%,17%)] text-white"}`}>
                    
                    {/* Reply Action Button */}
                    <button 
                      onClick={() => setReplyingTo(msg)}
                      className={`absolute top-1/2 -translate-y-1/2 ${isMe ? "-left-10" : "-right-10"} w-8 h-8 rounded-full bg-[hsl(217,32%,17%)] text-[hsl(215,20%,65%)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-white hover:bg-[hsl(217,32%,22%)]`}
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>

                    {/* Replied Message Preview Block */}
                    {replyTarget && (
                      <div className={`mb-2 p-2 rounded border-l-4 text-xs ${isMe ? 'bg-black/10 border-black/30' : 'bg-black/30 border-[hsl(186,100%,42%)]'}`}>
                        <p className="font-semibold mb-0.5">{replyTarget.senderId === user?.id ? "You" : replyTarget.senderName || "Unknown"}</p>
                        <p className="opacity-80 line-clamp-1">{replyTarget.content || "Attachment"}</p>
                      </div>
                    )}

                    {msg.attachmentUrl && (
                      <div className="mb-2">
                        {msg.attachmentType === "image" ? (
                          <img src={`${msg.attachmentUrl}`} alt="attachment" className="rounded-xl max-h-60 object-contain bg-black/10" />
                        ) : (
                          <a href={`${msg.attachmentUrl}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline opacity-80 hover:opacity-100">
                            <File className="w-4 h-4" /> Download Attachment
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-[hsl(222,47%,13%)] border-t border-[hsl(217,32%,17%)] flex flex-col">
            {replyingTo && (
              <div className="px-4 py-2 border-b border-[hsl(217,32%,17%)] flex items-center justify-between bg-[hsl(217,32%,15%)]">
                <div className="flex flex-col border-l-4 border-[hsl(186,100%,42%)] pl-3 text-xs">
                  <span className="text-[hsl(186,100%,42%)] font-semibold mb-0.5">Replying to {replyingTo.senderId === user?.id ? "Yourself" : replyingTo.senderName || "Unknown"}</span>
                  <span className="text-[hsl(215,20%,65%)] line-clamp-1">{replyingTo.content || "Attachment"}</span>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-[hsl(215,20%,55%)] hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="p-4">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <label className="flex-shrink-0 cursor-pointer w-10 h-10 rounded-full bg-[hsl(217,32%,17%)] hover:bg-[hsl(217,32%,22%)] flex items-center justify-center text-[hsl(215,20%,65%)] transition-colors">
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                <Paperclip className="w-4 h-4" />
              </label>
              
              <div className="flex-1 bg-[hsl(217,32%,17%)] border border-[hsl(217,32%,22%)] rounded-2xl overflow-hidden focus-within:border-[hsl(186,100%,42%)] transition-colors flex items-center">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent border-none px-4 py-3 text-sm text-white focus:outline-none placeholder-[hsl(215,20%,45%)]"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={(!messageInput.trim() && !uploading) || uploading}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-[hsl(186,100%,42%)] hover:bg-[hsl(186,100%,38%)] disabled:opacity-50 flex items-center justify-center text-black transition-colors"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>
            {uploading && <p className="text-xs text-[hsl(215,20%,55%)] mt-2 ml-14">Uploading file...</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-[hsl(222,47%,11%)] text-[hsl(215,20%,55%)]">
          <div className="w-16 h-16 rounded-full bg-[hsl(217,32%,17%)] flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-[hsl(215,20%,45%)]" />
          </div>
          <p>Select a conversation to start messaging</p>
        </div>
      )}

      {/* Call Modal */}
      {activeCall && (
        <CallModal
          socket={socket}
          targetUserId={activeCall.targetUserId}
          targetUserName={activeCall.targetUserName}
          isIncoming={activeCall.isIncoming}
          incomingOffer={activeCall.incomingOffer}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[hsl(222,47%,11%)] border border-[hsl(217,32%,17%)] rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-[hsl(217,32%,17%)] flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">New Chat</h3>
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="text-[hsl(215,20%,65%)] hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {users.filter(u => u.id !== user?.id).map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => {
                    // Check if a 1-on-1 conv already exists
                    const existingConv = safeConversations.find(c => !c.isGroup && c.participants.some((p: any) => p.userId === u.id));
                    if (existingConv) {
                      setActiveConversationId(existingConv.id);
                      setShowNewChatModal(false);
                    } else {
                      createConversationMutation.mutate({
                        data: {
                          participantIds: [u.id],
                          isGroup: false,
                          name: ""
                        }
                      });
                    }
                  }}
                  className="w-full flex items-center gap-4 p-3 hover:bg-[hsl(217,32%,17%)] rounded-lg transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-[hsl(186,100%,42%)/15%] text-[hsl(186,100%,42%)] flex items-center justify-center font-bold">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{u.name}</h4>
                    <p className="text-xs text-[hsl(215,20%,55%)]">{u.department?.name || "Organization Member"}</p>
                  </div>
                </button>
              ))}
              {users.filter(u => u.id !== user?.id).length === 0 && (
                <p className="text-center text-[hsl(215,20%,55%)] p-4">No other employees found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

