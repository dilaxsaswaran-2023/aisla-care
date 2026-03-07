import { Router, Request, Response } from 'express';
import GpsLocation from '../models/GpsLocation';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/gps
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const location = await GpsLocation.create({
      user_id: req.user!.userId,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracy: req.body.accuracy || 0,
    });
    res.status(201).json(location);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gps/latest
router.get('/latest', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || req.user!.userId;
    const location = await GpsLocation.findOne({ user_id: userId }).sort({ created_at: -1 });
    res.json(location);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
