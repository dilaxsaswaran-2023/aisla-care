import { Router, Request, Response } from 'express';
import Alert from '../models/Alert';
import AuditLog from '../models/AuditLog';
import GpsLocation from '../models/GpsLocation';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/alerts
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const alerts = await Alert.find().sort({ created_at: -1 }).limit(50);
    res.json(alerts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const alert = await Alert.create(req.body);

    // Audit log
    await AuditLog.create({
      user_id: req.user!.userId,
      action: `${req.body.alert_type}_alert_created`,
      entity_type: 'alert',
      entity_id: alert.id,
      metadata: { priority: alert.priority },
    });

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) io.emit('new-alert', alert);

    res.status(201).json(alert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/alerts/:id
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(alert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/sos – quick SOS alert
router.post('/sos', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get latest GPS
    const latestGps = await GpsLocation.findOne({ user_id: userId }).sort({ created_at: -1 });

    const alert = await Alert.create({
      patient_id: userId,
      alert_type: 'sos',
      status: 'active',
      priority: 'critical',
      title: 'SOS Emergency Alert',
      message: 'Patient triggered SOS button',
      latitude: latestGps?.latitude,
      longitude: latestGps?.longitude,
    });

    await AuditLog.create({
      user_id: userId,
      action: 'sos_alert_created',
      entity_type: 'alert',
      entity_id: alert.id,
      metadata: { priority: 'critical' },
    });

    const io = req.app.get('io');
    if (io) io.emit('new-alert', alert);

    res.status(201).json(alert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
