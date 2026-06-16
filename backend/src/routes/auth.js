const express      = require('express');
const router       = express.Router();
const { authLimiter } = require('../middleware/rateLimiters');
const authenticate = require('../middleware/authenticate');
const {
  login,
  logout,
  register,
  validateInviteCode,
  forgotPassword,
  resetPassword,
  getMe,
} = require('../controllers/authController');

router.get ('/me',                   authenticate, getMe);
router.post('/login',                authLimiter, login);
router.post('/logout',               logout);
router.post('/register',             register);
router.post('/validate-invite-code', validateInviteCode);
router.post('/forgot-password',      authLimiter, forgotPassword);
router.post('/reset-password',       resetPassword);

module.exports = router;
