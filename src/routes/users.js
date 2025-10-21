import express from 'express';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

import { requireAuth } from '../middleware/auth.js';
import { UsersDB } from '../helpers/utils.js';
import { STATUS_DONE, STATUS_INIT, STATUS_RUNNING } from '../db/jsonDB.js';
import { readUserDirectory } from '../helpers/user-file.js';

// Import centralized constants and error handling
import { USER_CONFIG, FILE_CONFIG } from '../constants/index.js';
import { 
  ValidationError, 
  NotFoundError, 
  asyncHandler,
  validateRequired,
  validateEmail,
  validateUserId 
} from '../helpers/errorHandler.js';

export const usersRouter = express.Router();

dotenv.config();

// ---------------------------
// Helper Functions
// ---------------------------
function validateUserInput(name, email) {
  try {
    validateRequired(name, 'Name');
    validateRequired(email, 'Email');
    validateEmail(email);
    return { isValid: true, errors: [] };
  } catch (error) {
    return { isValid: false, errors: [error.message] };
  }
}

function renderLoginPage(res, error = null) {
  res.render('login', {
    title: 'Login - User Manager',
    error,
    user: null
  });
}

function renderErrorPage(res, title, message, user = null) {
  res.render('error', {
    title,
    message,
    user
  });
}

// ---------------------------
// User Management
// ---------------------------
const users = [
  {
    id: 1,
    username: process.env.ADMIN_NAME || USER_CONFIG.ADMIN_NAME,
    password: process.env.ADMIN_PASSWORD || USER_CONFIG.DEFAULT_ADMIN_PASSWORD,
    role: 'admin',
    createdAt: new Date()
  }
];

// ---------------------------
// Authentication Routes
// ---------------------------
usersRouter.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/user-manager/dashboard');
  }
  renderLoginPage(res);
});

usersRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
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
      renderLoginPage(res, 'Invalid username or password');
    }
  } catch (error) {
    console.error('Login error:', error);
    renderLoginPage(res, 'An error occurred during login');
  }
});

usersRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/user-manager/login');
  });
});



// ---------------------------
// Dashboard Routes
// ---------------------------
usersRouter.get('/dashboard', requireAuth, (req, res) => {
  try {
    const allUsers = UsersDB.getAllArray().sort((a, b) => b.userId - a.userId);
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
  } catch (error) {
    console.error('Dashboard error:', error);
    renderErrorPage(res, 'Dashboard Error', 'Failed to load dashboard', req.session.user);
  }
});

// ---------------------------
// User Management Routes
// ---------------------------
usersRouter.get('/users', requireAuth, (req, res) => {
  try {
    const allUsers = UsersDB.getAllArray();

    res.render('users', {
      title: 'Users List',
      user: req.session.user,
      users: allUsers
    });
  } catch (error) {
    console.error('Users list error:', error);
    renderErrorPage(res, 'Users Error', 'Failed to load users list', req.session.user);
  }
});

usersRouter.post('/api/users', requireAuth, asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;

  // Validate input using centralized validation
  const validation = validateUserInput(name, email);
  if (!validation.isValid) {
    throw new ValidationError('Validation failed', validation.errors);
  }

  const newUser = {
    id: users.length + 1,
    name,
    email,
    status: USER_CONFIG.DEFAULT_USER_STATUS,
    role: role || USER_CONFIG.DEFAULT_USER_ROLE,
    createdAt: new Date()
  };

  users.push(newUser);

  res.json({
    success: true,
    user: newUser,
    message: 'User added successfully'
  });
}));

usersRouter.delete('/api/users/:id', requireAuth, asyncHandler(async (req, res) => {
  const userId = validateUserId(req.params.id);
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    throw new NotFoundError('User not found');
  }

  users.splice(userIndex, 1);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

// ---------------------------
// User Detail Routes
// ---------------------------
usersRouter.get('/users/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = UsersDB.get(userId);

    if (!user) {
      return res.status(404).render('404', {
        title: 'User Not Found',
        user: req.session.user
      });
    }

    const userData = await readUserDirectory(userId);
    if (!userData.exists) {
      return res.status(404).render('404', {
        title: 'User Data Not Found',
        user: req.session.user,
        message: `No data found for user ${userId} in the logs directory.`
      });
    }

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

// ---------------------------
// File Management Routes
// ---------------------------
usersRouter.use('/logs', requireAuth, express.static(path.resolve('./logs')));

usersRouter.get('/download/:userId/:type/:filename', requireAuth, asyncHandler(async (req, res) => {
  const { userId, type, filename } = req.params;

  // Validate file type using centralized constants
  if (!USER_CONFIG.ALLOWED_FILE_TYPES.includes(type)) {
    throw new ValidationError('Invalid file type');
  }

  const filePath = path.resolve('../logs/users', `${FILE_CONFIG.USER_LOG_PREFIX}${userId}`, type === 'images' ? FILE_CONFIG.SCREENSHOT_DIR : '.', filename);

  // Check if file exists
  await fs.access(filePath);

  // Set appropriate headers for download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
}));
