import { Router, Request, Response } from 'express';
import ConsentRecord from '../models/ConsentRecord';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/consent-records
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const records = await ConsentRecord.find()
      .populate('patient_id', 'full_name email')
      .populate('granted_to', 'full_name email')
      .sort({ created_at: -1 });
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/consent-records
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const record = await ConsentRecord.create(req.body);
    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
