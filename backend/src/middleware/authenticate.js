const pool = require('../db/pool');

async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.session_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { rows } = await pool.query(
      `SELECT u.*, g.status AS group_status
       FROM users u
       LEFT JOIN groups g ON u.group_id = g.group_id
       WHERE u.session_token = $1
         AND u.session_expires_at > NOW()
         AND u.is_active = true`,
      [token]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    if (rows[0].group_status === 'suspended') {
      return res.status(403).json({ error: 'Your organization has been suspended' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
