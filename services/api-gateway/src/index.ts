import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables from .env file
dotenv.config();

// --- Configuration ---
const PORT = process.env.PORT || 5000;
const RECOMMENDATION_SERVICE_URL = process.env.RECOMMENDATION_SERVICE_URL || 'http://recommendation-engine:8000';
const EVENT_TRACKER_SERVICE_URL = process.env.EVENT_TRACKER_SERVICE_URL || 'http://event-tracker:8080';
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// --- Application Initialization ---
const app = express();

// --- Core Middleware ---

// Enhance security with Helmet's default headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing (CORS)
const corsOptions = {
  origin: ALLOWED_ORIGIN,
  optionsSuccessStatus: 200, // For legacy browser support
};
app.use(cors(corsOptions));

// Parse incoming JSON requests
app.use(express.json());

// Log HTTP requests for debugging and monitoring. 'morgan("combined")' is a good default for production.
app.use(morgan('dev'));

// --- Health Check Endpoint ---

/**
 * @route GET /health
 * @description A simple health check endpoint to verify the API gateway is running.
 * Useful for load balancers and uptime monitoring.
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// --- Service Proxying ---

// Common proxy options
const commonProxyOptions: Options = {
  changeOrigin: true, // Necessary for virtual-hosted sites
  onProxyReq: (proxyReq, req, res) => {
    // Add a custom header to identify requests coming from the gateway
    proxyReq.setHeader('X-Forwarded-By', 'api-gateway');
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    if (!res.headersSent) {
        res.status(502).json({ message: 'Bad Gateway', error: err.message });
    }
  },
};

/**
 * @route /api/recommendations/*
 * @description Proxies all requests starting with `/api/recommendations` to the Python Recommendation Engine service.
 * The path is rewritten to remove the `/api/recommendations` prefix.
 * e.g., `/api/recommendations/for-user/123` -> `http://recommendation-engine:8000/for-user/123`
 */
app.use(
  '/api/recommendations',
  createProxyMiddleware({
    ...commonProxyOptions,
    target: RECOMMENDATION_SERVICE_URL,
    pathRewrite: {
      '^/api/recommendations': '', // remove base path
    },
  })
);

/**
 * @route /api/events/*
 * @description Proxies all requests starting with `/api/events` to the Go Event Tracker service.
 * The path is rewritten to remove the `/api/events` prefix.
 * e.g., `/api/events/track` -> `http://event-tracker:8080/track`
 */
app.use(
  '/api/events',
  createProxyMiddleware({
    ...commonProxyOptions,
    target: EVENT_TRACKER_SERVICE_URL,
    pathRewrite: {
      '^/api/events': '', // remove base path
    },
  })
);

// --- Error Handling Middleware ---

// Handle 404 Not Found for any unhandled routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Not Found: The requested resource does not exist on the API Gateway.' });
});

// Generic error handler. This should be the last middleware.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// --- Server Startup ---
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 API Gateway is running on http://localhost:${PORT}`);
  console.log(`-> Proxying to Recommendation Engine at ${RECOMMENDATION_SERVICE_URL}`);
  console.log(`-> Proxying to Event Tracker at ${EVENT_TRACKER_SERVICE_URL}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    // Here you might close database connections or other resources
    process.exit(0);
  });

  // Force shutdown after a timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000); // 10 seconds
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));