import express from 'express';

const startHealthCheckServer = () => {
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