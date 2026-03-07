import { Router, Request, Response } from 'express';
import Device from '../models/Device';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/devices
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const filter: any = {};
    if (req.query.patientId) filter.patient_id = req.query.patientId;
    const devices = await Device.find(filter).sort({ created_at: -1 });
    res.json(devices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const device = await Device.create(req.body);
    res.status(201).json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/devices/:id
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const device = await Device.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/devices/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await Device.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
