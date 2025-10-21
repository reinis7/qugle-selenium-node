// constants.js — Centralized application constants
// -----------------------------------------------

// ---------------------------
// Application Configuration
// ---------------------------
export const APP_CONFIG = {
  DEFAULT_PORT: 8101,
  DEFAULT_SESSION_SECRET: 'fallback-secret',
  SESSION_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  LOCALHOST_IPS: ["127.0.0.1", "::1"],
  DEFAULT_USER_ID_START: 9200
};

// ---------------------------
// Chrome Configuration
// ---------------------------
export const CHROME_CONFIG = {
  EXE_PATH: "/opt/google/chrome/google-chrome",
  TEMP_DIR: "/chromeTEMP",
  START_URL: "https://accounts.google.com",
  DISPLAY: ":1",
  LANGUAGE: "en",
  
  // Chrome arguments
  ARGS: [
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1440,900",
    "--window-position=50,50",
    "--no-sandbox",
    "--disable-dev-shm-usage",
  ],
  
  // Korean-specific arguments
  KOREAN_ARGS: [
    "--lang=ko",
    "--accept-lang=ko-KR,ko,en-US,en",
    "--enable-features=PreferKoreanText",
    "--disable-translate",
    "--disable-features=TranslateUI",
  ],
  
  // Korean environment variables
  KOREAN_ENV: {
    LANG: 'ko_KR.UTF-8',
    LC_ALL: 'ko_KR.UTF-8',
    LC_CTYPE: 'ko_KR.UTF-8',
    LANGUAGE: 'ko:en',
  },
  
  // Window management
  WINDOW_CONFIG: {
    MAX_ONE_VIEW_CNT: 6,
    PIX_STEP: 30,
    WND_W: 1440,
    WND_H: 1080,
  },
  
  // Timeouts
  TIMEOUTS: {
    DEBUGGER_PORT: 10000,
    CHROME_START: 20000,
    DRIVER_HEALTH: 2000,
    PAGE_LOAD: 10000,
    SCREENSHOT_DELAY: 400,
    ACTION_DELAY: 200,
  }
};

// ---------------------------
// Google URLs
// ---------------------------
export const GOOGLE_URLS = {
  DONE: "https://myaccount.google.com",
  ACCOUNT_URL: "https://accounts.google.com",
  INPUT_EMAIL: "https://accounts.google.com/v3/signin/identifier",
  INPUT_PASSWORD: "https://accounts.google.com/v3/signin/challenge/pwd",
  
  // 2-Step Authentication URLs
  CHALLENGE_SELECTION: "https://accounts.google.com/v3/signin/challenge/selection",
  IPE_VERIFY: "https://accounts.google.com/v3/signin/challenge/ipe/verify",
  TOTP: "https://accounts.google.com/v3/signin/challenge/totp",
  OOTP: "https://accounts.google.com/v3/signin/challenge/ootp",
  DP: "https://accounts.google.com/v3/signin/challenge/dp",
  DP_PRESEND: "https://accounts.google.com/v3/signin/challenge/dp/presend",
  IPP_COLLECT: "https://accounts.google.com/v3/signin/challenge/ipp/collect",
  IPP_VERIFY: "https://accounts.google.com/v3/signin/challenge/ipp/verify",
  BC: "https://accounts.google.com/v3/signin/challenge/bc",
  PASSKEY: "https://accounts.google.com/v3/signin/challenge/pk/presend",
  HELP: "https://accounts.google.com/v3/signin/challenge/rejected",
  REJECTED: "https://accounts.google.com/v3/signin/rejected",
  RECOVERY_OPTION: "https://gds.google.com",
  
  // Mail URLs
  MAIL_DEFAULT: "https://mail.google.com",
  MAIL_INBOX: "https://mail.google.com/mail/u/0/#inbox",
  MAIL_TRASH: "https://mail.google.com/mail/u/0/#trash",
  
  // Account Management URLs
  ACCOUNT_SECURITY: "https://myaccount.google.com/security",
  NOTIFICATIONS: "https://myaccount.google.com/notifications",
  AUTHENTICATOR: "https://myaccount.google.com/two-step-verification/authenticator",
  BACKUP_CODES: "https://myaccount.google.com/two-step-verification/backup-codes",
  
  // Chrome URLs
  SIGNIN_TO_CHROME: "chrome://signin-dice-web-intercept.top-chrome/chrome-signin",
  CHROME_EXTENSION_AUTHENTICATOR: "chrome-extension://bhghoamapcdpbohphigoooaddinpkbai/view/popup.html",
  
  // Favicon
  FAVICON: "https://www.google.com/favicon.ico"
};

// ---------------------------
// HTML Element Selectors
// ---------------------------
export const SELECTORS = {
  MAIN_DIV_ID: "yDmH0d",
  EMAIL_INPUT_ID: "identifierId",
  PASSWORD_INPUT_NAME: "Passwd",
  LANGUAGE_SELECTOR_XPATH: '//div[@jsname="oYxtQd"]',
  PAGE_LOADING_XPATH: '//div[@jsname="USBQqe"]',
  PROGRESS_BAR_XPATH: '//div[@jscontroller="ltDFwf"]',
  MAIN_CONTENT_XPATH: '//div[@class="S7xv8 LZgQXe"]',
  
  // Button selectors
  ACCOUNT_RESELECT_XPATH: '//div[@jsname="af8ijd"]',
  PASSWORD_CHECKBOX_XPATH: '//input[@class="VfPpkd-muHVFf-bMcfAe"]',
  TRY_ANOTHER_WAY_CLASS: 'aZvCDf cd29Sd zpCp3 SmR8',
  
  // Mail selectors
  MAIL_ROW_XPATH: '//tr[@jsmodel="nXDxbd"]',
  MAIL_GRIDCELL_XPATH: './/td[@role="gridcell"]',
  MAIL_SENDER_SPAN_XPATH: ".//div[2]/span/span",
  MAIL_CLICKABLE_XPATH: ".//td[2]/div",
  MAIL_TOOLBAR_XPATH: '//div[@gh="mtb"]',
  MAIL_DELETE_BUTTON_XPATH: './/div[@role="button"]',
  
  // Security selectors
  SECURITY_LINK_XPATH: '//a[@jsname="cDqwkb"]',
  SECURITY_SPAN_XPATH: './/span[@class="Xc5Wg TCnBcf"]',
  SECURITY_YES_BUTTON_XPATH: '//button[@jsname="j6LnYe"]',
  
  // Chrome signin selectors
  CHROME_SIGNIN_APP: 'chrome-signin-app',
  CHROME_ACCEPT_BUTTON: 'cr-button[id="accept-button"]'
};

// ---------------------------
// User Management Constants
// ---------------------------
export const USER_CONFIG = {
  ADMIN_NAME: 'admin',
  DEFAULT_USER_ROLE: 'User',
  DEFAULT_USER_STATUS: 'Active',
  ALLOWED_FILE_TYPES: ['files', 'images'],
  
  // Password hash for default admin (password)
  DEFAULT_ADMIN_PASSWORD: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"
};

// ---------------------------
// File System Constants
// ---------------------------
export const FILE_CONFIG = {
  USERS_LOG_DIR: "./logs",
  DEBUG_LOG_DIR: "./debug/logs",
  SCREENSHOT_DIR: "shots",
  USER_LOG_PREFIX: "user_log_",
  
  // File extensions
  IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
  LOG_EXTENSIONS: ['.log', '.txt', '.json'],
  
  // File operations
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/gif', 'text/plain', 'application/json']
};

// ---------------------------
// API Response Constants
// ---------------------------
export const API_RESPONSES = {
  SUCCESS: { status: 1 },
  FAILURE: { status: 0 },
  
  // Common messages
  MESSAGES: {
    SUCCESS: 'Operation completed successfully',
    FAILED: 'Operation failed',
    INVALID_INPUT: 'Invalid input provided',
    UNAUTHORIZED: 'Unauthorized access',
    NOT_FOUND: 'Resource not found',
    INTERNAL_ERROR: 'Internal server error',
    VALIDATION_FAILED: 'Validation failed',
    FILE_NOT_FOUND: 'File not found',
    PROCESS_FAILED: 'Process failed'
  }
};

// ---------------------------
// Security Constants
// ---------------------------
export const SECURITY_CONFIG = {
  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100
  },
  
  // Session security
  SESSION_SECURITY: {
    SECURE_COOKIES: false, // Set to true in production with HTTPS
    HTTP_ONLY: true,
    SAME_SITE: 'lax'
  },
  
  // Input validation
  VALIDATION: {
    MAX_EMAIL_LENGTH: 254,
    MAX_USERNAME_LENGTH: 50,
    MAX_PASSWORD_LENGTH: 128,
    MIN_PASSWORD_LENGTH: 8
  }
};

// ---------------------------
// Logging Constants
// ---------------------------
export const LOG_CONFIG = {
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  },
  
  // Log file names
  FILES: {
    DEBUG: 'debug.log',
    ERROR: 'error.log',
    ACCESS: 'access.log',
    USER: 'user.log'
  },
  
  // Log formats
  FORMATS: {
    TIMESTAMP: 'YYYY-MM-DD HH:mm:ss',
    JSON: 'json',
    SIMPLE: 'simple'
  }
};

// ---------------------------
// Feature Flags
// ---------------------------
export const FEATURE_FLAGS = {
  SET_TOTP_FLAG: false,
  SET_BACKUPCODES_FLAG: false,
  ENABLE_SCREENSHOTS: true,
  ENABLE_LOGGING: true,
  ENABLE_DEBUG_MODE: false
};
