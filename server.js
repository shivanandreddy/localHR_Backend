import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import https from 'https'; // Added for self-pinging hack
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

  // --- Render Keep-Alive Hack (Pings every 14 minutes) ---
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL; // Render automatically provides this environment variable
  
  if (RENDER_URL) {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds

    setInterval(() => {
      https.get(RENDER_URL, (res) => {
        console.log(`[Keep-Alive] Self-ping status code: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error(`[Keep-Alive] Ping error: ${err.message}`);
      });
    }, PING_INTERVAL);

    console.log(`[Keep-Alive] Self-ping active for ${RENDER_URL}`);
  } else {
    console.log('[Keep-Alive] RENDER_EXTERNAL_URL not found. Self-ping skipped (local environment).');
  }
});