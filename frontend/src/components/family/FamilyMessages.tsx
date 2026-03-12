import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import ChatInterface from "@/components/chat/ChatInterface";

interface FamilyMessagesProps {
  caregiverId: string | null;
  caregiverName: string;
}

const FamilyMessages = ({ caregiverId, caregiverName }: FamilyMessagesProps) => {
  if (!caregiverId) {
    return (
      <Card className="care-card">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <MessageSquare className="w-10 h-10 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No caregiver assigned yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="care-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Messages with {caregiverName}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ChatInterface recipientId={caregiverId} recipientName={caregiverName} />
      </CardContent>
    </Card>
  );
};

export default FamilyMessages;
