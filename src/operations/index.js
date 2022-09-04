import createError from 'http-errors';
import { readdir } from 'fs/promises';
import { apiSpec } from '../lib/api-spec.js';
import logger from '../lib/logger.js';

// Load all the operations from every .js file in this directory.
export const operations = {};
await readdir(new URL('.', import.meta.url), 'utf8')
    .then(files => Promise.all(files
        .filter(name => name !== 'index.js' && name.endsWith('.js'))
        .map(file => import(`./${file}`))
    ))
    .then(modules => modules.forEach(module => {
        Object.entries(module).forEach(([operationId, handler]) => {
            if (operations[operationId]) logger.warn(`Duplicate handler for ${operationId}`);
            operations[operationId] = handler;
        });
    }));
export default operations;

// Get all the operations from the API spec.
export const allOperationIds = Object.values(apiSpec.paths)
    .map(path => Object.values(path))
    .flat()
    .map(operation => operation?.operationId)
    .filter(id => id);

// Make sure all operations have a registered handler.
allOperationIds.forEach(operationId => {
    if (!operations[operationId]) {
        logger.warn(`Operation ${operationId} is documented but does not exist`);
        operations[operationId] = () => { throw createError(401, `Operation ${operationId} not yet implemented`); };
    }
})

