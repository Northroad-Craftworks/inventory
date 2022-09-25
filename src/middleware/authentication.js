import crypto from 'crypto';
import { Router } from 'express';
import createError from 'http-errors';
import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import logger from '../lib/logger.js';

const router = new Router();
export default router;

// Support sessions.
passport.serializeUser((user, done) => {
    // TODO Actually serialize the user.
    done(null, user);
});
passport.deserializeUser((user, done) => {
    // TODO Actually deserialze the user.
    done(null, user);
});
router.use(passport.session());


// Keep track of which strategies are configured.
const configuredStrategies = [];

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
    configuredStrategies.push('Google');
}

// TODO Configure an local strategy

// Configure an anonymous strategy
if (process.env.REQUIRE_AUTH === 'false') {
    router.get('/login/anonymous',
        (req, res, next) => req.login({ id: 'Anonymous', provider: 'Anonymous' }, next),
        redirectToDestination);
    configuredStrategies.push('Anonymous');
}


if (configuredStrategies.length) logger.info(`Configured authentication strategies: ${configuredStrategies.join(', ')}`);
else logger.warn('No authentication strategies are configured!');


// Attach the login and logout handlers.
router.get('/login', (req, res) => {
    const fromLogout = req.query?.source !== 'logout';
    const allowAutoLogin = !fromLogout && req.query?.allowAuto !== false;
    if (allowAutoLogin && configuredStrategies.length === 1) {
        res.redirect(`/login/${configuredStrategies[0].toLowerCase()}`);
    }
    else if (configuredStrategies.length) {
        // TODO Replace placeholder login page with a proper one.
        const links = configuredStrategies.map(strategy => `<li><a href='/login/${strategy.toLowerCase()}'>${strategy}</a></li>`);
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
    const provider = profile.provider.charAt(0).toUpperCase() + profile.provider.slice(1);
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