import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import logger from '../lib/logger.js';

const FileStore = FileStoreFactory(session);
// TODO Use a network-based filestore.

const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('Missing required SESSION_SECRET configuration');

export default session({
    secret,
    // TOOD Configure cookie
    name: 'NRCW-I',
    saveUninitialized: false,
    resave: false,
    store: new FileStore({
        // TODO Specify a path
        logFn: (message) => logger.debug(message)
    })
})