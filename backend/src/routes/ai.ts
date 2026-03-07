import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/ai/chat – Budii AI chat (rule-based placeholder)
router.post('/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

    let reply: string;

    if (lastMessage.includes('medication') || lastMessage.includes('medicine')) {
      reply = "It's important to take your medication on time. Would you like me to set a reminder for you?";
    } else if (lastMessage.includes('help') || lastMessage.includes('emergency')) {
      reply = "If you're in an emergency, please press the SOS button. I'm here to help with anything else you need.";
    } else if (lastMessage.includes('lonely') || lastMessage.includes('alone') || lastMessage.includes('sad')) {
      reply = "I'm sorry you're feeling that way. Remember, your caregivers and family are just a call away. Would you like me to connect you with someone?";
    } else if (lastMessage.includes('hello') || lastMessage.includes('hi') || lastMessage.includes('hey')) {
      reply = "Hello there! How are you feeling today? I'm here to chat and help with anything you need.";
    } else if (lastMessage.includes('thank')) {
      reply = "You're welcome! I'm always here for you. Is there anything else I can help with?";
    } else if (lastMessage.includes('weather')) {
      reply = "I'd love to help with the weather, but I don't have that capability yet. You could try looking out the window or asking your caregiver!";
    } else if (lastMessage.includes('food') || lastMessage.includes('eat') || lastMessage.includes('hungry')) {
      reply = "Eating regular meals is important for your health. Would you like me to remind your caregiver about meal preparation?";
    } else if (lastMessage.includes('sleep') || lastMessage.includes('tired')) {
      reply = "Getting good sleep is essential. Try to maintain a regular sleep schedule. Would you like me to set a bedtime reminder?";
    } else if (lastMessage.includes('exercise') || lastMessage.includes('walk')) {
      reply = "Light exercise is great for your health! Even a short walk can make a big difference. Shall I set a reminder for your daily walk?";
    } else {
      reply = "I understand. I'm here to support you throughout your day. Feel free to ask me about medications, reminders, or just chat!";
    }

    res.json({ message: reply });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
