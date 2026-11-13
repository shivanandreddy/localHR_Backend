import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  date: { 
    type: String, 
    required: true // Format: "YYYY-MM-DD"
  },
  clockIn: { 
    type: Date 
  },
  clockOut: { 
    type: Date 
  },
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Half-Day', 'On-Leave'], 
    default: 'Present' 
  },
  isLate: { 
    type: Boolean, 
    default: false 
  },
  lateMinutes: { 
    type: Number, 
    default: 0 
  },
  isEarlyGoing: { 
    type: Boolean, 
    default: false 
  },
  earlyMinutes: { 
    type: Number, 
    default: 0 
  },
  deviceIdUsed: { 
    type: String, 
    default: null 
  },
  userLat: { 
    type: Number, 
    default: null 
  },
  userLng: { 
    type: Number, 
    default: null 
  },
  
  // --- Updated Exception Requests ---
  exceptionRequest: {
    requestType: { 
      type: String, 
      enum: ['Late Arrival', 'Early Departure', 'Half-Day', 'Leave'], 
      default: null 
    },
    reason: { 
      type: String, 
      default: '' 
    },
    status: { 
      type: String, 
      enum: ['None', 'Pending', 'Approved', 'Rejected'], 
      default: 'None' 
    },
    adminComment: { 
      type: String, 
      default: '' 
    }
  }
}, { 
  timestamps: true 
});

// Ensure an employee can only have one attendance document per date[cite: 7]
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;