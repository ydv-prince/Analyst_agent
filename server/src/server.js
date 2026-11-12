import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import keyRoutes from './routes/keyRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [])
];

// Security Middleware: Restrict CORS to configured client origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or same-origin server requests)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  })
);

// Body Parser & Cookie Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Health / Status Check Endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AI-Assisted Data Analysis Agent Backend',
    version: '1.0.0',
    database: {
      status: dbStateMap[dbState] || 'unknown',
      connected: dbState === 1
    },
    mistral: {
      configured: Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.trim() !== '')
    }
  });
});

// Mount Approved API Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/chat', chatRoutes);

// Catch-all 404 handler for unrecognized routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server & Connect Database
const startServer = async () => {
  const dbConnected = await connectDB();
  app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Database] MongoDB status: ${dbConnected ? 'CONNECTED' : 'NOT CONNECTED (Check MONGODB_URI)'}`);
    console.log(`[Mistral] API Key configured: ${Boolean(process.env.MISTRAL_API_KEY)}`);
  });
};

// Auto-start server only when executed directly (not during testing imports)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
