import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Import routes
import authRoutes from './routes/auth.js';
import startupRoutes from './routes/startups.js';
import hackathonRoutes from './routes/hackathons.js';
import applicationRoutes from './routes/applications.js';
import screeningChatRoutes from './routes/screeningChats.js';
import builderSpaceRoutes from './routes/builderSpaces.js';
import teamRoutes from './routes/teams.js';

// Import services
import { messageBroadcastService } from './services/MessageBroadcastService.js';

// Load environment variables
dotenv.config({ path: '.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting (relaxed for development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for dev)
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Auth rate limiting (relaxed for development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 auth requests per windowMs (increased for dev)
  message: 'Too many authentication attempts, please try again later.',
});

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/startups', startupRoutes);
app.use('/api/hackathons', hackathonRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/screening-chats', screeningChatRoutes);
app.use('/api/builder-spaces', builderSpaceRoutes);
app.use('/api/teams', teamRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack }),
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Initialize WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');

  // Extract user ID from query params or headers
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');

  if (userId) {
    messageBroadcastService.addConnection(userId, ws);
    console.log(`User ${userId} connected to WebSocket`);

    ws.on('close', () => {
      messageBroadcastService.removeConnection(userId);
      console.log(`User ${userId} disconnected from WebSocket`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      messageBroadcastService.removeConnection(userId);
    });
  } else {
    console.warn('WebSocket connection without userId, closing');
    ws.close();
  }
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 BuilderSpace API server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket server ready`);
});

export default app;