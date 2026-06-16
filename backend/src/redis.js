const IORedis = require('ioredis');

// BullMQ requires a separate IORedis instance per Queue and per Worker.
// Use this factory so each caller gets its own connection.
function createRedisConnection() {
  return new IORedis(process.env.REDIS_URL || 'redis://redis:6379', {
    maxRetriesPerRequest: null, // required by BullMQ
  });
}

module.exports = { createRedisConnection };
