const { Queue } = require('bullmq');
const { createRedisConnection } = require('../redis');

const logQueue = new Queue('logs', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100, // keep last 100 completed for debugging
    removeOnFail: 500,     // keep last 500 failed for inspection
  },
});

module.exports = logQueue;
