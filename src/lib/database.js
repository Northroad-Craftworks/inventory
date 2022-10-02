import Nano from 'nano';
import pluralize from 'pluralize';
import logger from './logger.js';
import redis from './redis.js';

const cacheDuration = Number(process.env.CACHE_DURATION) || 600;

export let cacheHits = 0;
export let cacheMisses = 0;

/**
 * A map of nano instances by URL, for re-use.
 */
const nanoInstances = new Map();
const nanoOpts = {
    log: data => {
        const path = new URL(data.url || data.headers.uri).pathname;
        if (typeof data.err === 'undefined') logger.couch(data.method.toUpperCase(), path, data.qs);
        else if (data.err) logger.couch('ERR', data.headers.statusCode, path, data.body?.message || `Unknown ${data.err} error`);
        else logger.couch('OK', data.headers.statusCode, path);
    }
};

class DatabaseError extends Error {
    constructor(baseError) {
        super(baseError);
        this.name = "DatabaseError";

        // Most status codes should not be returned to users.
        const allowedStatuses = [404, 409, 410];
        if (allowedStatuses.includes(baseError.statusCode)) this.statusCode = baseError.statusCode;
    }
}
function convertError(error) {
    throw new DatabaseError(error);
}


export default class Database {
    constructor(db, options) {
        const url = new URL(options?.url || process.env.COUCHDB_URL || 'http://localhost:5984');
        const username = options?.username || process.env.COUCHDB_USERNAME;
        const password = options?.password || process.env.COUCHDB_PASSWORD;
        if (username) url.username = username;
        if (password) url.password = password;
        this.url = url;

        this.nano = nanoInstances.get(url.href) || Nano({
            url: url.href,
            ...options?.nanoOpts,
            ...nanoOpts
        });
        nanoInstances.set(url.href, this.nano);

        this.db = db; // TODO Consider adding a prefix.
        this.database = this.nano.use(this.db);
    }

    async initialize() {
        const { nano, db, url } = this;
        logger.debug(`Initializing ${db}`);
        await nano.db.get(db).catch(async error => {
            if (error?.scope === 'couch' && error.statusCode === 404) {
                logger.warn('Database does not exist and will be created');
                await nano.db.create(db).catch(error => { throw new Error('Unable to create database'); });
            }
            else throw new Error('Unable to connect to database');
        });
        logger.verbose(`View database documents at ${url.origin}/_utils/#database/${db}/_all_docs`);
    }

    /**
     * Get all documents from the database.
     * @returns {Promise<object[]>}
     */
    async list(options) {
        return database.list(options).catch(convertError);
    }

    /**
     * Get a document from the database.
     * @param {string} docId - Document ID to fetch
     * @returns {Promise<object>}
     */
    async get(docId, options) {
        const useCache = options?.cache !== false;
        let document;

        // Check the high-speed redis cache first.
        if (useCache) document = await redis.get(docId)
            .then(cached => {
                if (cached) {
                    cacheHits++;
                    return JSON.parse(cached);
                }
                logger.debug(`Cache miss for ${docId}`);
                cacheMisses++;
            })
            .catch(async error => {
                logger.error(`Cache error:`, error);
                await redis.del(docId)
                    .catch(error => logger.error("Failed to delete broken cache:", error));
                return null;
            });

        // If we haven't loaded the document from cache, check couch.
        if (!document) {
            // If it's not there, check couch and update the cache.
            document = await this.database.get(docId).catch(convertError);
            if (useCache) await redis.set(docId, JSON.stringify(document));
        }
        // Set or refresh the cache TTL.
        if (useCache) await redis.expire(docId, cacheDuration);
        return document;
    }

    /**
     * Save the given document to the database.
     * @param {object} document - Document to save to the database
     * @param {string} document._id - Document ID
     * @param {string} [document._rev] - Document Revision
     * @returns {Promise<string>} New revision of the saved document
     */
    async insert(document, options) {
        if (!document?._id) throw new DatabaseError('Missing `_id` for document');
        const { rev } = await this.database.insert(document).catch(convertError);
        document._rev = rev;
        if (options?.cache !== false) await redis.set(document._id, JSON.stringify(document));
        return rev;
    }

    async destroy(document, options) {
        if (!document?._id) throw new DatabaseError('Missing `_id` for document');
        if (!document?._rev) throw new DatabaseError('Missing `_rev` for document');
        const response = await this.database.destroy(document._id, document._rev);
        // TODO Validate the response.
        delete document._rev;
        if (options?.cache !== false) await redis.del(document._id);
    }

    /**
     * Query a pre-configured view in the database.
     * @param {DesignDoc} designDoc - Design document that defines the view
     * @param {string} view - Name of the view to query
     * @param {object} options - See `params` at https://www.npmjs.com/package/nano#dbviewdesignname-viewname-params-callback
     * @returns {Promise<CloudantV1.ViewResult>}
     */
    async view(designDoc, view, options) {
        // Validate the design doc and view.
        if (!designDoc) throw new DatabaseError('Missing design doc id for view query');
        if (!(designDoc instanceof DesignDoc)) throw new DatabaseError('Invalid design doc for view query');
        if (!view) throw new DatabaseError('Missing view name for view query');
        if (!designDoc.hasView(view)) throw new DatabaseError('The specified view is not in the design doc');

        // Don't attempt to use the design doc until it's ready.
        await designDoc.ready;

        // Fetch the view.
        return this.database.view(designDoc.name, view, options).catch(convertError);
    }

    async find(options) {
        if (!options?.selector) throw new DatabaseError('A selector is required for queries');
        const query = {
            ...options,
            execution_stats: true
        };
        const response = await this.database.find(query);
        if (response.warning) logger.warn(`CouchDB.find warning: ${response.warning}`);
        if (response.execution_stats) {
            const {
                execution_time_ms: time,
                results_returned: returned,
                total_docs_examined: examined
            } = response.execution_stats;
            const message = `Took ${time}ms to find ${pluralize('document', returned, true)} (Examined ${examined})`;
            if (time > Number(process.env.DATABASE_SLOW_MS || 10)) logger.warn(message);
            else logger.debug(message);
        }

        // If the response returned the limit requested, add a shortcut to get more.
        if (response?.docs?.length === (query.limit || 25)) {
            response.getNextPage = async () => find({ ...query, bookmark: response.bookmark });
        }
        return response;
    }
};

/**
 * A design doc defines views and indexes in the database.
 * This helper class makes it easier to define a design doc and update it at runtime.
 */
export class DesignDoc {
    constructor(database, name, template) {
        if (!name) throw new DatabaseError('Cannot create a design doc without a database');
        if (!(database instanceof Database)) throw new DatabaseError('Database must be an instance of Database');
        this.database = database;
        if (!name) throw new DatabaseError('Cannot create a design doc without a name');
        this.name = name;

        // Parse the template into a valid format for the design document.
        const parseToDocument = (item) => {
            if (Array.isArray(item)) {
                return item.map(value => parseToDocument(value));
            }
            if (typeof item === 'object') {
                return Object.entries(item).reduce((acc, [key, value]) => {
                    acc[key] = parseToDocument(value);
                    return acc;
                }, {});
            }
            if (typeof item === 'function') {
                return item.toString();
            }
            else return item;
        };
        this.document = { _id: `_design/${name}`, ...parseToDocument(template) };

        // Update the design doc in the database asyncronously.
        this.ready = this.assert();
    }

    /**
     * Ensure that this design doc exists in the database.
     * If it doesn't exist, it is created.
     * If it does exist, but is different, it is updated.
     * @returns {Promise<void>}
     */
    async assert() {
        logger.debug(`Asserting design document: ${this.name}`);
        const existingDoc = await this.database.get(this.document._id, { cache: false })
            .catch(error => {
                // Ignore 404s, since we'll create the document.
                if (error.statusCode === 404) return;
                throw new DatabaseError(error);
            });

        // Compare the existing document to the desired one.
        if (existingDoc) {
            const stringifyDoc = (doc) => {
                const { _id, _rev, ...rest } = doc;
                return JSON.stringify(rest);
            };
            if (stringifyDoc(existingDoc) === stringifyDoc(this.document)) {
                logger.debug(`No changes required for design document ${this.name}@${existingDoc._rev}`);
                return;
            }
        }

        // Publish a new or updated version.
        this.document._rev = existingDoc?._rev;
        await this.database.insert(this.document, { cache: false })
            .then(revision => logger.info(`Updated design document ${this.name}@${revision}`))
            .catch(error => {
                if (error.statusCode !== 409) throw error;
                logger.debug(`Another instance already updated design document ${this.name}`);
            });
    }

    /**
     * Check whether this design doc contains a view with the given name.
     * @param {string} view - View name to check
     * @returns {boolean} Whether or not this design doc defines that view
     */
    hasView(view) {
        return Boolean(this.document?.views?.[view]?.map);
    }
}
