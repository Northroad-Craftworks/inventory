import { Router } from 'express';
import createError from 'http-errors';
import passport from 'passport';
import logger from '../lib/logger.js';
import User from '../models/User.js';

const router = new Router();
export default router;

const accountsUrl = new URL(process.env.ACCOUNTS_URL || `https://accounts.northroad-craftworks.com/`);

// Support sessions.
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    User.get(id)
        .then(user => done(null, user))
        .catch(error => done(error));
});
router.use(passport.session());
router.use((req, res, next) => {
    if (!req.session) throw createError(503, "Failed to fetch session", { expose: true });
    else next();
});

router.get('/', (req, res, next) => {
    const { hostname, traceId, secure } = req;
    const destination = encodeURI(`http${secure ? 's' : ''}://${hostname}`);
    if (!req.user) res.redirect(`${accountsUrl}auth?destination=${destination}&trace=${traceId}`);
    else next();
});