import express from 'express';
import { calculateMonthlyPayroll } from '../controllers/payroll.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/payroll/calculate - Restricted to Admin and Manager roles
router.post('/calculate', protect, authorize('Admin', 'Manager','Employee'), calculateMonthlyPayroll);

export default router;