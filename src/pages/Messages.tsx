import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  id: string;
  subject: string;
  body: string;
  created_at: string;
  read: boolean;
  sender_id: string;
  receiver_id: string;
  sender?: { full_name: string; email: string };
  receiver?: { full_name: string; email: string };
}

const Messages = () => {
  const { role } = useUserRole();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (user) {
      fetchMessages();
      fetchRecipients();
      subscribeToMessages();
    }
  }, [user]);

  const fetchMessages = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load messages");
      return;
    }

    // Fetch sender and receiver profiles separately
    const messagesWithProfiles = await Promise.all(
      (data || []).map(async (message) => {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", message.sender_id)
          .single();

        const { data: receiverProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", message.receiver_id)
          .single();

        return {
          ...message,
          sender: senderProfile,
          receiver: receiverProfile,
        };
      })
    );

    setMessages(messagesWithProfiles);
  };

  const fetchRecipients = async () => {
    if (!user || !role) return;

    let query = supabase.from("profiles").select("id, full_name, email");

    if (role === "teacher") {
      const { data: parentIds } = await supabase
        .from("parents")
        .select("user_id");
      
      if (parentIds) {
        query = query.in("id", parentIds.map(p => p.user_id));
      }
    } else if (role === "parent") {
      const { data: teacherIds } = await supabase
        .from("teachers")
        .select("user_id");
      
      if (teacherIds) {
        query = query.in("id", teacherIds.map(t => t.user_id));
      }
    }

    const { data } = await query.neq("id", user.id);
    setRecipients(data || []);
  };

  const subscribeToMessages = () => {
    if (!user) return;

    const channel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!user || !recipientId || !subject || !body) {
      toast.error("Please fill all fields");
      return;
    }

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: recipientId,
      subject,
      body,
    });

    if (error) {
      toast.error("Failed to send message");
      return;
    }

    toast.success("Message sent!");
    setNewMessageOpen(false);
    setRecipientId("");
    setSubject("");
    setBody("");
    fetchMessages();
  };

  const markAsRead = async (messageId: string) => {
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("id", messageId);
    
    fetchMessages();
  };

  if (!role) return null;

  return (
    <DashboardLayout role={role as any}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Messages</h2>
            <p className="text-muted-foreground">
              {role === "teacher" ? "Communicate with parents" : "Communicate with teachers"}
            </p>
          </div>
          <Dialog open={newMessageOpen} onOpenChange={setNewMessageOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send New Message</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Select value={recipientId} onValueChange={setRecipientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {recipients.map((recipient) => (
                        <SelectItem key={recipient.id} value={recipient.id}>
                          {recipient.full_name} ({recipient.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Message subject"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type your message here..."
                    rows={6}
                  />
                </div>
                <Button onClick={sendMessage} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>
                {messages.filter(m => m.receiver_id === user?.id && !m.read).length} unread
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No messages yet</p>
                </div>
              ) : (
                messages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => {
                      setSelectedMessage(message);
                      if (message.receiver_id === user?.id && !message.read) {
                        markAsRead(message.id);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedMessage?.id === message.id
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback>
                            {(message.sender_id === user?.id
                              ? message.receiver?.full_name
                              : message.sender?.full_name
                            )?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {message.sender_id === user?.id
                              ? message.receiver?.full_name
                              : message.sender?.full_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {message.subject}
                          </p>
                        </div>
                      </div>
                      {message.receiver_id === user?.id && !message.read && (
                        <Badge variant="default" className="flex-shrink-0">New</Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedMessage ? (
              <>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedMessage.subject}</CardTitle>
                      <CardDescription>
                        From:{" "}
                        {selectedMessage.sender_id === user?.id
                          ? "You"
                          : selectedMessage.sender?.full_name}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {new Date(selectedMessage.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{selectedMessage.body}</p>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-96">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a message to read</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Messages;
