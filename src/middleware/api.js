import express, { Router } from 'express';
import openApiFramework from 'express-openapi';
import createError from 'http-errors';
import apiSpec from '../lib/api-spec.js';
import operations from "../operations/index.js";
import logger from './logger.js';

const router = new Router();
export default router;

// Use express-openapi to generate APIs based on the API spec.
openApiFramework.initialize({
    app: router,
    apiDoc: apiSpec,
    promiseMode: true,
    exposeApiDocs: false,
    enableObjectCoercion: true,
    consumesMiddleware: {
        'application/x-www-form-urlencoded': express.urlencoded({ extended: false }),
        'application/json': express.json()
    },
    operations,
    errorTransformer: (openapiError, ajvError) => {
        let { message, location, path } = openapiError;
        switch (ajvError.keyword) {
            case 'additionalProperties':
                message = `\`${ajvError.params.additionalProperty}\` is not an writeable property`;
                break;
            case 'enum':
                message = `\`${path}\` ${message}: ${ajvError.params.allowedValues.join(', ')}`;
                break;
            default:
                message = `\`${path}\` ${message}`;
        }
        return { message };
    },
    errorMiddleware: (error, req, res, next) => {
        if (error.errors) {
            const message = ['Bad request:', ...error.errors.map(error => error.message)].join('\n- ');
            next(createError(error.status, message));
        }
        else next(createError(error.status || 500, error));
    }
});