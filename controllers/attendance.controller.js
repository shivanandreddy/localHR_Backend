import Attendance from '../models/attendance.model.js';
import Employee from '../models/employee.model.js';
import { calculateDistanceMeters } from '../utils/haversine.js';
import { calculateFaceDistance } from '../utils/faceMatcher.js';

export const clockIn = async (req, res) => {
  try {
    const { employeeId, liveFaceDescriptor, userLat, userLng } = req.body;

    // Validate required fields including face descriptor and GPS coordinates
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null' || !liveFaceDescriptor) {
      return res.status(400).json({ 
        message: 'Invalid session or missing required fields: employeeId or liveFaceDescriptor.' 
      });
    }

    if (userLat === undefined || userLng === undefined || userLat === null || userLng === null) {
      return res.status(400).json({ 
        message: 'GPS location is required. Please enable location services to clock in.' 
      });
    }

    // Ensure latitude and longitude are numbers
    const numLat = Number(userLat);
    const numLng = Number(userLng);

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    if (!employee.isActive) {
      return res.status(403).json({ message: 'Employee account is inactive.' });
    }

    // 1. SECURITY LAYER 1: Facial Recognition Verification
    if (!employee.faceDescriptor || employee.faceDescriptor.length === 0) {
      return res.status(400).json({ message: 'Facial profile not registered for this employee. Please register your face first.' });
    }

    const faceDistance = calculateFaceDistance(employee.faceDescriptor, liveFaceDescriptor);
    const FACE_MATCH_THRESHOLD = 0.6; // Standard threshold for face-api / embeddings

    if (faceDistance > FACE_MATCH_THRESHOLD) {
      return res.status(403).json({ 
        success: false,
        message: `Face Recognition Failed: Biometric mismatch detected (Score: ${faceDistance.toFixed(2)}).` 
      });
    }

    // 2. SECURITY LAYER 2: Employee-Specific GPS Geofence Verification
    const empLat = employee.latitude;
    const empLng = employee.longitude;
    const allowedRadius = employee.allowedRadiusMeters || 75;

    if (empLat !== null && empLng !== null && empLat !== undefined && empLng !== undefined) {
      const distance = calculateDistanceMeters(numLat, numLng, empLat, empLng);
      if (distance > allowedRadius) {
        return res.status(400).json({ 
          success: false,
          message: `GPS Geofence Violation: You are approximately ${Math.round(distance)}m away from your designated work location (Allowed radius: ${allowedRadius}m).` 
        });
      }
    }

    // 3. Check if already clocked in today
    const todayStr = new Date().toISOString().split('T')[0];
    let attendance = await Attendance.findOne({ employeeId: employee._id, date: todayStr });
    
    if (attendance && attendance.clockIn) {
      return res.status(400).json({ message: 'Already clocked in for today.' });
    }

    // 4. Evaluate Late Coming against Shift Start
    const now = new Date();
    const [shiftHour, shiftMinute] = employee.shiftStart.split(':').map(Number);
    
    const expectedIn = new Date(now);
    expectedIn.setHours(shiftHour, shiftMinute, 0, 0);

    let isLate = false;
    let lateMinutes = 0;
    const gracePeriodMins = 15;

    if (now > expectedIn) {
      const diffMs = now - expectedIn;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins > gracePeriodMins) {
        isLate = true;
        lateMinutes = diffMins;
      }
    }

    // 5. Create or Update Attendance Record with userLat and userLng
    const deviceIdUsed = req.body.clientDeviceId || 'gps-verified-device';

    if (attendance) {
      attendance.clockIn = now;
      attendance.isLate = isLate;
      attendance.lateMinutes = lateMinutes;
      attendance.deviceIdUsed = deviceIdUsed;
      attendance.userLat = numLat;
      attendance.userLng = numLng;
      await attendance.save();
    } else {
      attendance = await Attendance.create({
        employeeId: employee._id,
        date: todayStr,
        clockIn: now,
        isLate,
        lateMinutes,
        deviceIdUsed,
        userLat: numLat,
        userLng: numLng,
        status: 'Present'
      });
    }

    res.status(200).json({ 
      success: true, 
      message: isLate 
        ? `GPS & Face Verified! Clocked in successfully. Note: You are late by ${lateMinutes} minutes.` 
        : 'GPS & Face Verified! Clocked in successfully.', 
      attendance 
    });

  } catch (err) {
    console.error("Attendance Error Stack:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server Error: " + err.message, 
      stack: err.stack 
    });
  }
};

export const clockOut = async (req, res) => {
  try {
    const { employeeId, liveFaceDescriptor, userLat, userLng } = req.body;

    // Validate required fields
    if (!employeeId || employeeId === 'undefined' || employeeId === 'null' || !liveFaceDescriptor) {
      return res.status(400).json({ 
        message: 'Invalid session or missing required fields: employeeId or liveFaceDescriptor.' 
      });
    }

    if (userLat === undefined || userLng === undefined || userLat === null || userLng === null) {
      return res.status(400).json({ 
        message: 'GPS location is required for clock-out verification.' 
      });
    }

    const numLat = Number(userLat);
    const numLng = Number(userLng);

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    // 1. SECURITY LAYER 1: Facial Recognition Verification
    if (!employee.faceDescriptor || employee.faceDescriptor.length === 0) {
      return res.status(400).json({ message: 'Facial profile not registered for this employee.' });
    }

    const faceDistance = calculateFaceDistance(employee.faceDescriptor, liveFaceDescriptor);
    const FACE_MATCH_THRESHOLD = 0.6;

    if (faceDistance > FACE_MATCH_THRESHOLD) {
      return res.status(403).json({ 
        success: false,
        message: `Face Recognition Failed on Clock-Out: Biometric mismatch detected (Score: ${faceDistance.toFixed(2)}).` 
      });
    }

    // 2. SECURITY LAYER 2: Employee-Specific GPS Geofence Verification
    const empLat = employee.latitude;
    const empLng = employee.longitude;
    const allowedRadius = employee.allowedRadiusMeters || 75;

    if (empLat !== null && empLng !== null && empLat !== undefined && empLng !== undefined) {
      const distance = calculateDistanceMeters(numLat, numLng, empLat, empLng);
      if (distance > allowedRadius) {
        return res.status(400).json({ 
          success: false,
          message: `GPS Geofence Violation on Clock-Out: You are outside the allowed work radius (${Math.round(distance)}m away).` 
        });
      }
    }

    // Find today's attendance record
    const todayStr = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({ employeeId, date: todayStr });

    if (!attendance || !attendance.clockIn) {
      return res.status(400).json({ message: 'No active clock-in found for today.' });
    }

    if (attendance.clockOut) {
      return res.status(400).json({ message: 'Already clocked out for today.' });
    }

    const now = new Date();

    const [shiftEndHour, shiftEndMinute] = employee.shiftEnd.split(':').map(Number);
    const expectedOut = new Date(now);
    expectedOut.setHours(shiftEndHour, shiftEndMinute, 0, 0);

    let isEarlyGoing = false;
    let earlyMinutes = 0;

    if (now < expectedOut) {
      const diffMs = expectedOut - now;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      isEarlyGoing = true;
      earlyMinutes = diffMins;
    }

    attendance.clockOut = now;
    attendance.isEarlyGoing = isEarlyGoing;
    attendance.earlyMinutes = earlyMinutes;
    attendance.userLat = numLat;
    attendance.userLng = numLng;
    await attendance.save();

    res.status(200).json({
      success: true,
      message: isEarlyGoing 
        ? `GPS & Face Verified! Clocked out successfully. Note: You left early by ${earlyMinutes} minutes.` 
        : 'GPS & Face Verified! Clocked out successfully.',
      attendance
    });

  } catch (err) {
    console.error("Attendance Error Stack:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server Error: " + err.message, 
      stack: err.stack 
    });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const { month, year } = req.query;
    const employeeId = req.user?._id || req.query.employeeId;

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const records = await Attendance.find({
      employeeId,
      date: { $regex: `^${monthStr}` }
    }).sort({ date: -1 });

    res.status(200).json({ success: true, records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add or update an automatic facial recognition lookup endpoint in your attendance controller
export const autoPunchIn = async (req, res) => {
  try {
    const { liveFaceDescriptor, userLat, userLng } = req.body;

    if (!liveFaceDescriptor || !Array.isArray(liveFaceDescriptor)) {
      return res.status(400).json({ message: 'Live face descriptor is required.' });
    }

    if (userLat === undefined || userLng === undefined) {
      return res.status(400).json({ message: 'GPS location is required for geofencing.' });
    }

    const numLat = Number(userLat);
    const numLng = Number(userLng);

    // Fetch all active employees who have registered face descriptors
    const employees = await Employee.find({ isActive: true, faceDescriptor: { $exists: true, $not: { $size: 0 } } });

    let matchedEmployee = null;
    let lowestDistance = 1.0;
    const FACE_MATCH_THRESHOLD = 0.6;

    // Find the best matching employee face
    for (const emp of employees) {
      const distance = calculateFaceDistance(emp.faceDescriptor, liveFaceDescriptor);
      if (distance < lowestDistance) {
        lowestDistance = distance;
        matchedEmployee = emp;
      }
    }

    if (!matchedEmployee || lowestDistance > FACE_MATCH_THRESHOLD) {
      return res.status(403).json({ 
        success: false, 
        message: `Face Recognition Failed: No matching employee found (Best match score: ${lowestDistance.toFixed(2)}).` 
      });
    }

    // Geofence Validation for the matched employee
    const empLat = matchedEmployee.latitude;
    const empLng = matchedEmployee.longitude;
    const allowedRadius = matchedEmployee.allowedRadiusMeters || 75;

    if (empLat !== null && empLng !== null && empLat !== undefined && empLng !== undefined) {
      const distance = calculateDistanceMeters(numLat, numLng, empLat, empLng);
      if (distance > allowedRadius) {
        return res.status(400).json({ 
          success: false,
          message: `GPS Geofence Violation for ${matchedEmployee.name}: You are ${Math.round(distance)}m away from your designated work location.` 
        });
      }
    }

    // Check if already clocked in today
    const todayStr = new Date().toISOString().split('T')[0];
    let attendance = await Attendance.findOne({ employeeId: matchedEmployee._id, date: todayStr });
    
    if (attendance && attendance.clockIn) {
      return res.status(400).json({ message: `${matchedEmployee.name} is already clocked in for today.` });
    }

    // Evaluate Late Coming against Shift Start
    const now = new Date();
    const [shiftHour, shiftMinute] = matchedEmployee.shiftStart.split(':').map(Number);
    const expectedIn = new Date(now);
    expectedIn.setHours(shiftHour, shiftMinute, 0, 0);

    let isLate = false;
    let lateMinutes = 0;
    const gracePeriodMins = 15;

    if (now > expectedIn) {
      const diffMins = Math.floor((now - expectedIn) / (1000 * 60));
      if (diffMins > gracePeriodMins) {
        isLate = true;
        lateMinutes = diffMins;
      }
    }

    // Create Attendance Record
    attendance = await Attendance.create({
      employeeId: matchedEmployee._id,
      date: todayStr,
      clockIn: now,
      isLate,
      lateMinutes,
      deviceIdUsed: req.body.clientDeviceId || 'auto-kiosk-device',
      userLat: numLat,
      userLng: numLng,
      status: 'Present'
    });

    res.status(200).json({ 
      success: true, 
      message: isLate 
        ? `Welcome ${matchedEmployee.name}! Clocked in successfully (Late by ${lateMinutes}m).` 
        : `Welcome ${matchedEmployee.name}! Clocked in successfully.`, 
      employee: matchedEmployee.name,
      attendance 
    });

  } catch (err) {
    console.error("Auto Punch-In Error:", err);
    res.status(500).json({ success: false, message: "Server Error: " + err.message });
  }
};