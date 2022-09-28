import session from 'express-session';
import RedisStoreFactory from 'connect-redis';
import redisClient from '../lib/redis.js';

const RedisStore = RedisStoreFactory(session);

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('Missing required SESSION_SECRET configuration');

export default session({
    secret,
    // TOOD Configure cookie
    name: 'NRCW-I',
    saveUninitialized: false,
    resave: false,
    store: new RedisStore({
        client: redisClient,
        prefix: 'sess:inventory:'
    })
});