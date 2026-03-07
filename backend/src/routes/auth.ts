import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { generateTokenPair, rotateTokens, revokeUserTokens, verifyAccessToken } from '../lib/jwt';
import Token from '../models/Token';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
// Public — creates a new user account (super_admin is blocked)
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'email, password and full_name are required' });
      return;
    }
    if (role === 'super_admin') {
      res.status(403).json({ error: 'Cannot create super_admin via signup' });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ email, password: hashed, full_name, role: role || 'patient' });

    const { accessToken, refreshToken } = await generateTokenPair(user.id, user.role, user.corporate_id?.toString());

    res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, corporate_id: user.corporate_id },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { accessToken, refreshToken } = await generateTokenPair(user.id, user.role, user.corporate_id?.toString());

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, corporate_id: user.corporate_id },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
// Public — exchange a valid refresh token for a new token pair
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }

    const tokens = await rotateTokens(refreshToken);
    res.json(tokens);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// Accepts EITHER a valid access token (Authorization header) OR a refresh token
// in the request body. This allows logout even when the access token has expired.
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // 1. Try revoking via access token in the Authorization header
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = await verifyAccessToken(header.split(' ')[1]);
        await revokeUserTokens(payload.userId, payload.tokenId);
        res.json({ message: 'Logged out successfully' });
        return;
      } catch {
        // Access token invalid/expired — fall through to refresh token
      }
    }

    // 2. Fallback: revoke via refresh token in body
    const { refreshToken } = req.body;
    if (refreshToken) {
      const record = await Token.findOne({ refreshToken, isRevoked: false });
      if (record) {
        // Revoke this token AND any other active tokens for the same user
        await Token.updateMany({ userId: record.userId, isRevoked: false }, { isRevoked: true });
      }
    }

    // Always return 200 (idempotent — logging out when already logged out is fine)
    res.json({ message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ id: user.id, email: user.email, full_name: user.full_name, role: user.role, corporate_id: user.corporate_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
