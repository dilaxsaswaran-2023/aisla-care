import { Router, Request, Response } from 'express';
import Reminder from '../models/Reminder';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/reminders
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const reminders = await Reminder.find({ patient_id: req.user!.userId })
      .sort({ scheduled_time: 1 })
      .limit(20);
    res.json(reminders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reminders
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.create({ ...req.body, patient_id: req.body.patient_id || req.user!.userId });
    res.status(201).json(reminder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reminders/:id/complete
router.patch('/:id/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const reminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      { completed_at: new Date() },
      { new: true }
    );
    res.json(reminder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
