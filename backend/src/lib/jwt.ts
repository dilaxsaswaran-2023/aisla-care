import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import SystemConfig from '../models/SystemConfig';
import Token from '../models/Token';

// ─── Token lifetimes ────────────────────────────────────────────────────────
const ACCESS_TOKEN_TTL_MS  = 5 * 24 * 60 * 60 * 1000;  // 5 days
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_TOKEN_EXP     = '5d';
const REFRESH_TOKEN_EXP    = '30d';

// ─── Payload types ──────────────────────────────────────────────────────────
export interface JwtPayload {
  userId:      string;
  role:        string;
  corporate_id?: string;
  tokenId:     string;
  type:        'access' | 'refresh';
}

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
}

// ─── Module-level secret cache ──────────────────────────────────────────────
let cachedSecret: string | null = null;

/**
 * Call once at startup (after DB is connected) to load or generate the JWT signing secret.
 */
export const initJwtSecret = async (): Promise<void> => {
  let config = await SystemConfig.findOne({ key: 'jwt_secret' });
  if (!config) {
    const secret = crypto.randomBytes(64).toString('hex');
    config = await SystemConfig.create({ key: 'jwt_secret', value: secret });
    console.log('✔ Generated and stored new JWT secret in DB');
  }
  cachedSecret = config.value;
  console.log('✔ JWT secret loaded from DB');
};

function getSecret(): string {
  if (!cachedSecret) throw new Error('JWT secret not initialised — call initJwtSecret() first');
  return cachedSecret;
}

// ─── Token generation ───────────────────────────────────────────────────────

/**
 * Issue a fresh access + refresh token pair for a user.
 * All previous active tokens for the user are revoked (single-session semantics).
 */
export const generateTokenPair = async (userId: string, role: string, corporate_id?: string): Promise<TokenPair> => {
  // Revoke all existing active tokens for this user
  await Token.updateMany({ userId, isRevoked: false }, { isRevoked: true });

  // Pre-generate the MongoDB _id so we can embed it in the JWT payload
  const tokenId = new mongoose.Types.ObjectId();
  const now = Date.now();

  const payload: JwtPayload = { userId, role, tokenId: tokenId.toString(), type: 'access' };
  if (corporate_id) payload.corporate_id = corporate_id;

  const accessToken = jwt.sign(
    payload,
    getSecret(),
    { expiresIn: ACCESS_TOKEN_EXP } as jwt.SignOptions,
  );

  const refreshPayload: JwtPayload = { userId, role, tokenId: tokenId.toString(), type: 'refresh' };
  if (corporate_id) refreshPayload.corporate_id = corporate_id;

  const refreshToken = jwt.sign(
    refreshPayload,
    getSecret(),
    { expiresIn: REFRESH_TOKEN_EXP } as jwt.SignOptions,
  );

  await Token.create({
    _id:                   tokenId,
    userId,
    accessToken,
    refreshToken,
    accessTokenExpiresAt:  new Date(now + ACCESS_TOKEN_TTL_MS),
    refreshTokenExpiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
  });

  return { accessToken, refreshToken };
};

// ─── Token verification ─────────────────────────────────────────────────────

/**
 * Verify an access token: checks JWT signature + confirms the record is active in DB.
 */
export const verifyAccessToken = async (token: string): Promise<JwtPayload> => {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    throw new Error('Invalid or expired access token');
  }

  if (payload.type !== 'access') throw new Error('Token is not an access token');

  const record = await Token.findById(payload.tokenId);
  if (!record || record.isRevoked || record.accessToken !== token) {
    throw new Error('Token has been revoked');
  }

  return payload;
};

// ─── Token rotation (refresh) ───────────────────────────────────────────────

/**
 * Validate a refresh token, revoke it, and issue a brand-new token pair.
 */
export const rotateTokens = async (refreshToken: string): Promise<TokenPair> => {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(refreshToken, getSecret()) as JwtPayload;
  } catch {
    throw new Error('Invalid or expired refresh token');
  }

  if (payload.type !== 'refresh') throw new Error('Token is not a refresh token');

  const record = await Token.findById(payload.tokenId);
  if (!record || record.isRevoked || record.refreshToken !== refreshToken) {
    throw new Error('Refresh token not found or already revoked');
  }

  // Revoke the old record before issuing a new pair
  record.isRevoked = true;
  await record.save();

  return generateTokenPair(payload.userId, payload.role, payload.corporate_id);
};

// ─── Revocation ─────────────────────────────────────────────────────────────

/**
 * Revoke a specific token record (logout) or all active tokens for a user.
 */
export const revokeUserTokens = async (userId: string, tokenId?: string): Promise<void> => {
  if (tokenId) {
    await Token.findByIdAndUpdate(tokenId, { isRevoked: true });
  } else {
    await Token.updateMany({ userId, isRevoked: false }, { isRevoked: true });
  }
};
