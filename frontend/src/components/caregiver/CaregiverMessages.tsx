import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Heart, MessageSquare, RefreshCw } from "lucide-react";
import ChatInterface from "@/components/chat/ChatInterface";
import { api } from "@/lib/api";

interface Contact { id: string; name: string; }

interface FamilyContact {
  id: string;
  name: string;
  patientName: string;
}

interface Conversation {
  partner_id: string;
  partner_name: string;
  unread_count: number;
  last_message?: { content: string; message_type: string; created_at: string };
}

interface CaregiverMessagesProps {
  patients: Contact[];
  familyMembers: FamilyContact[];
  loading: boolean;
  onLoadConversations: () => void;
}

export const CaregiverMessages = ({
  patients,
  familyMembers,
  loading,
  onLoadConversations,
}: CaregiverMessagesProps) => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (patients.length > 0 && !selectedContact) {
      setSelectedContact(patients[0]);
    }
  }, [patients, selectedContact]);

  useEffect(() => {
    onLoadConversations();
  }, [onLoadConversations]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="care-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contacts</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onLoadConversations} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <CardDescription>Select someone to start chatting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading contacts</p>
          ) : (
            <>
              {patients.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Patients</h3>
                  {patients.map((patient) => {
                    const conv = conversations.find(c => c.partner_id === patient.id);
                    return (
                      <button key={patient.id} onClick={() => setSelectedContact(patient)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedContact?.id === patient.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                        <Users className="w-4 h-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{patient.name}</p>
                          {conv?.last_message && (
                            <p className="text-xs opacity-60 truncate">
                              {conv.last_message.message_type === 'audio' ? '🎙 Audio' : conv.last_message.content}
                            </p>
                          )}
                        </div>
                        {(conv?.unread_count ?? 0) > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
                            {conv!.unread_count}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {familyMembers.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">Family Members</h3>
                  {familyMembers.map((family) => {
                    const conv = conversations.find(c => c.partner_id === family.id);
                    return (
                      <button key={family.id} onClick={() => setSelectedContact({ id: family.id, name: family.name })}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedContact?.id === family.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                        <Heart className="w-4 h-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{family.name}</p>
                          <p className="text-[10px] opacity-60 truncate">
                            {family.patientName ? `Family of ${family.patientName}` : 'Family Member'}
                          </p>
                        </div>
                        {(conv?.unread_count ?? 0) > 0 && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
                            {conv!.unread_count}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {patients.length === 0 && familyMembers.length === 0 && (
                <div className="text-center py-6">
                  <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No contacts available</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Card className="care-card lg:col-span-2">
        <CardContent className="h-[600px] p-0">
          {selectedContact ? (
            <ChatInterface recipientId={selectedContact.id} recipientName={selectedContact.name} />
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
