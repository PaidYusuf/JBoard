const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db/pool');
const { logEvent, LOG_TYPES } = require('../services/logger');

const SALT_ROUNDS = 10;
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10);
const RESET_TOKEN_EXPIRY_MINUTES = 60;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sessionExpiry() {
  const d = new Date();
  d.setHours(d.getHours() + SESSION_EXPIRY_HOURS);
  return d;
}

function safeUser(u) {
  return {
    userId: u.user_id,
    email: u.email,
    fname: u.fname,
    lname: u.lname,
    role: u.role,
    accountType: u.account_type,
    groupId: u.group_id,
  };
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = rows[0];

    // Constant-time failure — same message for unknown email and wrong password
    const hash = user?.password_hash || '$2b$10$invalidhashtopreventtimingattack000000000000000000000000';
    const match = await bcrypt.compare(password, hash);

    if (!user || !match) {
      logEvent(user?.user_id ?? null, LOG_TYPES.LOGIN, `Failed login attempt for email: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    if (user.group_id) {
      const { rows: g } = await pool.query(
        'SELECT status FROM groups WHERE group_id = $1',
        [user.group_id]
      );
      if (g[0]?.status === 'suspended') {
        return res.status(403).json({ error: 'Your organization has been suspended' });
      }
    }

    const token = generateToken();
    const expiresAt = sessionExpiry();

    await pool.query(
      `UPDATE users
       SET session_token = $1, session_expires_at = $2, last_login = NOW()
       WHERE user_id = $3`,
      [token, expiresAt, user.user_id]
    );

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
    });

    logEvent(user.user_id, LOG_TYPES.LOGIN, `User logged in: ${user.email}`);
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ────────────────────────────────────────────────────
async function logout(req, res, next) {
  try {
    const token = req.cookies?.session_token;
    if (token) {
      const { rows } = await pool.query(
        'UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE session_token = $1 RETURNING user_id',
        [token]
      );
      if (rows.length) logEvent(rows[0].user_id, LOG_TYPES.LOGIN, 'User logged out');
    }
    res.clearCookie('session_token');
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/validate-invite-code ─────────────────────────────────────
async function validateInviteCode(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const { rows } = await pool.query(
      `SELECT ic.code_id, g.group_name
       FROM invite_codes ic
       JOIN groups g ON ic.group_id = g.group_id
       WHERE ic.code_hash = $1
         AND ic.is_used = false
         AND ic.expires_at > NOW()`,
      [sha256(code)]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }

    res.json({ groupName: rows[0].group_name });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/register ──────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { fname, lname, email, password, inviteCode } = req.body;

    if (!fname || !lname || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.toLowerCase();

    const { rows: exists } = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [normalizedEmail]
    );
    if (exists.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    if (inviteCode) {
      await registerCompanyUser({ fname, lname, email: normalizedEmail, passwordHash, inviteCode, res });
    } else {
      await registerSoloUser({ fname, lname, email: normalizedEmail, passwordHash, res });
    }
  } catch (err) {
    next(err);
  }
}

async function registerCompanyUser({ fname, lname, email, passwordHash, inviteCode, res }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Row-level lock prevents simultaneous registrations from bypassing MaxUser
    const { rows: codeRows } = await client.query(
      `SELECT ic.code_id, ic.group_id, p.max_user
       FROM invite_codes ic
       JOIN groups g ON ic.group_id = g.group_id
       JOIN plans p ON g.plan_id = p.plan_id
       WHERE ic.code_hash = $1
         AND ic.is_used = false
         AND ic.expires_at > NOW()
       FOR UPDATE`,
      [sha256(inviteCode)]
    );

    if (!codeRows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }

    const { code_id, group_id, max_user } = codeRows[0];

    const { rows: countRows } = await client.query(
      'SELECT COUNT(*) FROM users WHERE group_id = $1',
      [group_id]
    );

    if (parseInt(countRows[0].count, 10) >= max_user) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This group has reached its maximum user limit' });
    }

    const { rows: userRows } = await client.query(
      `INSERT INTO users (group_id, email, password_hash, fname, lname, role, account_type)
       VALUES ($1, $2, $3, $4, $5, 'user', 'company')
       RETURNING user_id`,
      [group_id, email, passwordHash, fname, lname]
    );

    await client.query(
      'UPDATE invite_codes SET is_used = true, used_by = $1 WHERE code_id = $2',
      [userRows[0].user_id, code_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function registerSoloUser({ fname, lname, email, passwordHash, res }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: planRows } = await client.query(
      "SELECT plan_id FROM plans WHERE plan_name = 'Free' LIMIT 1"
    );
    if (!planRows.length) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Default plan not configured' });
    }

    const { rows: groupRows } = await client.query(
      `INSERT INTO groups (group_name, plan_id, type, status)
       VALUES ($1, $2, 'personal', 'active')
       RETURNING group_id`,
      [`${fname}'s Workspace`, planRows[0].plan_id]
    );

    await client.query(
      `INSERT INTO users (group_id, email, password_hash, fname, lname, role, account_type)
       VALUES ($1, $2, $3, $4, $5, 'admin', 'solo')`,
      [groupRows[0].group_id, email, passwordHash, fname, lname]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── POST /api/auth/forgot-password ──────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { rows } = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always respond the same way — prevents email enumeration
    if (rows.length) {
      const resetToken = generateToken();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

      await pool.query(
        'UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE user_id = $3',
        [sha256(resetToken), expiresAt, rows[0].user_id]
      );

      // Production: send email with link containing resetToken
      // Development: log to console so you can test without an email server
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
      }
    }

    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/reset-password ───────────────────────────────────────────
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { rows } = await pool.query(
      `SELECT user_id FROM users
       WHERE reset_token_hash = $1 AND reset_token_expires_at > NOW()`,
      [sha256(token)]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Invalidate all sessions alongside the reset
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_token_hash = NULL,
           reset_token_expires_at = NULL,
           session_token = NULL,
           session_expires_at = NULL
       WHERE user_id = $2`,
      [passwordHash, rows[0].user_id]
    );

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT group_name FROM groups WHERE group_id = $1',
      [req.user.group_id]
    );
    res.json({
      user: {
        userId: req.user.user_id,
        email: req.user.email,
        fname: req.user.fname,
        lname: req.user.lname,
        role: req.user.role,
        accountType: req.user.account_type,
        groupId: req.user.group_id,
        groupName: rows[0]?.group_name ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, register, validateInviteCode, forgotPassword, resetPassword, getMe };
