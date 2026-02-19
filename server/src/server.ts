import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Import database connection
import { connectDB } from './db/connection.js';

// Import routes
import authRoutes from './routes/auth.js';
import startupRoutes from './routes/startups.js';
import hackathonRoutes from './routes/hackathons.js';
import applicationRoutes from './routes/applications.js';
import screeningChatRoutes from './routes/screeningChats.js';
import builderSpaceRoutes from './routes/builderSpaces.js';
import teamRoutes from './routes/teams.js';
import statsRoutes from './routes/stats.js';

// Import services
import { messageBroadcastService } from './services/MessageBroadcastService.js';

// Load environment variables
dotenv.config({ path: '.env' });

// Connect to MongoDB (continue even if it fails for local development)
try {
  await connectDB();
  console.log('✅ MongoDB connected - all features available');
} catch (error) {
  console.warn('⚠️  MongoDB connection failed - server will run in limited mode');
  console.warn('   Some features may not work without database connection');
  console.warn('   Error:', error instanceof Error ? error.message : 'Unknown error');
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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
  origin: (origin, callback) => {
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // In production, only allow specific origin
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
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

// Test connection page
app.get('/test-connection.html', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Backend Connection Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #000;
            color: #fff;
        }
        .status {
            padding: 20px;
            margin: 10px 0;
            border-radius: 8px;
            font-weight: bold;
        }
        .success { background: #10b981; }
        .error { background: #ef4444; }
        .info { background: #3b82f6; }
        button {
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            background: #fff;
            color: #000;
            border: none;
            border-radius: 8px;
            margin: 5px;
        }
    </style>
</head>
<body>
    <h1>Backend Connection Test</h1>
    <p>Current URL: <span id="currentUrl"></span></p>
    <p>Backend URL: <span id="backendUrl"></span></p>
    
    <button onclick="testConnection()">Test Connection</button>
    <button onclick="testSignup()">Test Signup</button>
    
    <div id="results"></div>

    <script>
        const currentHost = window.location.hostname;
        const backendUrl = currentHost !== 'localhost' && currentHost !== '127.0.0.1' 
            ? \`http://\${currentHost}:3001/api\`
            : 'http://localhost:3001/api';
        
        document.getElementById('currentUrl').textContent = window.location.href;
        document.getElementById('backendUrl').textContent = backendUrl;

        async function testConnection() {
            const results = document.getElementById('results');
            results.innerHTML = '<div class="status info">Testing connection...</div>';
            
            try {
                const response = await fetch(\`\${backendUrl.replace('/api', '')}/health\`);
                const data = await response.json();
                results.innerHTML = \`<div class="status success">✅ Backend is reachable!<br>Status: \${data.status}</div>\`;
            } catch (error) {
                results.innerHTML = \`<div class="status error">❌ Cannot reach backend<br>Error: \${error.message}</div>\`;
            }
        }

        async function testSignup() {
            const results = document.getElementById('results');
            results.innerHTML = '<div class="status info">Testing signup endpoint...</div>';
            
            try {
                const response = await fetch(\`\${backendUrl}/auth/signup\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'test@test.com',
                        password: 'test123',
                        name: 'Test User'
                    })
                });
                
                if (response.ok) {
                    results.innerHTML = '<div class="status success">✅ Signup endpoint is working!</div>';
                } else {
                    const error = await response.json();
                    results.innerHTML = \`<div class="status info">ℹ️ Signup endpoint responded<br>Status: \${response.status}<br>Message: \${error.error || 'Unknown'}</div>\`;
                }
            } catch (error) {
                results.innerHTML = \`<div class="status error">❌ Cannot reach signup endpoint<br>Error: \${error.message}</div>\`;
            }
        }
    </script>
</body>
</html>`);
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/startups', startupRoutes);
app.use('/api/hackathons', hackathonRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/screening-chats', screeningChatRoutes);
app.use('/api/builder-spaces', builderSpaceRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/stats', statsRoutes);

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

// Initialize WebSocket through MessageBroadcastService
messageBroadcastService.initialize(httpServer);

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Kaivan API server running on port ${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Network access: http://0.0.0.0:${PORT} (accessible from all network interfaces)`);
  console.log(`🔓 CORS: Allowing all origins in development mode`);
  console.log(`🔌 WebSocket server ready`);
});

export default app;