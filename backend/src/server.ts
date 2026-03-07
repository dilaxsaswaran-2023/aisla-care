import dotenv from 'dotenv';
import path from 'path';
// Load .env.dev for development, fall back to .env
dotenv.config({ path: path.resolve(__dirname, '../../.env.dev') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import connectDB from './config/db';
import { initJwtSecret } from './lib/jwt';
import { seedSuperAdmin } from './utils/seeder';

// Route imports
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import alertRoutes from './routes/alerts';
import deviceRoutes from './routes/devices';
import reminderRoutes from './routes/reminders';
import relationshipRoutes from './routes/relationships';
import gpsRoutes from './routes/gps';
import auditLogRoutes from './routes/auditLogs';
import consentRecordRoutes from './routes/consentRecords';
import aiRoutes from './routes/ai';

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8030',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:8030' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/consent-records', consentRecordRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join', (userId: string) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('webrtc-signal', (data: { signal: any; to: string; from: string }) => {
    io.to(data.to).emit('webrtc-signal', data);
  });

  socket.on('call-end', (data: { to: string; from: string }) => {
    io.to(data.to).emit('call-ended', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start
const PORT = process.env.PORT || 5030;

connectDB().then(async () => {
  // Initialise JWT secret from DB (generates one if missing)
  await initJwtSecret();
  // Seed super-admin on first run
  await seedSuperAdmin();

  server.listen(PORT, () => {
    console.log(`AISLA Backend running on port ${PORT}`);
  });
});
