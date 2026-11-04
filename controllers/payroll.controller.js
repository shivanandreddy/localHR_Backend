import Attendance from '../models/attendance.model.js';
import Employee from '../models/employee.model.js';

export const calculateMonthlyPayroll = async (req, res) => {
  try {
    const { employeeId, year, month } = req.body; // e.g., year: 2026, month: 11

    if (!year || !month) {
      return res.status(400).json({ message: 'Missing required fields: year, month.' });
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const standardDaysInMonth = 30;
    const FACE_MATCH_THRESHOLD = 0.6; // standard rule reference

    // Determine target employees
    let employees = [];
    if (employeeId && employeeId !== 'all') {
      const emp = await Employee.findById(employeeId);
      if (!emp) return res.status(404).json({ message: 'Employee not found.' });
      employees = [emp];
    } else {
      employees = await Employee.find({ isActive: true });
    }

    const payrollSummaries = [];

    for (const employee of employees) {
      // Fetch attendance records for this employee in the specified month
      const attendanceRecords = await Attendance.find({
        employeeId: employee._id,
        date: { $regex: `^${monthStr}` }
      });

      let totalPresentDays = 0;
      let totalLateDays = 0;

      attendanceRecords.forEach(record => {
        if (record.status === 'Present' || record.status === 'Half-Day') {
          totalPresentDays += 1;
        }
        if (record.isLate) {
          totalLateDays += 1;
        }
      });

      // BUSINESS RULE: 3 Late Days = 1 Day Salary Deduction
      const deductionDays = Math.floor(totalLateDays / 3);
      const perDaySalary = employee.basicSalary / standardDaysInMonth;
      const totalDeductionAmount = deductionDays * perDaySalary;
      const netSalary = Math.max(0, employee.basicSalary - totalDeductionAmount);

      payrollSummaries.push({
        employeeId: employee._id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        basicSalary: employee.basicSalary,
        totalPresentDays,
        totalLateDays,
        deductionDaysApplied: deductionDays,
        totalDeductionAmount: Math.round(totalDeductionAmount * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100
      });
    }

    res.status(200).json({
      success: true,
      month: monthStr,
      count: payrollSummaries.length,
      payrollSummaries
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};