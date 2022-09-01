import './lib/env.js';
import express from 'express';
import createError from 'http-errors';
import logger from './lib/logger.js';
import helmetMiddleware from './middleware/helmet.js';
import statusMiddleware from './middleware/status.js';
import swaggerUiMiddleware from './middleware/swagger-ui.js';
import loggerMiddleware from './middleware/logger.js';

// Create the express server.
logger.debug('Initializing express...');
export const app = express();
export default app;

// Use helmet for security.
app.use(helmetMiddleware);

// Serve a status API.
app.get('/status', statusMiddleware);

// Serve static assets.
app.use('/static', express.static(new URL('static', import.meta.url).pathname));

// Serve the swaggerUI middleware.
app.use('/', swaggerUiMiddleware);

// Log all other requests
app.use(loggerMiddleware);

// For any unhandled request, throw an error.
app.use((req, res) => {
    res.sendStatus(404);
});

// Start the server.
logger.debug('Starting HTTP server...');
export const server = await new Promise((resolve) => {
    const server = app.listen(process.env.PORT, () => {
        resolve(server);
    });
});
export const localUrl = `http://localhost:${server.address().port}`;
logger.info(`Listening on ${localUrl}`);