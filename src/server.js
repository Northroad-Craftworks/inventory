import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { apiSpec, version } from './api-spec.js';

// TODO Use a proper logger
console.log('Initializing...');

// Create the express server.
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

export const server = await new Promise((resolve) => {
    const server = app.listen(process.env.PORT, () => {
        resolve(server);
    });
});

export const localUrl = `http://localhost:${server.address().port}`;

// TODO Use a proper logger.
console.log(`Listening on ${localUrl}`);