import crypto from 'crypto';
import { Router } from 'express';
import createError from 'http-errors';
import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import logger from '../lib/logger.js';

const router = new Router();
export default router;


// Keep track of which strategies are configured.
const strategies = [];


// Support sessions.
passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((user, done) => {
    if (!strategies.includes(user.provider)) done(null, false);
    else done(null, user);
});
router.use(passport.session());


// TODO Move all authentication to an external service

// Configure the google strategy
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
if (GOOGLE_CLIENT_ID) {
    const googleOptions = {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: '/oauth2/redirect/google',
        scope: ['email', 'profile']
    };
    passport.use(new GoogleStrategy(googleOptions, verifyOauthProfile));
    router.get('/login/google', passport.authenticate('google'));
    router.get('/oauth2/redirect/google',
        passport.authenticate('google', { failureRedirect: '/login', failureMessage: true }),
        redirectToDestination);
    strategies.push('google');
}

// TODO Configure an local strategy

// Configure an anonymous strategy
if (process.env.ALLOW_ANONYMOUS === 'true') {
    router.get('/login/anonymous',
        (req, res, next) => req.login({ id: 'Anonymous', provider: 'anonymous' }, next),
        redirectToDestination);
    strategies.push('anonymous');
}


if (strategies.length) logger.info(`Configured authentication strategies: ${strategies.join(', ')}`);
else logger.warn('No authentication strategies are configured!');


// Attach the login and logout handlers.
router.get('/login', (req, res) => {
    const fromLogout = req.query?.source === 'logout';
    const allowAutoLogin = !fromLogout && req.query?.allowAuto !== false;
    if (allowAutoLogin && strategies.length === 1) {
        res.redirect(`/login/${strategies[0].toLowerCase()}`);
    }
    else if (strategies.length) {
        // TODO Replace placeholder login page with a proper one.
        const links = strategies.map(strategy => `<li><a href='/login/${strategy}'>${strategy}</a></li>`);
        res.type('html').send(`<h1>Login</h2>\n<ul>\n${links.join('\n')}\n</ul>`);
    }
    else throw createError(503, "No authentication strategies are available", { expose: true, stack: false });
});

router.use('/logout',
    (req, res, next) => req.logout(next),
    (req, res) => res.redirect('/login?source=logout'));


/**
 * Helper function to redirect to the user's destination after login.
 */
function redirectToDestination(req, res) {
    // TODO Load the intended destination.
    res.redirect('/');
}

/**
 * A common function to handle all standard OAuth profiles.
 * @param {string} accessToken 
 * @param {string} refreshToken 
 * @param {object} profile 
 * @param {function} done 
 */
function verifyOauthProfile(accessToken, refreshToken, profile, done) {
    // TODO Connect to a user database.
    const provider = profile.provider?.toLowerCase();
    if (!strategies.includes(provider)) throw new Error(`OAuth provider '${provider}' doesn't match strategy`);
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const user = {
        id: name || email || `${provider}:${profile.id}`,
        provider,
        email,
        name,
        profilePhoto: profile.photos?.[0]?.value
    };
    done(null, user);
};