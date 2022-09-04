import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiSpec } from '../lib/api-spec.js';

const router = new Router();
export default router;

// Serve the API docs.
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(apiSpec, { customCssUrl: 'static/css/swagger-dark.css' }));