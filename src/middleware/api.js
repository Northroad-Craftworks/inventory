import express, { Router } from 'express'
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
        'application/x-www-form-urlencoded': express.urlencoded({extended: false}),
        'application/json': express.json()
    },
    operations,
    errorMiddleware: (error, req, res, next) => {
        if (error.status == 400 && error.errors) {
            const suberrors = error.errors.map(error => `\`${error.location}.${error.path}\`: ${error.message}`);
            const message = ['Bad request:', ...suberrors].join('\n- ')
            next(createError(error.status, message));
        }
        else if (error.errors?.length === 1){
            next(createError(error.status, error.errors[0]));
        }
        else if (error.errors){
            error.errors.forEach(error => logger.error(error));
            next(createError(error.status, 'Multiple errors'));
        }
        else next(createError(error.status, error));
    }
});