import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6 
  },
  role: { 
    type: String, 
    enum: ['Admin', 'Manager', 'Employee'], 
    default: 'Employee' 
  },
  shiftStart: { 
    type: String, 
    default: "09:30" 
  },
  shiftEnd: { 
    type: String, 
    default: "18:30" 
  },
  basicSalary: { 
    type: Number, 
    required: true 
  },
  boundDeviceId: { 
    type: String, 
    default: null 
  },
  // NEW: Stores the facial biometric template (128-point descriptor array from face scanner)
  faceDescriptor: { 
    type: [Number], 
    default: [] 
  },
  // NEW: Assigned GPS geofence coordinates for employee clock-in validation
  latitude: { 
    type: Number, 
    default: null 
  },
  longitude: { 
    type: Number, 
    default: null 
  },
  allowedRadiusMeters: { 
    type: Number, 
    default: 75 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;