import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import logger from './logger.js';
import { apiSpec, version } from './api-spec.js';

// Create the express server.
logger.debug('Initializing express...');
export const app = express();
export default app;

// Use helmet for security.
app.use(helmet());

// Serve the API docs.
app.use('/', swaggerUi.serve);
app.get('/', swaggerUi.setup(apiSpec));

// Serve a status API.
app.get('/status', (req, res) => {
    res.json({
        version
    });
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