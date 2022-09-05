import Nano from 'nano';
import logger from './logger.js';

const url = new URL(process.env.COUCHDB_URL || 'http://localhost:5984');
const username = process.env.COUCHDB_USERNAME;
const password = process.env.COUCHDB_PASSWORD;
if (username) url.username = username;
if (password) url.password = password;

// Create the nano client and export database connections.
const nanoOpts = {
    url: url.toString(),
    log: data => {
        const path = new URL(data.url || data.headers.uri).pathname;
        if (typeof data.err === 'undefined') logger.couch(data.method.toUpperCase(), path, data.qs);
        else if (data.err) logger.couch('ERR', data.headers.statusCode, path, data.body?.message || `Unknown ${data.err} error`);
        else logger.couch('OK', data.headers.statusCode, path);
    }
}
export const nano = Nano(nanoOpts);
export const db = process.env.COUCHDB_DATABASE || 'inventory';
export const database = nano.use(db);
export default database;

// Initialize the database.
logger.debug(`Checking for database ${db}`);
await nano.db.get(db).catch(async error => {
    if (error?.scope === 'couch' && error.statusCode === 404) {
        logger.warn('Database does not exist and will be created')
        await nano.db.create(db).catch(error => { throw new Error('Unable to create database') });
    }
    else throw new Error('Unable to connect to database');
})
logger.verbose(`View database documents at ${url.origin}/_utils/#database/${db}/_all_docs`);