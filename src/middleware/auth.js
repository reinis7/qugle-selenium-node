// Authentication middleware
export const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/user-manager/login');
    }
};

// Optional: Admin role middleware
export const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).render('error', {
            title: 'Access Denied',
            message: 'You need admin privileges to access this page.',
            user: req.session.user
        });
    }
};
