import { expect } from './test-setup.js';
import * as apiSpec from '../src/api-spec.js';

describe('api-spec.js', function () {
    it('should export the spec as an object', function () {
        expect(apiSpec.default).to.be.an('object');
        expect(apiSpec.default).to.equal(apiSpec.apiSpec);
    });

    it('should export the version from package.json', function () {
        expect(apiSpec.version).to.equal('0.0.0-unreleased.0');
    });

    it('should update the spec with the correct version', function () {
        expect(apiSpec.apiSpec.info.version).to.equal(apiSpec.version);
    });
});