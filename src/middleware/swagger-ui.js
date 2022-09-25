import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiSpec } from '../lib/api-spec.js';
import { disableLog, enableLog } from './logger.js';

const router = new Router();
export default router;

// If the user isn't authenticated, send them to login.
router.get('/', (req, res, next) => {
    if (!req.user) res.redirect('/login');
    else next();
});

// Serve the API docs.
router.get('/', swaggerUi.setup(apiSpec, { customCssUrl: 'static/css/swagger-dark.css' }));
router.use('/', disableLog, swaggerUi.serve, enableLog);