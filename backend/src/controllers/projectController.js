const pool = require('../db/pool');
const sanitizeHtml = require('sanitize-html');

// ── GET /api/admin/projects ───────────────────────────────────────────────────
async function getProjects(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              COUNT(DISTINCT pm.user_id)::int AS member_count
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.project_id
        WHERE p.group_id = $1
        GROUP BY p.project_id
        ORDER BY p.created_at DESC`,
      [req.user.group_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── POST /api/admin/projects ──────────────────────────────────────────────────
async function createProject(req, res, next) {
  try {
    const { projectName, startDate, endDate } = req.body;
    const groupId = req.user.group_id;

    if (!projectName || !startDate || !endDate) {
      return res.status(400).json({ error: 'projectName, startDate, and endDate are required' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: 'endDate must be on or after startDate' });
    }

    // Check plan project limit
    const limitCheck = await pool.query(
      `SELECT pl.max_projects,
              COUNT(p.project_id)::int AS current_count
         FROM groups g
         JOIN plans pl ON pl.plan_id = g.plan_id
         LEFT JOIN projects p ON p.group_id = g.group_id
        WHERE g.group_id = $1
        GROUP BY pl.max_projects`,
      [groupId]
    );
    const { max_projects, current_count } = limitCheck.rows[0] ?? { max_projects: 5, current_count: 0 };
    if (current_count >= max_projects) {
      return res.status(403).json({ error: `Project limit reached (${max_projects}). Upgrade your plan to create more.` });
    }

    const { rows } = await pool.query(
      `INSERT INTO projects (group_id, project_name, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [groupId, projectName, startDate, endDate, req.user.user_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ── PATCH /api/admin/projects/:projectId ─────────────────────────────────────
async function updateProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const { projectName, startDate, endDate } = req.body;
    const groupId = req.user.group_id;

    const existing = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1 AND group_id = $2',
      [projectId, groupId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Project not found' });

    const name  = projectName ?? existing.rows[0].project_name;
    const start = startDate   ?? existing.rows[0].start_date;
    const end   = endDate     ?? existing.rows[0].end_date;

    if (end < start) return res.status(400).json({ error: 'endDate must be on or after startDate' });

    const { rows } = await pool.query(
      `UPDATE projects SET project_name = $1, start_date = $2, end_date = $3
        WHERE project_id = $4 RETURNING *`,
      [name, start, end, projectId]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// ── DELETE /api/admin/projects/:projectId ─────────────────────────────────────
async function deleteProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const { rowCount } = await pool.query(
      'DELETE FROM projects WHERE project_id = $1 AND group_id = $2',
      [projectId, req.user.group_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) { next(err); }
}

// ── GET /api/admin/projects/:projectId/members ────────────────────────────────
async function getProjectMembers(req, res, next) {
  try {
    const { projectId } = req.params;
    await assertProjectOwner(projectId, req.user.group_id, res);
    if (res.headersSent) return;

    const { rows } = await pool.query(
      `SELECT u.user_id, u.fname, u.lname, u.email
         FROM project_members pm
         JOIN users u ON u.user_id = pm.user_id
        WHERE pm.project_id = $1
        ORDER BY u.fname`,
      [projectId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── POST /api/admin/projects/:projectId/members ───────────────────────────────
async function addProjectMember(req, res, next) {
  try {
    const { projectId } = req.params;
    const { userId } = req.body;
    const groupId = req.user.group_id;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await assertProjectOwner(projectId, groupId, res);
    if (res.headersSent) return;

    // IDOR: user must be in same group
    const userCheck = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 AND group_id = $2',
      [userId, groupId]
    );
    if (!userCheck.rows.length) return res.status(403).json({ error: 'User not in your group' });

    await pool.query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [projectId, userId]
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) { next(err); }
}

// ── DELETE /api/admin/projects/:projectId/members/:userId ─────────────────────
async function removeProjectMember(req, res, next) {
  try {
    const { projectId, userId } = req.params;
    await assertProjectOwner(projectId, req.user.group_id, res);
    if (res.headersSent) return;

    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
}

// ── GET /api/admin/projects/:projectId/logs ───────────────────────────────────
// ?date=YYYY-MM-DD  OR  ?userId=123
async function getProjectLogs(req, res, next) {
  try {
    const { projectId } = req.params;
    const { date, userId } = req.query;
    await assertProjectOwner(projectId, req.user.group_id, res);
    if (res.headersSent) return;

    const { rows } = await pool.query(
      `SELECT dl.log_id, dl.log_date, dl.content, dl.updated_at,
              u.user_id, u.fname, u.lname
         FROM daily_logs dl
         JOIN users u ON u.user_id = dl.user_id
        WHERE dl.project_id = $1
          AND ($2::date   IS NULL OR dl.log_date = $2)
          AND ($3::int    IS NULL OR dl.user_id  = $3)
        ORDER BY dl.log_date DESC, u.fname`,
      [projectId, date ?? null, userId ?? null]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── helpers ───────────────────────────────────────────────────────────────────
async function assertProjectOwner(projectId, groupId, res) {
  const { rows } = await pool.query(
    'SELECT project_id FROM projects WHERE project_id = $1 AND group_id = $2',
    [projectId, groupId]
  );
  if (!rows.length) res.status(404).json({ error: 'Project not found' });
}

// ── GET /api/user/projects ────────────────────────────────────────────────────
async function getUserProjects(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT p.project_id, p.project_name, p.start_date, p.end_date
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.project_id
        WHERE pm.user_id = $1
        ORDER BY p.start_date DESC`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── GET /api/user/projects/:projectId/logs ────────────────────────────────────
async function getUserProjectLogs(req, res, next) {
  try {
    const { projectId } = req.params;
    await assertMembership(projectId, req.user.user_id, res);
    if (res.headersSent) return;

    const { rows } = await pool.query(
      `SELECT log_id, log_date, content, updated_at
         FROM daily_logs
        WHERE project_id = $1 AND user_id = $2
        ORDER BY log_date DESC`,
      [projectId, req.user.user_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── POST /api/user/projects/:projectId/logs ───────────────────────────────────
// Upserts today's log for this user
async function upsertTodayLog(req, res, next) {
  try {
    const { projectId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const project = await assertMembership(projectId, req.user.user_id, res);
    if (res.headersSent) return;

    // Enforce today only
    // pg returns DATE columns as JS Date objects — convert to YYYY-MM-DD string first
    const today = new Date().toISOString().slice(0, 10);
    const startStr = new Date(project.start_date).toISOString().slice(0, 10);
    const endStr   = new Date(project.end_date).toISOString().slice(0, 10);
    if (today < startStr || today > endStr) {
      return res.status(400).json({ error: 'Today is outside the project date range' });
    }

    const clean = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });

    const { rows } = await pool.query(
      `INSERT INTO daily_logs (project_id, user_id, log_date, content)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id, log_date)
       DO UPDATE SET content = EXCLUDED.content
       RETURNING *`,
      [projectId, req.user.user_id, today, clean]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function assertMembership(projectId, userId, res) {
  const { rows } = await pool.query(
    `SELECT p.project_id, p.start_date, p.end_date
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.project_id
      WHERE p.project_id = $1 AND pm.user_id = $2`,
    [projectId, userId]
  );
  if (!rows.length) {
    res.status(403).json({ error: 'Project not found or you are not a member' });
    return null;
  }
  return rows[0];
}

// ── GET /api/admin/projects/:projectId/tasks ──────────────────────────────────
async function getProjectTasks(req, res, next) {
  try {
    const { projectId } = req.params;
    const { status } = req.query;
    await assertProjectOwner(projectId, req.user.group_id, res);
    if (res.headersSent) return;

    const { rows } = await pool.query(
      `SELECT t.*,
              u.fname, u.lname, u.email,
              cb.fname AS creator_fname, cb.lname AS creator_lname
         FROM tasks t
         JOIN users u  ON t.user_id    = u.user_id
         JOIN users cb ON t.created_by = cb.user_id
        WHERE t.project_id = $1
          AND ($2::text IS NULL OR t.status = $2)
        ORDER BY t.created_at DESC`,
      [projectId, status ?? null]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── POST /api/admin/projects/:projectId/tasks ─────────────────────────────────
async function createProjectTask(req, res, next) {
  try {
    const { projectId } = req.params;
    const { assignedUserId, taskName, taskDetails, startDate, endDate } = req.body;
    const groupId = req.user.group_id;

    if (!assignedUserId || !taskName || !startDate || !endDate) {
      return res.status(400).json({ error: 'assignedUserId, taskName, startDate, and endDate are required' });
    }

    await assertProjectOwner(projectId, groupId, res);
    if (res.headersSent) return;

    // Assigned user must be a member of this project
    const memberCheck = await pool.query(
      'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, assignedUserId]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'Assigned user is not a member of this project' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, group_id, created_by, project_id, task_name, task_details, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [assignedUserId, groupId, req.user.user_id, projectId, taskName, taskDetails ?? null, startDate, endDate]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// ── GET /api/user/projects/:projectId/tasks ───────────────────────────────────
async function getUserProjectTasks(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await assertMembership(projectId, req.user.user_id, res);
    if (res.headersSent || !project) return;

    const { rows } = await pool.query(
      `SELECT task_id, task_name, task_details, status, start_date, end_date, updated_at
         FROM tasks
        WHERE project_id = $1 AND user_id = $2
        ORDER BY end_date ASC`,
      [projectId, req.user.user_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = {
  // admin
  getProjects, createProject, updateProject, deleteProject,
  getProjectMembers, addProjectMember, removeProjectMember,
  getProjectLogs,
  getProjectTasks, createProjectTask,
  // user
  getUserProjects, getUserProjectLogs, upsertTodayLog,
  getUserProjectTasks,
};
