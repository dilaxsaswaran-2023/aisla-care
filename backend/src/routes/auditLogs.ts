import { Router, Request, Response } from 'express';
import AuditLog from '../models/AuditLog';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/audit-logs
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    if (req.query.userId) filter.user_id = req.query.userId;
    const logs = await AuditLog.find(filter).sort({ created_at: -1 }).limit(50);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audit-logs
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const log = await AuditLog.create({ ...req.body, user_id: req.body.user_id || req.user!.userId });
    res.status(201).json(log);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
