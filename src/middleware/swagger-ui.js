import swaggerUi from 'swagger-ui-express';
import { apiSpec, version } from '../utilities/api-spec.js';

import express from 'express';

export const router = new express.Router();
export default router;

// Serve the API docs.
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(apiSpec));