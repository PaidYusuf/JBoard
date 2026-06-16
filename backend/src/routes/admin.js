const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole  = require('../middleware/requireRole');
const { statsLimiter } = require('../middleware/rateLimiters');
const c            = require('../controllers/adminController');
const pc           = require('../controllers/projectController');

router.use(authenticate, requireRole('admin', 'superadmin'));

router.get   ('/tasks',               c.getTasks);
router.post  ('/tasks',               c.createTask);
router.get   ('/tasks/:taskId',                          c.getTask);
router.patch ('/tasks/:taskId',                          c.updateTask);
router.delete('/tasks/:taskId',                          c.deleteTask);
router.get   ('/tasks/:taskId/files/:fileId/download',   c.downloadFile);

router.get   ('/gantt',               c.getGantt);
router.get   ('/statistics', statsLimiter, c.getStatistics);

router.get   ('/members',             c.getMembers);
router.delete('/members/:userId',     c.removeMember);

router.post  ('/invite-codes',        c.createInviteCode);
router.get   ('/invite-codes',        c.getInviteCodes);

router.get   ('/projects',                                   pc.getProjects);
router.post  ('/projects',                                   pc.createProject);
router.patch ('/projects/:projectId',                        pc.updateProject);
router.delete('/projects/:projectId',                        pc.deleteProject);
router.get   ('/projects/:projectId/members',                pc.getProjectMembers);
router.post  ('/projects/:projectId/members',                pc.addProjectMember);
router.delete('/projects/:projectId/members/:userId',        pc.removeProjectMember);
router.get   ('/projects/:projectId/logs',                   pc.getProjectLogs);

module.exports = router;
