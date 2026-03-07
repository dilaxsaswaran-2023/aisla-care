import { Router, Request, Response } from 'express';
import Message from '../models/Message';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/messages/:recipientId – conversation between current user and recipient
router.get('/:recipientId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { recipientId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender_id: userId, recipient_id: recipientId },
        { sender_id: recipientId, recipient_id: userId },
      ],
    })
      .sort({ created_at: 1 })
      .limit(100);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/messages – send a message
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const senderId = req.user!.userId;
    const { recipient_id, content, message_type } = req.body;
    const message = await Message.create({
      sender_id: senderId,
      recipient_id,
      content,
      message_type: message_type || 'text',
    });

    // Emit via Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(recipient_id).emit('new-message', message);
    }

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
