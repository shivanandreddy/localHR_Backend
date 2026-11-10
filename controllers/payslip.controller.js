import Attendance from '../models/attendance.model.js';
import Employee from '../models/employee.model.js'; // Assuming you have an Employee model for base salary

/**
 * Generate or calculate monthly payslip for an employee based on attendance records.
 */
export const generatePayslip = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;

    if (!employeeId || !month || !year) {
      return res.status(400).json({ message: 'employeeId, month, and year are required.' });
    }

    // 1. Fetch Employee details (to get base salary, etc.)
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    // 2. Construct date string prefixes for matching 'YYYY-MM' format in attendance records
    // Assuming attendance records use date format "YYYY-MM-DD"
    const formattedMonth = String(month).padStart(2, '0');
    const dateRegex = new RegExp(`^${year}-${formattedMonth}-\\d{2}$`);

    // 3. Fetch all attendance logs for this employee in the specified month
    const attendanceRecords = await Attendance.find({
      employeeId,
      date: { $regex: dateRegex }
    });

    // 4. Calculate attendance metrics
    let totalPresentDays = 0;
    let totalLateCount = 0;
    let totalEarlyGoingCount = 0;

    attendanceRecords.forEach((record) => {
      if (record.status === 'Present' || record.clockIn) {
        totalPresentDays += 1;
      }
      if (record.isLate) {
        totalLateCount += 1;
      }
      if (record.isEarlyGoing) {
        totalEarlyGoingCount += 1;
      }
    });

    // 5. Apply HR Policy: Every 3 late infractions = 1 day salary deduction penalty
    const deductionDaysApplied = Math.floor(totalLateCount / 3);

    // 6. Financial Calculations
    const baseMonthlySalary = employee.baseSalary || 30000; // Fallback default if baseSalary is not set
    const perDaySalary = baseMonthlySalary / 30; // Standard 30-day calculation or working days
    const totalDeductionAmount = deductionDaysApplied * perDaySalary;
    
    // Ensure net salary does not drop below 0
    const netSalary = Math.max(0, baseMonthlySalary - totalDeductionAmount);

    const payslipSummary = {
      employeeId: employee._id,
      employeeName: employee.name,
      email: employee.email,
      month,
      year,
      baseSalary: baseMonthlySalary,
      totalPresentDays,
      totalLateCount,
      totalEarlyGoingCount,
      deductionDaysApplied,
      totalDeductionAmount: Math.round(totalDeductionAmount),
      netSalary: Math.round(netSalary),
      attendanceRecordsCount: attendanceRecords.length
    };

    return res.status(200).json({
      success: true,
      message: 'Payslip generated successfully.',
      payrollSummaries: [payslipSummary]
    });

  } catch (error) {
    console.error('Error generating payslip:', error);
    return res.status(500).json({ message: 'Internal server error while generating payslip.' });
  }
};