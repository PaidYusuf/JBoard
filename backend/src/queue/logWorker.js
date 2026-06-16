const { Worker } = require('bullmq');
const { createRedisConnection } = require('../redis');
const pool = require('../db/pool');

const worker = new Worker(
  'logs',
  async (job) => {
    const { userId, logType, action } = job.data;
    await pool.query(
      'INSERT INTO logs (user_id, log_type, action) VALUES ($1, $2, $3)',
      [userId ?? null, logType, action]
    );
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`[log] ${job.data.logType} — ${job.data.action}`);
});

worker.on('failed', (job, err) => {
  console.error(`[log] Job ${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
});

module.exports = worker;
