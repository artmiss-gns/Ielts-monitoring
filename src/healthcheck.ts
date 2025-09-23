import http from 'http';
import { URL } from 'url';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables early so MONITOR_BASE_URL/PORT are available
dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

interface MonitorConfig {
  baseUrl: string;
}

async function getConfig(): Promise<MonitorConfig> {
  const configPath = path.resolve(__dirname, '../config/monitor-config.json');
  const exampleConfigPath = path.resolve(__dirname, '../config/monitor-config.example.json');

  try {
    // Prefer environment variable if provided
    if (process.env.MONITOR_BASE_URL) {
      return { baseUrl: process.env.MONITOR_BASE_URL } as MonitorConfig;
    }

    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    } else {
      return await fs.readJson(exampleConfigPath);
    }
  } catch (error) {
    console.error('Error reading configuration:', error);
    throw new Error('Could not load configuration file.');
  }
}

function createHealthCheckServer(port: number = PORT) {
  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && reqUrl.pathname === '/health') {
        try {
          const config = await getConfig();
          const response = await axios.get(config.baseUrl, {
            timeout: 5000,
            maxRedirects: 3,
            validateStatus: () => true,
            headers: { 'User-Agent': 'IELTS-Monitor-HealthCheck/1.0' }
          });

          if (response.status >= 200 && response.status < 300) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end('OK');
          } else {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Service Unavailable');
          }
        } catch (error) {
          console.error('Health check failed:', error);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Service Unavailable');
        }
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    } catch (error) {
      console.error('Error handling request:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  return {
    start: () => {
      return new Promise((resolve) => {
        server.listen(port, '0.0.0.0', () => {
          console.log(`Health check server running on port ${port}`);
          resolve(server);
        });
      });
    },
    stop: () => {
      return new Promise((resolve) => {
        server.close(() => {
          console.log('Health check server stopped');
          resolve(undefined);
        });
      });
    }
  };
}

// Only start the server if this file is run directly
if (require.main === module) {
  const healthCheckServer = createHealthCheckServer();
  
  healthCheckServer.start().then(() => {
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down health check server');
      healthCheckServer.stop().then(() => process.exit(0));
    });
  }).catch((error) => {
    console.error('Failed to start health check server:', error);
    process.exit(1);
  });
}

export { getConfig, createHealthCheckServer };
