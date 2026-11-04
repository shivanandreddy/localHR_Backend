import Employee from '../models/employee.model.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Create a new employee with Geofence Location & Face ID
export const createEmployee = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      shiftStart, 
      shiftEnd, 
      basicSalary, 
      faceDescriptor, 
      boundDeviceId,
      latitude,
      longitude,
      allowedRadiusMeters 
    } = req.body;

    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee with this email already exists.' });
    }

    // Hash the password securely before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save employee along with location geofence coordinates
    const employee = new Employee({
      name,
      email,
      password: hashedPassword,
      role,
      shiftStart,
      shiftEnd,
      basicSalary,
      faceDescriptor: faceDescriptor || [],
      boundDeviceId: boundDeviceId || null,
      latitude: latitude !== undefined ? latitude : null,
      longitude: longitude !== undefined ? longitude : null,
      allowedRadiusMeters: allowedRadiusMeters !== undefined ? allowedRadiusMeters : 75
    });

    await employee.save();

    // Exclude password from the returned response object for security
    const employeeObj = employee.toObject();
    delete employeeObj.password;

    res.status(201).json({ 
      success: true, 
      message: 'Employee created successfully with Face ID, Device Binding, and GPS Location', 
      employee: employeeObj 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all employees
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({});
    res.status(200).json({ 
      success: true, 
      count: employees.length, 
      employees 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single employee by ID
export const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.status(200).json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reset bound device ID (Useful if an employee changes their phone)
export const resetBoundDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.boundDeviceId = null;
    await employee.save();

    res.status(200).json({ 
      success: true, 
      message: 'Device binding reset successfully. Employee can now bind a new device.' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Register or update an employee's facial biometric template
export const registerEmployeeFace = async (req, res) => {
  try {
    const { id } = req.params;
    const { faceDescriptor } = req.body; // Expects an array of numbers

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return res.status(400).json({ message: 'Valid faceDescriptor array is required.' });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    employee.faceDescriptor = faceDescriptor;
    await employee.save();

    res.status(200).json({ 
      success: true, 
      message: 'Facial biometric profile registered successfully!' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Employee Login
export const loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if employee exists
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check if account is active
    if (!employee.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact Admin.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: employee._id }, 
      process.env.JWT_SECRET || 'your_jwt_secret_key', 
      { expiresIn: '30d' }
    );

    // Remove password before sending the response
    const employeeObj = employee.toObject();
    delete employeeObj.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      employee: employeeObj
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};