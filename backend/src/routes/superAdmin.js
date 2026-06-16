const express      = require('express');
const router       = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole  = require('../middleware/requireRole');
const c            = require('../controllers/superAdminController');

// All superadmin routes require a valid session AND the superadmin role
router.use(authenticate, requireRole('superadmin'));

router.get   ('/dashboard',              c.getDashboard);

router.get   ('/groups',                 c.getGroups);
router.post  ('/groups',                 c.createGroup);
router.patch ('/groups/:groupId',        c.updateGroup);
router.patch ('/groups/:groupId/suspend',c.setGroupStatus);

router.get   ('/plans',                  c.getPlans);
router.post  ('/plans',                  c.createPlan);
router.patch ('/plans/:planId',          c.updatePlan);
router.delete('/plans/:planId',          c.deletePlan);

router.get   ('/logs',                   c.getLogs);

module.exports = router;
