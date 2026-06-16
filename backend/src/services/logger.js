const logQueue = require('../queue/logQueue');

// Log types defined in the spec
const LOG_TYPES = {
  LOGIN:  'LoginLog',
  TASK:   'TaskLog',
  GROUP:  'GroupLog',
};

// Fire-and-forget — never throws, never blocks the caller
async function logEvent(userId, logType, action) {
  try {
    await logQueue.add('log', { userId: userId ?? null, logType, action });
  } catch (err) {
    console.error('[logger] Failed to queue log event:', err.message);
  }
}

module.exports = { logEvent, LOG_TYPES };
