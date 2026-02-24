"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";
// Feature access is checked server-side via API

interface ChatMessage {
  id: string;
  userId: string;
  userName: string | null;
  userImage: string | null;
  message: string;
  timestamp: Date;
}

interface RaceMeeting {
  id: string;
  name: string;
  trackName: string;
  date: Date;
  raceCount: number;
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, joinChat, leaveChat, sendChatMessage, on, off } = useWebSocket();

  // Check feature access via API
  useEffect(() => {
    const checkAccess = async () => {
      if (session?.user?.id) {
        try {
          const res = await fetch("/api/user/feature-access?feature=chat");
          const data = await res.json();
          setHasAccess(data.hasAccess ?? false);
        } catch {
          setHasAccess(false);
        }
      }
    };
    checkAccess();
  }, [session]);

  // Fetch today's race meetings
  const { data: meetingsData } = useQuery({
    queryKey: ["race-meetings-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(`/api/races?date=${today}&groupByMeeting=true`);
      if (!response.ok) {
        throw new Error("Failed to fetch meetings");
      }
      return response.json();
    },
  });

  const meetings: RaceMeeting[] = meetingsData?.meetings || [];

  // Auto-select first meeting
  useEffect(() => {
    if (meetings.length > 0 && !selectedMeetingId) {
      setSelectedMeetingId(meetings[0].id);
    }
  }, [meetings, selectedMeetingId]);

  // Handle WebSocket chat events
  useEffect(() => {
    if (!isConnected || !selectedMeetingId) return;

    // Join chat room
    joinChat(selectedMeetingId);

    // Listen for chat messages
    const handleChatMessage = (data: any) => {
      const newMessage: ChatMessage = {
        id: data.id || `${Date.now()}-${Math.random()}`,
        userId: data.userId,
        userName: data.userName,
        userImage: data.userImage,
        message: data.message,
        timestamp: new Date(data.timestamp),
      };
      setMessages((prev) => [...prev, newMessage]);
    };

    const unsub = on("chat-message", handleChatMessage);

    // Cleanup on unmount or meeting change
    return () => {
      unsub();
      leaveChat(selectedMeetingId);
    };
  }, [isConnected, selectedMeetingId, joinChat, leaveChat, on]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedMeetingId || !isConnected) return;

    sendChatMessage(
      selectedMeetingId,
      messageInput.trim(),
      session?.user?.name || "Anonymous",
      session?.user?.image || undefined
    );

    setMessageInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Upgrade CTA for free users
  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              Race Day Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Join the conversation with other punters! Chat about today's races,
              share insights, and discuss tips in real-time.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Premium Feature</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade to PRO or PREMIUM to access live race day chat and
                connect with the WhalePunter community.
              </p>
              <Button asChild>
                <a href="/pricing">View Plans</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  return (
    <div className="container mx-auto p-6 h-[calc(100vh-8rem)]">
      <div className="flex gap-4 h-full">
        {/* Left Sidebar - Meeting List */}
        <Card className="w-64 flex-shrink-0">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Today's Meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[calc(100%-5rem)] overflow-y-auto">
            {meetings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                No meetings today
              </p>
            )}
            {meetings.map((meeting) => (
              <Button
                key={meeting.id}
                variant={
                  selectedMeetingId === meeting.id ? "default" : "outline"
                }
                className="w-full justify-start"
                onClick={() => {
                  setSelectedMeetingId(meeting.id);
                  setMessages([]); // Clear messages when switching
                }}
              >
                <div className="flex flex-col items-start w-full">
                  <span className="font-medium text-sm">{meeting.trackName}</span>
                  <span className="text-xs opacity-80">
                    {meeting.raceCount} races
                  </span>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {selectedMeeting ? (
                  <>
                    <MessageCircle className="h-5 w-5" />
                    {selectedMeeting.trackName} Chat
                  </>
                ) : (
                  "Select a meeting"
                )}
              </CardTitle>
              {isConnected ? (
                <Badge className="bg-green-500">
                  <Users className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              ) : (
                <Badge variant="secondary">Connecting...</Badge>
              )}
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedMeetingId && (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">
                  Select a meeting to start chatting
                </p>
              </div>
            )}

            {selectedMeetingId && messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">
                  No messages yet. Start the conversation!
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const isOwnMessage = msg.userId === session?.user?.id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    isOwnMessage ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar */}
                  {msg.userImage ? (
                    <img
                      src={msg.userImage}
                      alt={msg.userName || "User"}
                      className="h-8 w-8 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium">
                        {msg.userName?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                  )}

                  {/* Message Content */}
                  <div
                    className={cn(
                      "flex flex-col max-w-[70%]",
                      isOwnMessage ? "items-end" : "items-start"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {isOwnMessage ? "You" : msg.userName || "Anonymous"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2",
                        isOwnMessage
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      )}
                    >
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Message Input */}
          {selectedMeetingId && (
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={!isConnected}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || !isConnected}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
