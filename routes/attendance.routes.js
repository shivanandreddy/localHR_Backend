import express from 'express';
import { autoPunchIn, getMyAttendance, autoPunchOut, getAdminAttendanceRequests, submitAttendanceRequest, reviewAttendanceRequest } from '../controllers/attendance.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/auto-punch-in', autoPunchIn);
router.post('/auto-punch-out', autoPunchOut);

// ✅ 1. Put static or specific routes FIRST
router.get('/requests', protect, getAdminAttendanceRequests);

// ✅ 2. Put dynamic parameter routes AFTER
router.get('/:id', protect, getMyAttendance);

router.post('/request', protect, submitAttendanceRequest);
router.put('/request/:attendanceId', protect, reviewAttendanceRequest);

export default router;