import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import connectDB from './config/db.js';
import attendanceRoutes from './routes/attendance.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import payrollRoutes from './routes/payroll.routes.js';

dotenv.config();

// Initialize Express App
const app = express();

// Middleware
app.use(cors({
  origin: true, // Dynamically reflects origin (or allow your specific local IP)
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
// Connect to MongoDB
connectDB();

// API Routes
app.use('/api/attendance', attendanceRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/payroll', payrollRoutes);

// Health Check Route
app.get('/', (req, res) => {
  res.send('LocalHR Backend API is up and running...');
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});