import express from 'express';

console.log('Health check module loaded.');

const startHealthCheckServer = () => {
  console.log('Starting health check server...');
  const app = express();
  const port = process.env.PORT || 8000;

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
  });
};

export default startHealthCheckServer;