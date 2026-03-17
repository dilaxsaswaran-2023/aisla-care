import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Users, Heart, MessageSquare, RefreshCw, Plus, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import ChatInterface from "@/components/chat/ChatInterface";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseChatNotifications } from "@/hooks/useFirebaseChatNotifications";
import { useSocket } from "@/hooks/useSocket";

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

interface CaregiverMessagesProps {
  contacts: Contact[];
  conversations: Conversation[];
  loading: boolean;
  onLoadConversations: () => void;
}

export const CaregiverMessages = ({
  contacts,
  conversations,
  loading,
  onLoadConversations,
}: CaregiverMessagesProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [tempConversations, setTempConversations] = useState<Conversation[]>(conversations);

  const {
    unreadBySender,
    latestNotification,
    clearLatest,
    markConversationRead,
  } = useFirebaseChatNotifications(user?.id || null, selectedContact?.id || null);

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    markConversationRead(contact.id).catch(() => {});
    // Add contact to conversations list if not already there
    setTempConversations(prevConvs => {
      const exists = prevConvs.some(c => c.partner_id === contact.id);
      if (!exists) {
        return [...prevConvs, {
          partner_id: contact.id,
          partner_name: contact.name,
          unread_count: 0,
          last_message: undefined,
        }];
      }
      return prevConvs.map((conv) =>
        conv.partner_id === contact.id ? { ...conv, unread_count: 0, unread: false } : conv
      );
    });

    onLoadConversations();
  };

  const contactsMap = useMemo(() => {
    return new Map(contacts.map(contact => [contact.id, contact]));
  }, [contacts]);

  const handleChatNotification = useCallback(
    (data: { sender_id: string; recipient_id: string; content: string; message_type: 'text' | 'audio' }) => {
      if (!user || data.recipient_id !== user.id) return;

      if (selectedContact?.id !== data.sender_id) {
        const senderName = contactsMap.get(data.sender_id)?.name || "Contact";
        const contact = contactsMap.get(data.sender_id);
        toast({
          title: `New message from ${senderName}`,
          description: data.message_type === "audio" ? "Sent you an audio message" : data.content,
          action: contact ? (
            <ToastAction
              altText="Open chat"
              onClick={(e) => {
                e.preventDefault();
                setSelectedContact(contact);
                markConversationRead(contact.id).catch(() => {});
              }}
            >
              Open
            </ToastAction>
          ) : undefined,
        });
      }

      setTempConversations((prev) => {
        const existing = prev.find((c) => c.partner_id === data.sender_id);
        if (!existing) {
          return [
            ...prev,
            {
              partner_id: data.sender_id,
              partner_name: contactsMap.get(data.sender_id)?.name || "Contact",
              unread_count: selectedContact?.id === data.sender_id ? 0 : 1,
            },
          ];
        }

        return prev.map((c) =>
          c.partner_id === data.sender_id
            ? {
                ...c,
                unread_count: selectedContact?.id === data.sender_id ? 0 : (c.unread_count ?? 0) + 1,
              }
            : c
        );
      });
    },
    [user, selectedContact?.id, toast, contactsMap, markConversationRead]
  );

  useSocket({
    userId: user?.id || null,
    onChatNotification: handleChatNotification,
  });

  const conversationContacts = useMemo(() => {
    return tempConversations.map(conv => {
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

  const contactsWithoutConversation = useMemo(() => {
    const existingIds = new Set(tempConversations.map(conv => conv.partner_id));
    return contacts
      .filter(contact => !existingIds.has(contact.id))
      .filter(contact =>
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
    const sender = contactsMap.get(latestNotification.sender_id);
    toast({
      title: `New message from ${latestNotification.sender_name || 'Contact'}`,
      description:
        latestNotification.message_type === "audio"
          ? "Sent you an audio message"
          : latestNotification.content,
      action: sender ? (
        <ToastAction
          altText="Open chat"
          onClick={(e) => {
            e.preventDefault();
            setSelectedContact(sender);
            markConversationRead(sender.id).catch(() => {});
          }}
        >
          Open
        </ToastAction>
      ) : undefined,
    });
    clearLatest();
  }, [latestNotification, clearLatest, toast, contactsMap, markConversationRead]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="care-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contacts</CardTitle>
            <div className="flex items-center gap-1">
              <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Start new chat">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start new chat</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      placeholder="Search contacts"
                      value={newChatSearch}
                      onChange={event => setNewChatSearch(event.target.value)}
                    />
                    <div className="max-h-72 overflow-y-auto rounded border">
                      {contactsWithoutConversation.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No available contacts</div>
                      ) : (
                        contactsWithoutConversation.map(contact => (
                          <button
                            key={contact.id}
                            onClick={() => {
                              handleSelectContact(contact);
                              setNewChatOpen(false);
                              setNewChatSearch("");
                            }}
                            className="w-full border-b last:border-b-0 px-3 py-2 text-left hover:bg-muted"
                          >
                            <p className="text-sm font-medium">{contact.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {contact.role || "contact"}
                              {contact.patient_name ? ` • Family of ${contact.patient_name}` : ""}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onLoadConversations} title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <CardDescription>Existing conversations and new chat contacts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading contacts</p>
          ) : (
            <>
              {conversationContacts.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Conversations</h3>
                  {conversationContacts.map((contact) => {
                    const conv = tempConversations.find(c => c.partner_id === contact.id);
                    const unreadCount = Math.max(conv?.unread_count ?? 0, unreadBySender[contact.id] ?? 0);
                    return (
                      <button key={contact.id} onClick={() => handleSelectContact(contact)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${selectedContact?.id === contact.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                        <Avatar>
                          {contact.avatar_url ? (
                            <AvatarImage src={contact.avatar_url} alt={contact.name} />
                          ) : (
                            <AvatarFallback>
                              {contact.role === "family" ? (
                                <Users className="w-4 h-4" />
                              ) : contact.role === "caregiver" ? (
                                <User className="w-4 h-4" />
                              ) : (
                                <Heart className="w-4 h-4" />
                              )}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                          {conv?.last_message && (
                            <p className="text-xs opacity-60 truncate">
                              {conv.last_message.message_type === 'audio' ? '🎙 Audio' : conv.last_message.content}
                            </p>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
                            {unreadCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {conversationContacts.length === 0 && (
                <div className="text-center py-6">
                  <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card className="care-card lg:col-span-2">
        <CardContent className="h-[600px] p-0">
          {selectedContact ? (
            <ChatInterface recipientId={selectedContact.id} recipientName={selectedContact.name} maxMessageWidth="max-w-full" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <MessageSquare className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">Select a contact to start chatting</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
