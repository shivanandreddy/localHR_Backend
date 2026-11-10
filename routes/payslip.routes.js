import express from 'express';
import { generatePayslip } from '../controllers/payslip.controller.js';

const router = express.Router();

router.post('/calculate', generatePayslip);

export default router;