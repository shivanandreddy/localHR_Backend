import Attendance from '../models/attendance.model.js';
import Employee from '../models/employee.model.js';
import { calculateDistanceMeters } from '../utils/haversine.js';
import { calculateFaceDistance } from '../utils/faceMatcher.js';



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
        ? `Welcome ${matchedEmployee.name}! Punched in successfully (Late by ${lateMinutes}m).` 
        : `Welcome ${matchedEmployee.name}! Punched in successfully.`, 
      employee: matchedEmployee.name,
      attendance 
    });

  } catch (err) {
    console.error("Auto Punch-In Error:", err);
    res.status(500).json({ success: false, message: "Server Error: " + err.message });
  }
};

export const autoPunchOut = async (req, res) => {
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

    // Fetch active employees with registered biometrics
    const employees = await Employee.find({ isActive: true, faceDescriptor: { $exists: true, $not: { $size: 0 } } });

    let matchedEmployee = null;
    let lowestDistance = 1.0;
    const FACE_MATCH_THRESHOLD = 0.6;

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

    // Geofence Check
    const empLat = matchedEmployee.latitude;
    const empLng = matchedEmployee.longitude;
    const allowedRadius = matchedEmployee.allowedRadiusMeters || 75;

    if (empLat !== null && empLng !== null && empLat !== undefined && empLng !== undefined) {
      const distance = calculateDistanceMeters(numLat, numLng, empLat, empLng);
      if (distance > allowedRadius) {
        return res.status(400).json({ 
          success: false,
          message: `GPS Geofence Violation for ${matchedEmployee.name}: You are ${Math.round(distance)}m outside work boundary.` 
        });
      }
    }

    // Find today's clock-in record
    const todayStr = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({ employeeId: matchedEmployee._id, date: todayStr });

    if (!attendance || !attendance.clockIn) {
      return res.status(400).json({ message: `No active clock-in found for ${matchedEmployee.name} today.` });
    }

    if (attendance.clockOut) {
      return res.status(400).json({ message: `${matchedEmployee.name} has already clocked out for today.` });
    }

    const now = new Date();
    const [shiftEndHour, shiftEndMinute] = matchedEmployee.shiftEnd.split(':').map(Number);
    const expectedOut = new Date(now);
    expectedOut.setHours(shiftEndHour, shiftEndMinute, 0, 0);

    let isEarlyGoing = false;
    let earlyMinutes = 0;

    if (now < expectedOut) {
      isEarlyGoing = true;
      earlyMinutes = Math.floor((expectedOut - now) / (1000 * 60));
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
        ? `Goodbye ${matchedEmployee.name}! Punched out successfully. Note: Early exit by ${earlyMinutes}m.` 
        : `Goodbye ${matchedEmployee.name}! Punched out successfully.`,
      employee: matchedEmployee.name,
      attendance
    });

  } catch (err) {
    console.error("Auto Punch-Out Error:", err);
    res.status(500).json({ success: false, message: "Server Error: " + err.message });
  }
};

export const submitAttendanceRequest = async (req, res) => {
  try {
    const employeeId = req.user?.id || req.user?._id; // Extracted from your auth middleware
    const { date, requestType, reason } = req.body;

    if (!date || !requestType || !reason) {
      return res.status(400).json({ message: 'Date, request type, and reason are required.' });
    }

    // Find or create the attendance document for this date
    let attendance = await Attendance.findOne({ employeeId, date });

    if (!attendance) {
      // If no attendance doc exists yet for today (e.g. applying for leave in advance)
      attendance = new Attendance({
        employeeId,
        date,
        status: requestType === 'Leave' ? 'On-Leave' : 'Present',
      });
    }

    // Attach/Update the exception request
    attendance.exceptionRequest = {
      requestType,
      reason,
      status: 'Pending',
      adminComment: '',
    };

    await attendance.save();

    res.status(200).json({ 
      success: true, 
      message: 'Attendance exception request submitted successfully.', 
      attendance 
    });
  } catch (err) {
    console.error('Submit Request Error:', err);
    res.status(500).json({ message: 'Server error while submitting request.' });
  }
};


export const reviewAttendanceRequest = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { status, adminComment } = req.body; // status: 'Approved' or 'Rejected'

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status update. Must be Approved or Rejected.' });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    attendance.exceptionRequest.status = status;
    attendance.exceptionRequest.adminComment = adminComment || '';

    // Optional: If leave/half-day is approved, update main attendance status accordingly
    if (status === 'Approved') {
      if (attendance.exceptionRequest.requestType === 'Leave') {
        attendance.status = 'On-Leave';
      } else if (attendance.exceptionRequest.requestType === 'Half-Day') {
        attendance.status = 'Half-Day';
      }
    }

    await attendance.save();

    res.status(200).json({ 
      success: true, 
      message: `Request successfully ${status.toLowerCase()}.`, 
      attendance 
    });
  } catch (err) {
    console.error('Review Request Error:', err);
    res.status(500).json({ message: 'Server error while reviewing request.' });
  }
};

export const getAdminAttendanceRequests = async (req, res) => {
  try {
    // Find documents where the exceptionRequest requestType exists and is not null
    const requests = await Attendance.find({
      'exceptionRequest.requestType': { $exists: true, $ne: null }
    })
      .populate('employeeId', 'name email employeeId department')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err) {
    console.error('Fetch Admin Requests Error:', err);
    res.status(500).json({ message: 'Server error while fetching requests.' });
  }
};