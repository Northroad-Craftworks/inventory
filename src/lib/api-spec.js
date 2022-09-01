import fs from 'fs/promises';
import YAML from 'yaml';

// Get the current app version.
const packageJson = await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8');
export const version = JSON.parse(packageJson).version;

// Load the API spec
export const apiSpecPath = new URL('../api-spec.yaml', import.meta.url);
export const apiSpecContent = await fs.readFile(apiSpecPath, 'utf8');
export const apiSpec = YAML.parse(apiSpecContent);
apiSpec.info.version = version;
export default apiSpec;
