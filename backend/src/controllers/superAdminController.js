const pool = require('../db/pool');
const { logEvent, LOG_TYPES } = require('../services/logger');

// ── GET /api/superadmin/dashboard ────────────────────────────────────────────
async function getDashboard(req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM groups  WHERE type = 'company')                          AS total_groups,
        (SELECT COUNT(*) FROM users   WHERE role != 'superadmin')                      AS total_users,
        (SELECT COUNT(*) FROM users   WHERE is_active = true AND role != 'superadmin') AS active_users,
        (SELECT COUNT(*) FROM tasks)                                                   AS total_tasks,
        (SELECT COUNT(*) FROM tasks   WHERE status = 'in_progress')                   AS active_tasks,
        (SELECT COUNT(*) FROM tasks   WHERE status = 'completed')                     AS completed_tasks
    `);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/superadmin/groups ───────────────────────────────────────────────
async function getGroups(req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT
        g.group_id, g.group_name, g.type, g.status, g.created_at,
        p.plan_id, p.plan_name, p.max_user,
        COUNT(u.user_id)::int AS user_count
      FROM groups g
      LEFT JOIN plans p ON g.plan_id = p.plan_id
      LEFT JOIN users u ON g.group_id = u.group_id
      GROUP BY g.group_id, p.plan_id, p.plan_name, p.max_user
      ORDER BY g.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/superadmin/groups ──────────────────────────────────────────────
async function createGroup(req, res, next) {
  try {
    const { groupName, planId, type = 'company' } = req.body;

    if (!groupName || !planId) {
      return res.status(400).json({ error: 'groupName and planId are required' });
    }
    if (!['company', 'personal'].includes(type)) {
      return res.status(400).json({ error: 'type must be company or personal' });
    }

    const planCheck = await pool.query('SELECT plan_id FROM plans WHERE plan_id = $1', [planId]);
    if (!planCheck.rows.length) {
      return res.status(400).json({ error: 'Plan not found' });
    }

    const { rows } = await pool.query(
      `INSERT INTO groups (group_name, plan_id, type, status)
       VALUES ($1, $2, $3, 'active') RETURNING *`,
      [groupName, planId, type]
    );

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Created group: ${groupName}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/superadmin/groups/:groupId ────────────────────────────────────
async function updateGroup(req, res, next) {
  try {
    const { groupId } = req.params;
    const { groupName, planId } = req.body;

    if (!groupName && !planId) {
      return res.status(400).json({ error: 'Provide at least groupName or planId to update' });
    }

    const existing = await pool.query('SELECT * FROM groups WHERE group_id = $1', [groupId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Group not found' });

    if (planId) {
      const planCheck = await pool.query('SELECT plan_id FROM plans WHERE plan_id = $1', [planId]);
      if (!planCheck.rows.length) return res.status(400).json({ error: 'Plan not found' });
    }

    const { rows } = await pool.query(
      `UPDATE groups
       SET group_name = COALESCE($1, group_name),
           plan_id    = COALESCE($2, plan_id)
       WHERE group_id = $3
       RETURNING *`,
      [groupName ?? null, planId ?? null, groupId]
    );

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Updated group ${groupId}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/superadmin/groups/:groupId/suspend ────────────────────────────
async function setGroupStatus(req, res, next) {
  try {
    const { groupId } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'status must be active or suspended' });
    }

    const { rows } = await pool.query(
      'UPDATE groups SET status = $1 WHERE group_id = $2 RETURNING *',
      [status, groupId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Group not found' });

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Set group ${groupId} status to ${status}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/superadmin/plans ────────────────────────────────────────────────
async function getPlans(req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, COUNT(g.group_id)::int AS group_count
      FROM plans p
      LEFT JOIN groups g ON p.plan_id = g.plan_id
      GROUP BY p.plan_id
      ORDER BY p.price ASC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/superadmin/plans ───────────────────────────────────────────────
async function createPlan(req, res, next) {
  try {
    const { planName, maxUser, maxProjects, price } = req.body;

    if (!planName || !maxUser || !maxProjects || price == null) {
      return res.status(400).json({ error: 'planName, maxUser, maxProjects, and price are required' });
    }
    if (maxUser < 1)    return res.status(400).json({ error: 'maxUser must be at least 1' });
    if (maxProjects < 1) return res.status(400).json({ error: 'maxProjects must be at least 1' });
    if (price < 0)      return res.status(400).json({ error: 'price cannot be negative' });

    const { rows } = await pool.query(
      'INSERT INTO plans (plan_name, max_user, max_projects, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [planName, maxUser, maxProjects, price]
    );

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Created plan: ${planName}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/superadmin/plans/:planId ─────────────────────────────────────
async function updatePlan(req, res, next) {
  try {
    const { planId } = req.params;
    const { planName, maxUser, maxProjects, price } = req.body;

    if (!planName && maxUser == null && maxProjects == null && price == null) {
      return res.status(400).json({ error: 'Provide at least one field to update' });
    }

    const existing = await pool.query('SELECT * FROM plans WHERE plan_id = $1', [planId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Plan not found' });

    const { rows } = await pool.query(
      `UPDATE plans
       SET plan_name    = COALESCE($1, plan_name),
           max_user     = COALESCE($2, max_user),
           max_projects = COALESCE($3, max_projects),
           price        = COALESCE($4, price)
       WHERE plan_id = $5
       RETURNING *`,
      [planName ?? null, maxUser ?? null, maxProjects ?? null, price ?? null, planId]
    );

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Updated plan ${planId}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/superadmin/plans/:planId ─────────────────────────────────────
async function deletePlan(req, res, next) {
  try {
    const { planId } = req.params;

    const existing = await pool.query('SELECT * FROM plans WHERE plan_id = $1', [planId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Plan not found' });

    const usage = await pool.query(
      'SELECT COUNT(*) FROM groups WHERE plan_id = $1',
      [planId]
    );
    if (parseInt(usage.rows[0].count, 10) > 0) {
      return res.status(400).json({ error: 'Cannot delete a plan that is assigned to active groups' });
    }

    await pool.query('DELETE FROM plans WHERE plan_id = $1', [planId]);

    logEvent(req.user.user_id, LOG_TYPES.GROUP, `Deleted plan ${planId}: ${existing.rows[0].plan_name}`);
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/superadmin/logs ─────────────────────────────────────────────────
async function getLogs(req, res, next) {
  try {
    const {
      logType,
      startDate,
      endDate,
      page  = 1,
      limit = 50,
    } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const cap    = Math.min(parseInt(limit, 10), 100); // hard cap at 100 per page

    const { rows } = await pool.query(
      `SELECT
         l.log_id, l.log_type, l.action, l.timestamp,
         u.user_id, u.email, u.fname, u.lname
       FROM logs l
       LEFT JOIN users u ON l.user_id = u.user_id
       WHERE ($1::text        IS NULL OR l.log_type  = $1)
         AND ($2::timestamptz IS NULL OR l.timestamp >= $2)
         AND ($3::timestamptz IS NULL OR l.timestamp <= $3)
       ORDER BY l.timestamp DESC
       LIMIT $4 OFFSET $5`,
      [logType ?? null, startDate ?? null, endDate ?? null, cap, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM logs
       WHERE ($1::text        IS NULL OR log_type  = $1)
         AND ($2::timestamptz IS NULL OR timestamp >= $2)
         AND ($3::timestamptz IS NULL OR timestamp <= $3)`,
      [logType ?? null, startDate ?? null, endDate ?? null]
    );

    res.json({
      logs:  rows,
      total: parseInt(countRows[0].count, 10),
      page:  parseInt(page, 10),
      limit: cap,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard,
  getGroups, createGroup, updateGroup, setGroupStatus,
  getPlans,  createPlan,  updatePlan,  deletePlan,
  getLogs,
};
