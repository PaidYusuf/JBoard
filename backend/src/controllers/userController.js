const fs           = require('fs');
const path         = require('path');
const { v4: uuidv4 } = require('uuid');
const sanitizeHtml = require('sanitize-html');
const pool         = require('../db/pool');
const { logEvent, LOG_TYPES } = require('../services/logger');

const UPLOADS_ROOT = path.join('/app', 'uploads');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// MIME type → file extension mapping for stored files
const MIME_TO_EXT = {
  'application/pdf':       'pdf',
  'text/csv':              'csv',
  'text/plain':            'txt',
  'image/jpeg':            'jpg',
  'image/png':             'png',
  'image/gif':             'gif',
  'application/msword':    'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// Verify task belongs to the requesting user; returns the task row or null
async function ownedTask(taskId, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM tasks WHERE task_id = $1 AND user_id = $2',
    [taskId, userId]
  );
  return rows[0] ?? null;
}

// ── GET /api/user/tasks ──────────────────────────────────────────────────────
async function getTasks(req, res, next) {
  try {
    const { status } = req.query;

    const { rows } = await pool.query(
      `SELECT t.*, cb.fname AS creator_fname, cb.lname AS creator_lname,
              p.project_name
         FROM tasks t
         JOIN users cb ON t.created_by = cb.user_id
         LEFT JOIN projects p ON t.project_id = p.project_id
        WHERE t.user_id = $1
          AND ($2::text IS NULL OR t.status = $2)
        ORDER BY t.end_date ASC`,
      [req.user.user_id, status ?? null]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/user/tasks/:taskId ──────────────────────────────────────────────
async function getTask(req, res, next) {
  try {
    const task = await ownedTask(req.params.taskId, req.user.user_id);
    if (!task) return res.status(403).json({ error: 'Task not found or not assigned to you' });

    const { rows: files } = await pool.query(
      'SELECT file_id, original_name, mime_type, file_size, uploaded_at FROM files WHERE task_id = $1',
      [task.task_id]
    );

    res.json({ ...task, files });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/user/tasks/:taskId/status ─────────────────────────────────────
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const validStatuses = ['not_started', 'in_progress', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    // IDOR: verify the task belongs to this user before updating
    const task = await ownedTask(req.params.taskId, req.user.user_id);
    if (!task) return res.status(403).json({ error: 'Task not found or not assigned to you' });

    const { rows } = await pool.query(
      'UPDATE tasks SET status = $1 WHERE task_id = $2 RETURNING *',
      [status, task.task_id]
    );

    logEvent(req.user.user_id, LOG_TYPES.TASK, `Updated task ${task.task_id} status to "${status}"`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/user/tasks/:taskId/report ──────────────────────────────────────
async function saveReport(req, res, next) {
  try {
    const { reportText } = req.body;
    if (!reportText) return res.status(400).json({ error: 'reportText is required' });

    const task = await ownedTask(req.params.taskId, req.user.user_id);
    if (!task) return res.status(403).json({ error: 'Task not found or not assigned to you' });

    // XSS protection: strip all HTML before persisting
    const clean = sanitizeHtml(reportText, { allowedTags: [], allowedAttributes: {} });

    const { rows } = await pool.query(
      'UPDATE tasks SET task_report = $1 WHERE task_id = $2 RETURNING task_id, task_report',
      [clean, task.task_id]
    );

    logEvent(req.user.user_id, LOG_TYPES.TASK, `Saved report for task ${task.task_id}`);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/user/tasks/:taskId/upload ──────────────────────────────────────
async function uploadFile(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const task = await ownedTask(req.params.taskId, req.user.user_id);
    if (!task) return res.status(403).json({ error: 'Task not found or not assigned to you' });

    // Magic bytes check — never trust the client-supplied Content-Type
    const { fromBuffer } = require('file-type');
    const detected = await fromBuffer(req.file.buffer);

    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      return res.status(400).json({
        error: 'File type not allowed. Permitted: PDF, CSV, TXT, images, Word, Excel',
      });
    }

    // Build the isolated directory: /app/uploads/groupId/userId/taskId/
    const dir = path.join(
      UPLOADS_ROOT,
      String(req.user.group_id),
      String(req.user.user_id),
      String(task.task_id)
    );
    fs.mkdirSync(dir, { recursive: true });

    // UUID filename — never use the original name on disk
    const ext        = MIME_TO_EXT[detected.mime] || detected.ext;
    const storedName = `${uuidv4()}.${ext}`;
    const filePath   = path.join(dir, storedName);

    fs.writeFileSync(filePath, req.file.buffer);

    const { rows } = await pool.query(
      `INSERT INTO files (task_id, user_id, stored_name, original_name, mime_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [task.task_id, req.user.user_id, storedName, req.file.originalname, detected.mime, req.file.size]
    );

    logEvent(req.user.user_id, LOG_TYPES.TASK, `Uploaded file "${req.file.originalname}" to task ${task.task_id}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/user/tasks/:taskId/files ────────────────────────────────────────
async function getFiles(req, res, next) {
  try {
    const task = await ownedTask(req.params.taskId, req.user.user_id);
    if (!task) return res.status(403).json({ error: 'Task not found or not assigned to you' });

    const { rows } = await pool.query(
      'SELECT file_id, original_name, mime_type, file_size, uploaded_at FROM files WHERE task_id = $1 ORDER BY uploaded_at DESC',
      [task.task_id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/user/tasks/:taskId/files/:fileId ──────────────────────────────
async function deleteFile(req, res, next) {
  try {
    const { taskId, fileId } = req.params;

    const task = await ownedTask(taskId, req.user.user_id);
    if (!task) return res.status(403).json({ error: 'Task not found or not assigned to you' });

    // Only the uploader can delete their own file
    const { rows } = await pool.query(
      'DELETE FROM files WHERE file_id = $1 AND task_id = $2 AND user_id = $3 RETURNING stored_name',
      [fileId, taskId, req.user.user_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'File not found or not uploaded by you' });

    // Remove from disk
    const filePath = path.join(
      UPLOADS_ROOT,
      String(req.user.group_id),
      String(req.user.user_id),
      String(taskId),
      rows[0].stored_name
    );
    try { fs.unlinkSync(filePath); } catch (_) { /* file may already be gone */ }

    logEvent(req.user.user_id, LOG_TYPES.TASK, `Deleted file ${fileId} from task ${taskId}`);
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/user/gantt ──────────────────────────────────────────────────────
async function getGantt(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT task_id, task_name, status, start_date, end_date
       FROM tasks
       WHERE user_id = $1
       ORDER BY start_date ASC`,
      [req.user.user_id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTasks, getTask,
  updateStatus,
  saveReport,
  uploadFile, getFiles, deleteFile,
  getGantt,
};
