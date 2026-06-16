const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole  = require('../middleware/requireRole');
const upload       = require('../middleware/upload');
const c            = require('../controllers/userController');
const pc           = require('../controllers/projectController');

router.use(authenticate, requireRole('user', 'admin', 'superadmin'));

router.get   ('/tasks',                          c.getTasks);
router.get   ('/tasks/:taskId',                  c.getTask);
router.patch ('/tasks/:taskId/status',           c.updateStatus);
router.post  ('/tasks/:taskId/report',           c.saveReport);
router.post  ('/tasks/:taskId/upload', upload.single('file'), c.uploadFile);
router.get   ('/tasks/:taskId/files',            c.getFiles);
router.delete('/tasks/:taskId/files/:fileId',    c.deleteFile);
router.get   ('/gantt',                          c.getGantt);

router.get   ('/projects',                              pc.getUserProjects);
router.get   ('/projects/:projectId/logs',              pc.getUserProjectLogs);
router.post  ('/projects/:projectId/logs',              pc.upsertTodayLog);

module.exports = router;
