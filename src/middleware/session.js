import session from 'express-session';

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('Missing required SESSION_SECRET configuration');

export default session({
    secret,
    // TOOD Configure cookie
    name: 'NRCW-I',
    saveUninitialized: false,
    resave: false,
    // TODO Configure a proper session store.
})