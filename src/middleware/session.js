import session from 'express-session';
import RedisStoreFactory from 'connect-redis';
import {v4 as uuid} from 'uuid';
import redisClient from '../lib/redis.js';

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('Missing required SESSION_SECRET configuration');

const RedisStore = RedisStoreFactory(session);
const store =  new RedisStore({
    client: redisClient,
    prefix: 'session:'
})

export default session({
    secret,
    cookie: {
        domain: '.northroad-craftworks.com'
    },
    name: 'NRCW',
    saveUninitialized: false,
    resave: false,
    store,
    genid: req => `${req.user?.id || 'anonymous'}:${uuid()}`
});