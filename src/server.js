import express from 'express';
import createError from 'http-errors';
import logger from './utilities/logger.js';
import * as middleware from './middleware/index.js';

// Create the express server.
logger.debug('Initializing express...');
export const app = express();
export default app;

// Use helmet for security.
app.use(middleware.helmet);

// Serve a status API.
app.get('/status', middleware.status);

// Serve the swaggerUI middleware.
app.use('/', middleware.swaggerUi);

// Log all other requests
app.use(middleware.logger);

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