import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, X, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/datetime";

interface BudiiChatProps {
  onClose: () => void;
}

const BudiiChat = ({ onClose }: BudiiChatProps) => {
  const nowTime = () => formatTime(new Date());

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "budii",
      text: "Hello! I'm Budii, your friendly care assistant. How are you feeling today?",
      time: nowTime(),
    }
  ]);
  const [input, setInput] = useState("");
  const { toast } = useToast();

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: "user",
      text: input,
      time: nowTime(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput("");

    // Get AI response from Budii
    try {
      const conversationHistory = [
        ...messages.map(msg => ({
          role: msg.type === "user" ? "user" : "assistant",
          content: msg.text
        })),
        { role: "user", content: messageText }
      ];

      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('aisla_token') || ''}`,
        },
        body: JSON.stringify({ messages: conversationHistory }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const budiiResponse = {
        id: messages.length + 2,
        type: "budii",
        text: data.message,
        time: nowTime(),
      };
      setMessages(prev => [...prev, budiiResponse]);
    } catch (error) {
      console.error('Budii error:', error);
      toast({
        title: "Connection Error",
        description: "Could not reach Budii. Please try again.",
        variant: "destructive",
      });
      // Fallback response
      const budiiResponse = {
        id: messages.length + 2,
        type: "budii",
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        time: nowTime(),
      };
      setMessages(prev => [...prev, budiiResponse]);
    }
  };

  return (
    <Card className="care-card max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary-glow/10 border-b border-care-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Budii</h3>
              <p className="text-xs text-muted-foreground font-normal">Your AI Care Assistant</p>
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.type === "user"
                  ? "bg-primary text-primary-foreground ml-4"
                  : "budii-message mr-4"
              }`}
            >
              <p className="text-sm leading-relaxed">{message.text}</p>
              <p className={`text-xs mt-2 ${
                message.type === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}>
                {message.time}
              </p>
            </div>
          </div>
        ))}
      </CardContent>

      <div className="p-4 border-t border-care-border">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 h-12 text-base"
          />
          <Button onClick={handleSend} size="lg" className="h-12 px-6">
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Budii is here to provide emotional support and reminders
        </p>
      </div>
    </Card>
  );
};

export default BudiiChat;
