import fs from 'fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';


// Get the current app version.
const packageJson = await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8');
export const version = JSON.parse(packageJson).version;

// Load the API spec
export const apiSpecPath = new URL('../api-spec.yaml', import.meta.url).toString();
export const apiSpec = await SwaggerParser.validate(apiSpecPath);
if (version !== '0.0.0-unreleased.0') apiSpec.info.version = version;
export default apiSpec;

// Find all operations
export const operationIds = Object.values(apiSpec.paths)
    .map(path => Object.values(path))
    .flat()
    .map(operation => operation?.operationId)
    .filter(id => id);