import Redis from 'ioredis';
import logger from '../lib/logger.js';
export const client = new Redis({lazyConnect: true});
export default client;

// Make sure the initial connection works.
let connected = false;
client.once('error', error => {
    if (connected) logger.debug(`[redis]`, error)
    else {
        logger.error('Failed to connect to redis. Was it started?')
        logger.debug(error);
        process.exit(1);
    }
});
await client.connect();
logger.verbose('Connected to redis');
connected = true;

// Log future errors.
client.on('error', error => logger.debug(`[redis]`, error));