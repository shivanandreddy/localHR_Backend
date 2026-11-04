import jwt from 'jsonwebtoken';
import Employee from '../models/employee.model.js';

// 1. Protect Middleware: Verifies JWT and attaches user to req.user
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header (Format: "Bearer TOKEN")
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

      // Attach user to the request object (excluding heavy faceDescriptor for performance)
      req.user = await Employee.findById(decoded.id).select('-faceDescriptor');

      if (!req.user || !req.user.isActive) {
        return res.status(401).json({ message: 'Not authorized, user not found or inactive.' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized, token failed.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided.' });
  }
};

// 2. Authorize Middleware: Restricts access based on roles (e.g., "Admin", "HR")
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied: Role '${req.user ? req.user.role : 'Unknown'}' is not authorized to access this route.` 
      });
    }
    next();
  };
};