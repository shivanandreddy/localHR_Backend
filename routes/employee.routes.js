import express from 'express';
import { 
  createEmployee, 
  getAllEmployees, 
  getEmployeeById, 
  registerEmployeeFace,
  resetBoundDevice,
  loginEmployee,
  getProfile,
  updateProfile
} from '../controllers/employee.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// --- Public Route ---
router.post('/login', loginEmployee);

// --- Protected Admin / Manager Routes --- , protect, authorize('Admin', 'Manager')
router.post('/', createEmployee);
router.get('/', protect, getAllEmployees);
router.patch('/:id/reset-device', protect, authorize('Admin', 'Manager'), resetBoundDevice);

// --- General Protected Employee Routes ---
router.get('/:id', protect, getEmployeeById);
router.patch('/:id/register-face', protect, registerEmployeeFace);

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

export default router;