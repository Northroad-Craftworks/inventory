import './lib/env.js';
import express from 'express';
import createError from 'http-errors';
import logger from './lib/logger.js';
import helmetMiddleware from './middleware/helmet.js';
import sessionMiddleware from './middleware/session.js';
import authenticationMiddleware from './middleware/authentication.js';
import swaggerUiMiddleware from './middleware/swagger-ui.js';
import loggerMiddleware from './middleware/logger.js';
import apiMiddleware from './middleware/api.js';

// Create the express server.
logger.debug('Initializing express...');
export const app = express();
export default app;

// Use helmet for security.
app.use(helmetMiddleware);

// Serve static assets.
app.use('/static', express.static(new URL('static', import.meta.url).pathname));

// Log requests
app.use(loggerMiddleware);

// Authenticate all other requests.
app.use(sessionMiddleware);
app.use(authenticationMiddleware);

// Serve the swaggerUI middleware.
app.use('/', swaggerUiMiddleware);

// Mount the APIs
app.use(apiMiddleware);

// For any unhandled request, throw an error.
app.use((req, res) => {
    res.sendStatus(404);
});

// Return errors as JSON.
app.use((error, req, res, next) => {
    // Make sure this is an HTTP error, and extract everything.
    const { expose, message, statusCode, stack, headers } = createError(error);
    logger.error(error);
    /* c8 ignore next 4 */
    if (statusCode >= 500) logger.error(stack || 'No stack available');
    if (headers) res.set(headers);
    if (expose) res.status(statusCode).type('text/plain').send(message);
    else res.sendStatus(statusCode);
});

// Start the server.
logger.debug('Starting HTTP server...');
export const server = await new Promise((resolve) => {
    const server = app.listen(process.env.PORT || '8080', () => {
        resolve(server);
    });
});
export const localUrl = `http://localhost:${server.address().port}`;
logger.info(`Listening on ${localUrl}`);
