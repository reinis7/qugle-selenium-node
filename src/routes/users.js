import express from 'express';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

import { requireAuth } from '../middleware/auth.js';
import { UsersDB } from '../helpers/utils.js';
import { STATUS_DONE, STATUS_INIT, STATUS_RUNNING } from '../db/jsonDB.js';
import { readUserDirectory } from '../helpers/user-file.js';

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



// Dashboard route
usersRouter.get('/dashboard', requireAuth, (req, res) => {
  const allUsers = UsersDB.getAllArray().sort((a, b)=> b.userId - a.userId);
  const userStats = {
    total: allUsers.length,
    done: allUsers.filter(u => u.status == STATUS_DONE).length,
    running: allUsers.filter(u => u.status === STATUS_RUNNING || u.status === STATUS_INIT).length,
  };

  res.render('dashboard', {
    title: 'Dashboard',
    user: req.session.user,
    stats: userStats,
    recentUsers: allUsers.slice(0, 4)
  });
});

// Users list route
usersRouter.get('/users', requireAuth, (req, res) => {
  const allUsers = UsersDB.getAllArray();

  res.render('users', {
    title: 'Users List',
    user: req.session.user,
    users: allUsers
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

// User detail route - Updated to read from file system
usersRouter.get('/users/:userId', requireAuth, async (req, res) => {
  const userId = req.params.userId;

  // Find user by ID
  const user = UsersDB.get(userId)

  if (!user) {
    return res.status(404).render('404', {
      title: 'User Not Found',
      user: req.session.user
    });
  }

  try {
    // Read user data from file system
    const userData = await readUserDirectory(userId);
    if (!userData.exists) {
      return res.status(404).render('404', {
        title: 'User Data Not Found',
        user: req.session.user,
        message: `No data found for user ${userId} in the logs directory.`
      });
    }

    // // Sample activity logs (you can also read these from files)
    // const userLogs = [
    //   { id: 1, action: 'Login', timestamp: new Date('2024-01-15T10:30:00'), ip: '192.168.1.100' },
    //   { id: 2, action: 'File Upload', timestamp: new Date('2024-01-15T11:15:00'), ip: '192.168.1.100' },
    //   { id: 3, action: 'Profile Update', timestamp: new Date('2024-01-14T14:20:00'), ip: '192.168.1.100' }
    // ];

    res.render('user-detail', {
      title: `User Details - ${user.email}`,
      user: req.session.user,
      userDetail: user,
      logs: userData.loginInfo ? userData.loginInfo.split('\n') : [],
      files: userData.files ?? [],
      images: userData.images ?? [],
      hasFiles: userData.files.length > 0,
      hasImages: userData.images.length > 0
    });
  } catch (error) {
    console.error('Error reading user data:', error);
    res.status(500).render('error', {
      title: 'Server Error',
      user: req.session.user,
      message: 'Error reading user data from file system.'
    });
  }
});

// Serve static files from logs directory
usersRouter.use('/logs', requireAuth, express.static(path.resolve('./logs')));

// File download route
usersRouter.get('/download/:userId/:type/:filename', requireAuth, async (req, res) => {
  const { userId, type, filename } = req.params;

  // Validate type to prevent directory traversal
  if (!['files', 'images'].includes(type)) {
    return res.status(400).send('Invalid file type');
  }

  const filePath = path.resolve('../logs/users', `user_log_${userId}`, type == 'images' ? 'shots' : '.', filename);

  try {
    // Check if file exists
    await fs.access(filePath);

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(404).send('File not found');
  }
});
