import express from 'express';
import { clockIn, clockOut,autoPunchIn, getMyAttendance, autoPunchOut } from '../controllers/attendance.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/attendance/clock-in - Protected biometric clock-in
router.post('/clock-in', protect, clockIn);

// POST /api/attendance/clock-out - Protected biometric clock-out
router.post('/clock-out', protect, clockOut);
router.post('/clock-out', protect, clockOut);
router.post('/auto-punch-in', autoPunchIn);
router.post('/auto-punch-out', autoPunchOut);
router.get('/:id',protect, getMyAttendance);


export default router;