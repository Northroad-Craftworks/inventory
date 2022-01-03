import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiSpec, version } from './api-spec.js';

// Create the express server.
export const app = express();
export default app;

// Serve the API docs.
app.use('/', swaggerUi.serve);
app.get('/', swaggerUi.setup(apiSpec));

// Serve a status API.
app.get('/status', (req, res) => {
    res.json({
        version
    });
});

export const server = app.listen(process.env.PORT, () => {
    console.log(`Listening on http://localhost:${server.address().port}`);
});