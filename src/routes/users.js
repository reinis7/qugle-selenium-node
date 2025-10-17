import express from 'express';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = express.Router();

dotenv.config()
// In-memory user storage (replace with database in production)
const ADMIN_NAME = process.env.ADMIN_NAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"
const users = [
  {
    id: 1,
    username: ADMIN_NAME,
    password: ADMIN_PASSWORD, // password
    role: 'admin',
    createdAt: new Date()
  }
];

// Login page
usersRouter.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/user-manager/dashboard');
  }
  res.render('login', {
    title: 'Login - User Manager',
    error: null,
    user: null
  });
});

// Login handler
usersRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username or email
    const user = users.find(u => u.username === username);

    if (user && await bcrypt.compare(password, user.password)) {
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      res.redirect('/user-manager/dashboard');
    } else {
      res.render('login', {
        title: 'Login - User Manager',
        error: 'Invalid username or password',
        user: null
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', {
      title: 'Login - User Manager',
      error: 'An error occurred during login',
      user: null
    });
  }
});

// Logout handler
usersRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/user-manager/login');
  });
});

// Sample user data for dashboard
const sampleUsers = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', role: 'User' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Active', role: 'Admin' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive', role: 'User' },
  { id: 4, name: 'Alice Brown', email: 'alice@example.com', status: 'Active', role: 'User' },
  { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', status: 'Active', role: 'User' }
];

// Dashboard route
usersRouter.get('/dashboard', requireAuth, (req, res) => {
  const userStats = {
    total: sampleUsers.length,
    active: sampleUsers.filter(u => u.status === 'Active').length,
    inactive: sampleUsers.filter(u => u.status === 'Inactive').length,
    admins: sampleUsers.filter(u => u.role === 'Admin').length
  };

  res.render('dashboard', {
    title: 'Dashboard',
    user: req.session.user,
    stats: userStats,
    recentUsers: sampleUsers.slice(0, 4)
  });
});

// Users list route
usersRouter.get('/users', requireAuth, (req, res) => {
  res.render('users', {
    title: 'User Management',
    user: req.session.user,
    users: sampleUsers
  });
});

// Add user route (API endpoint)
usersRouter.post('/api/users', requireAuth, (req, res) => {
  const { name, email, role } = req.body;

  // Simple validation
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const newUser = {
    id: sampleUsers.length + 1,
    name,
    email,
    status: 'Active',
    role: role || 'User',
    createdAt: new Date()
  };

  sampleUsers.push(newUser);

  res.json({
    success: true,
    user: newUser,
    message: 'User added successfully'
  });
});

// Delete user route (API endpoint)
usersRouter.delete('/api/users/:id', requireAuth, (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = sampleUsers.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  sampleUsers.splice(userIndex, 1);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

