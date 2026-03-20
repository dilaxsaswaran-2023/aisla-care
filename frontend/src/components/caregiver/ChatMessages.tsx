import { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Heart,
  MessageSquare,
  RefreshCw,
  Plus,
  User,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ChatInterface from "@/components/chat/ChatInterface";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseChatNotifications } from "@/hooks/useFirebaseChatNotifications";
import { useSocket } from "@/hooks/useSocket";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  role?: string;
  avatar_url?: string | null;
  patient_name?: string | null;
}

interface Conversation {
  partner_id: string;
  partner_name: string;
  unread_count: number;
  unread?: boolean;
  last_message?: { content: string; message_type: string; created_at: string };
}

interface ChatMessagesProps {
  contacts: Contact[];
  conversations: Conversation[];
  loading: boolean;
  onLoadConversations: () => void;
  selectedContactId?: string;
  onContactSelected?: () => void;
}

const getRoleIcon = (role?: string) => {
  if (role === "family") return <Users className="h-4 w-4" />;
  if (role === "caregiver") return <User className="h-4 w-4" />;
  return <Heart className="h-4 w-4" />;
};

const getRoleLabel = (contact: Contact) => {
  if (contact.role === "family" && contact.patient_name) return `Family of ${contact.patient_name}`;
  if (contact.role) return contact.role;
  return "contact";
};

export const ChatMessages = ({
  contacts,
  conversations,
  loading,
  onLoadConversations,
  selectedContactId,
  onContactSelected,
}: ChatMessagesProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [tempConversations, setTempConversations] = useState<Conversation[]>(conversations);

  useEffect(() => {
    if (selectedContactId && !selectedContact) {
      const contact = contacts.find((c) => c.id === selectedContactId);
      if (contact) {
        setSelectedContact(contact);
        onContactSelected?.();
      }
    }
  }, [selectedContactId, contacts, selectedContact, onContactSelected]);

  const {
    unreadBySender,
    latestNotification,
    clearLatest,
    markConversationRead,
  } = useFirebaseChatNotifications(user?.id || null, selectedContact?.id || null);

  const shouldShowChatToasts = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const isMessagesTab = params.get("tab") === "messages";
    const isSupportedPortalPath =
      location.pathname.startsWith("/caregiver") || location.pathname.startsWith("/family");
    return isMessagesTab && isSupportedPortalPath;
  }, [location.pathname, location.search]);

  const contactsMap = useMemo(() => {
    return new Map(contacts.map((contact) => [contact.id, contact]));
  }, [contacts]);

  const showChatToast = useCallback(
    (senderName: string, description: string, contact?: Contact) => {
      let dismissToast = () => {};

      const { dismiss } = toast({
        title: `New message from ${senderName}`,
        description,
        action: contact ? (
          <ToastAction
            altText="Open chat"
            onClick={(e) => {
              e.preventDefault();
              setSelectedContact(contact);
              markConversationRead(contact.id).catch(() => {});
              dismissToast();
            }}
          >
            Open
          </ToastAction>
        ) : undefined,
      });

      dismissToast = dismiss;
    },
    [toast, markConversationRead],
  );

  const handleSelectContact = useCallback(
    (contact: Contact) => {
      setSelectedContact(contact);
      markConversationRead(contact.id).catch(() => {});

      setTempConversations((prev) => {
        const exists = prev.some((c) => c.partner_id === contact.id);
        if (!exists) {
          return [
            {
              partner_id: contact.id,
              partner_name: contact.name,
              unread_count: 0,
              last_message: undefined,
            },
            ...prev,
          ];
        }

        return prev.map((conv) =>
          conv.partner_id === contact.id ? { ...conv, unread_count: 0, unread: false } : conv,
        );
      });

      onLoadConversations();
    },
    [markConversationRead, onLoadConversations],
  );

  const handleChatNotification = useCallback(
    (data: { sender_id: string; recipient_id: string; content: string; message_type: "text" | "audio" }) => {
      if (!user || data.recipient_id !== user.id) return;

      if (shouldShowChatToasts && selectedContact?.id !== data.sender_id) {
        const senderName = contactsMap.get(data.sender_id)?.name || "Contact";
        const contact = contactsMap.get(data.sender_id);
        showChatToast(
          senderName,
          data.message_type === "audio" ? "Sent you an audio message" : data.content,
          contact,
        );
      }

      setTempConversations((prev) => {
        const existing = prev.find((c) => c.partner_id === data.sender_id);
        if (!existing) {
          return [
            {
              partner_id: data.sender_id,
              partner_name: contactsMap.get(data.sender_id)?.name || "Contact",
              unread_count: selectedContact?.id === data.sender_id ? 0 : 1,
            },
            ...prev,
          ];
        }

        return prev.map((c) =>
          c.partner_id === data.sender_id
            ? {
                ...c,
                unread_count: selectedContact?.id === data.sender_id ? 0 : (c.unread_count ?? 0) + 1,
              }
            : c,
        );
      });
    },
    [user, shouldShowChatToasts, selectedContact?.id, contactsMap, showChatToast],
  );

  useSocket({
    userId: user?.id || null,
    onChatNotification: handleChatNotification,
  });

  const conversationContacts = useMemo(() => {
    return tempConversations.map((conv) => {
      const fallbackContact = contactsMap.get(conv.partner_id);
      return {
        id: conv.partner_id,
        name: conv.partner_name || fallbackContact?.name || "Unknown",
        role: fallbackContact?.role,
        avatar_url: fallbackContact?.avatar_url || null,
        patient_name: fallbackContact?.patient_name,
      };
    });
  }, [tempConversations, contactsMap]);

  const filteredConversationContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return conversationContacts;

    return conversationContacts.filter((contact) => {
      const conv = tempConversations.find((c) => c.partner_id === contact.id);
      const preview =
        conv?.last_message?.message_type === "audio"
          ? "audio"
          : conv?.last_message?.content || "";

      return (
        contact.name.toLowerCase().includes(q) ||
        (contact.role || "").toLowerCase().includes(q) ||
        (contact.patient_name || "").toLowerCase().includes(q) ||
        preview.toLowerCase().includes(q)
      );
    });
  }, [conversationContacts, contactSearch, tempConversations]);

  const contactsWithoutConversation = useMemo(() => {
    const existingIds = new Set(tempConversations.map((conv) => conv.partner_id));
    return contacts
      .filter((contact) => !existingIds.has(contact.id))
      .filter((contact) =>
        !newChatSearch.trim()
          ? true
          : contact.name.toLowerCase().includes(newChatSearch.trim().toLowerCase()),
      );
  }, [contacts, tempConversations, newChatSearch]);

  useEffect(() => {
    setTempConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (!latestNotification) return;

    if (!shouldShowChatToasts) {
      clearLatest();
      return;
    }

    const sender = contactsMap.get(latestNotification.sender_id);
    showChatToast(
      latestNotification.sender_name || "Contact",
      latestNotification.message_type === "audio"
        ? "Sent you an audio message"
        : latestNotification.content,
      sender,
    );
    clearLatest();
  }, [latestNotification, shouldShowChatToasts, clearLatest, contactsMap, showChatToast]);

  const unreadTotal = useMemo(() => {
    return filteredConversationContacts.reduce((sum, contact) => {
      const conv = tempConversations.find((c) => c.partner_id === contact.id);
      return sum + Math.max(conv?.unread_count ?? 0, unreadBySender[contact.id] ?? 0);
    }, 0);
  }, [filteredConversationContacts, tempConversations, unreadBySender]);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="care-card min-w-0 overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-background pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Messages
              </CardTitle>
              <CardDescription className="mt-1">
                Conversations and contacts
              </CardDescription>
            </div>

            <div className="flex items-center gap-1">
              <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>

                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Start new chat</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3">
                    <Input
                      placeholder="Search contacts"
                      value={newChatSearch}
                      onChange={(event) => setNewChatSearch(event.target.value)}
                    />

                    <div className="max-h-80 overflow-y-auto rounded-xl border">
                      {contactsWithoutConversation.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">No available contacts</div>
                      ) : (
                        contactsWithoutConversation.map((contact) => (
                          <button
                            key={contact.id}
                            onClick={() => {
                              handleSelectContact(contact);
                              setNewChatOpen(false);
                              setNewChatSearch("");
                            }}
                            className="w-full border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50"
                          >
                            <p className="text-sm font-medium">{contact.name}</p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {getRoleLabel(contact)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={onLoadConversations}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge variant="outline" className="rounded-full">
              {conversationContacts.length} chats
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              {unreadTotal} unread
            </Badge>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-10"
            />
          </div>
        </CardHeader>

        <CardContent className="p-3">
          {loading ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Loading contacts...
            </div>
          ) : filteredConversationContacts.length > 0 ? (
            <div className="space-y-2">
              {filteredConversationContacts.map((contact) => {
                const conv = tempConversations.find((c) => c.partner_id === contact.id);
                const unreadCount = Math.max(conv?.unread_count ?? 0, unreadBySender[contact.id] ?? 0);
                const isActive = selectedContact?.id === contact.id;

                return (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className={cn(
                      "w-full min-w-0 rounded-xl border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0 border">
                        {contact.avatar_url ? (
                          <AvatarImage src={contact.avatar_url} alt={contact.name} />
                        ) : (
                          <AvatarFallback>{getRoleIcon(contact.role)}</AvatarFallback>
                        )}
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{contact.name}</p>
                          {contact.role ? (
                            <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0 text-[10px] capitalize">
                              {contact.role}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {conv?.last_message
                            ? conv.last_message.message_type === "audio"
                              ? "🎙 Audio"
                              : conv.last_message.content
                            : getRoleLabel(contact)}
                        </p>
                      </div>

                      {unreadCount > 0 ? (
                        <Badge variant="destructive" className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-[10px]">
                          {unreadCount}
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed">
              <div className="space-y-2 text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs text-muted-foreground">Start a new chat to begin messaging.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="care-card min-w-0 overflow-hidden border-border/70 shadow-sm">
        <CardContent className="h-[520px] min-w-0 w-full p-0">
          {selectedContact ? (
            <div className="h-full min-w-0 w-full overflow-hidden">
              <ChatInterface
                recipientId={selectedContact.id}
                recipientName={selectedContact.name}
                maxMessageWidth="max-w-full"
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="space-y-2 text-center">
                <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">Select a contact to start chatting</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};