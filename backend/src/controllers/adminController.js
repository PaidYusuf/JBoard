const crypto = require('crypto');
const path   = require('path');
const pool   = require('../db/pool');
const { logEvent, LOG_TYPES } = require('../services/logger');

const UPLOADS_ROOT = path.join('/app', 'uploads');

const INVITE_CODE_EXPIRY_HOURS = 72;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ── GET /api/admin/tasks ─────────────────────────────────────────────────────
async function getTasks(req, res, next) {
  try {
    const { status, userId, startDate, endDate, projectId } = req.query;
    const groupId = req.user.group_id;

    const { rows } = await pool.query(
      `SELECT
         t.*,
         u.fname, u.lname, u.email,
         cb.fname AS creator_fname, cb.lname AS creator_lname,
         p.project_name
       FROM tasks t
       JOIN users u  ON t.user_id    = u.user_id
       JOIN users cb ON t.created_by = cb.user_id
       LEFT JOIN projects p ON t.project_id = p.project_id
       WHERE t.group_id = $1
         AND ($2::text IS NULL OR t.status     = $2)
         AND ($3::int  IS NULL OR t.user_id    = $3)
         AND ($4::date IS NULL OR t.start_date >= $4)
         AND ($5::date IS NULL OR t.end_date   <= $5)
         AND ($6::int  IS NULL OR t.project_id  = $6)
       ORDER BY t.created_at DESC`,
      [groupId, status ?? null, userId ?? null, startDate ?? null, endDate ?? null, projectId ?? null]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/admin/tasks ────────────────────────────────────────────────────
async function createTask(req, res, next) {
  try {
    const { assignedUserId, taskName, taskDetails, startDate, endDate } = req.body;
    const groupId = req.user.group_id;

    if (!assignedUserId || !taskName || !startDate || !endDate) {
      return res.status(400).json({ error: 'assignedUserId, taskName, startDate, and endDate are required' });
    }

    // IDOR check — assigned user must belong to the same group
    const userCheck = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 AND group_id = $2',
      [assignedUserId, groupId]
    );
    if (!userCheck.rows.length) {
      return res.status(403).json({ error: 'Assigned user does not belong to your group' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, group_id, created_by, task_name, task_details, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [assignedUserId, groupId, req.user.user_id, taskName, taskDetails ?? null, startDate, endDate]
    );

    logEvent(req.user.user_id, LOG_TYPES.TASK, `Created task "${taskName}" assigned to user ${assignedUserId}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/admin/tasks/:taskId ─────────────────────────────────────────────
async function getTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const groupId = req.user.group_id;

    const { rows } = await pool.query(
      `SELECT t.*,
              u.fname, u.lname, u.email,
              cb.fname AS creator_fname, cb.lname AS creator_lname
         FROM tasks t
         JOIN users u  ON t.user_id    = u.user_id
         JOIN users cb ON t.created_by = cb.user_id
        WHERE t.task_id = $1 AND t.group_id = $2`,
      [taskId, groupId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Task not found' });

    const { rows: files } = await pool.query(
      'SELECT file_id, original_name, mime_type, file_size, uploaded_at FROM files WHERE task_id = $1',
      [taskId]
    );

    res.json({ ...rows[0], files });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/admin/tasks/:taskId ───────────────────────────────────────────
async function updateTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const { taskName, taskDetails, startDate, endDate } = req.body;
    const groupId = req.user.group_id;

    if (!taskName && !taskDetails && !startDate && !endDate) {
      return res.status(400).json({ error: 'Provide at least one field to update' });
    }

    // Verify task belongs to this admin's group
    const existing = await pool.query(
      'SELECT * FROM tasks WHERE task_id = $1 AND group_id = $2',
      [taskId, groupId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Task not found in your group' });
    }

    const { rows } = await pool.query(
      `UPDATE tasks
       SET task_name    = COALESCE($1, task_name),
           task_details = COALESCE($2, task_details),
           start_date   = COALESCE($3, start_date),
           end_date     = COALESCE($4, end_date)
       WHERE task_id = $5 AND group_id = $6
       RETURNING *`,
      [taskName ?? null, taskDetails ?? null, startDate ?? null, endDate ?? null, taskId, groupId]
    );

    logEvent(req.user.user_id, LOG_TYPES.TASK, `Updated task ${taskId}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/admin/tasks/:taskId ──────────────────────────────────────────
async function deleteTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const groupId = req.user.group_id;

    const { rows } = await pool.query(
      'DELETE FROM tasks WHERE task_id = $1 AND group_id = $2 RETURNING task_name',
      [taskId, groupId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Task not found in your group' });
    }

    logEvent(req.user.user_id, LOG_TYPES.TASK, `Deleted task ${taskId}: "${rows[0].task_name}"`);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/admin/gantt ─────────────────────────────────────────────────────
async function getGantt(req, res, next) {
  try {
    const groupId = req.user.group_id;

    const { rows } = await pool.query(
      `SELECT
         t.task_id, t.task_name, t.status, t.start_date, t.end_date,
         u.user_id, u.fname, u.lname
       FROM tasks t
       JOIN users u ON t.user_id = u.user_id
       WHERE t.group_id = $1
       ORDER BY t.start_date ASC`,
      [groupId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/admin/statistics ────────────────────────────────────────────────
async function getStatistics(req, res, next) {
  try {
    const groupId = req.user.group_id;

    const { rows } = await pool.query(
      `SELECT
         u.user_id, u.fname, u.lname, u.email,
         COUNT(t.task_id)::int                                                              AS total_tasks,
         COUNT(CASE WHEN t.status = 'completed'   THEN 1 END)::int                         AS completed,
         COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END)::int                         AS in_progress,
         COUNT(CASE WHEN t.status = 'not_started' THEN 1 END)::int                         AS not_started,
         COUNT(CASE WHEN t.status != 'completed' AND t.end_date < CURRENT_DATE THEN 1 END)::int AS overdue
       FROM users u
       LEFT JOIN tasks t ON t.user_id = u.user_id AND t.group_id = $1
       WHERE u.group_id = $1 AND u.role != 'superadmin'
       GROUP BY u.user_id
       ORDER BY u.fname ASC`,
      [groupId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/admin/members ───────────────────────────────────────────────────
async function getMembers(req, res, next) {
  try {
    const groupId = req.user.group_id;

    const { rows } = await pool.query(
      `SELECT user_id, fname, lname, email, role, is_active, created_at
       FROM users
       WHERE group_id = $1 AND role != 'superadmin'
       ORDER BY fname ASC`,
      [groupId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/admin/members/:userId ────────────────────────────────────────
async function removeMember(req, res, next) {
  try {
    const { userId } = req.params;
    const groupId = req.user.group_id;

    // Prevent admin from removing themselves
    if (parseInt(userId, 10) === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot remove yourself from the group' });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET is_active = false, group_id = NULL,
           session_token = NULL, session_expires_at = NULL
       WHERE user_id = $1 AND group_id = $2
       RETURNING email`,
      [userId, groupId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Member not found in your group' });
    }

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Removed member ${userId} (${rows[0].email}) from group ${groupId}`);
    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/admin/members/:userId/hard ───────────────────────────────────
async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    const groupId = req.user.group_id;

    if (parseInt(userId, 10) === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot delete yourself' });
    }

    const check = await pool.query(
      'SELECT email FROM users WHERE user_id = $1 AND group_id = $2',
      [userId, groupId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'User not found in your group' });

    await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Deleted user ${userId} (${check.rows[0].email}) from group ${groupId}`);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/admin/invite-codes ─────────────────────────────────────────────
async function createInviteCode(req, res, next) {
  try {
    const groupId = req.user.group_id;

    const plainCode = crypto.randomBytes(16).toString('hex'); // 32-char hex
    const codeHash  = sha256(plainCode);
    const expiresAt = new Date(Date.now() + INVITE_CODE_EXPIRY_HOURS * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO invite_codes (group_id, created_by, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [groupId, req.user.user_id, codeHash, expiresAt]
    );

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Generated invite code for group ${groupId}`);

    // Plain code is returned once and never stored
    res.status(201).json({
      code: plainCode,
      expiresAt,
      message: 'Share this code with your team member. It cannot be shown again.',
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/admin/invite-codes ──────────────────────────────────────────────
async function getInviteCodes(req, res, next) {
  try {
    const groupId = req.user.group_id;

    const { rows } = await pool.query(
      `SELECT
         ic.code_id, ic.is_used, ic.expires_at, ic.created_at,
         cb.fname AS created_by_fname, cb.lname AS created_by_lname,
         ub.email AS used_by_email,
         CASE
           WHEN ic.is_used = true              THEN 'used'
           WHEN ic.expires_at <= NOW()         THEN 'expired'
           ELSE                                     'active'
         END AS status
       FROM invite_codes ic
       JOIN users cb ON ic.created_by = cb.user_id
       LEFT JOIN users ub ON ic.used_by = ub.user_id
       WHERE ic.group_id = $1
       ORDER BY ic.created_at DESC`,
      [groupId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/admin/tasks/:taskId/files/:fileId/download ──────────────────────
async function downloadFile(req, res, next) {
  try {
    const { taskId, fileId } = req.params;
    const groupId = req.user.group_id;

    // Verify task belongs to this admin's group
    const taskCheck = await pool.query(
      'SELECT task_id FROM tasks WHERE task_id = $1 AND group_id = $2',
      [taskId, groupId]
    );
    if (!taskCheck.rows.length) return res.status(404).json({ error: 'Task not found' });

    // Fetch file record — include user_id so we can reconstruct the path
    const { rows } = await pool.query(
      'SELECT file_id, user_id, stored_name, original_name, mime_type FROM files WHERE file_id = $1 AND task_id = $2',
      [fileId, taskId]
    );
    if (!rows.length) return res.status(404).json({ error: 'File not found' });

    const file     = rows[0];
    const filePath = path.join(UPLOADS_ROOT, String(groupId), String(file.user_id), String(taskId), file.stored_name);

    res.setHeader('Content-Type', file.mime_type);
    res.download(filePath, file.original_name, err => {
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTasks, getTask, createTask, updateTask, deleteTask,
  downloadFile,
  getGantt,
  getStatistics,
  getMembers, removeMember, deleteUser,
  createInviteCode, getInviteCodes,
};
