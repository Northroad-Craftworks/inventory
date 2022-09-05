import { expect } from './test-setup.js';
import * as apiSpec from '../src/lib/api-spec.js';

describe('item API', function () {
    it('should export the spec as an object', function () {
        expect(apiSpec.default).to.be.an('object');
        expect(apiSpec.default).to.equal(apiSpec.apiSpec);
    });
});