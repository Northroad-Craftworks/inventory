import axios from 'axios';
import { expect } from './test-setup.js';
import { localUrl } from '../src/server.js';

describe('server.js', function () {
    describe('GET /status', function () {
        let response;
        before('call the API', async function () {
            response = await axios.get(`${localUrl}/status`);
        });

        it('reports the server version', function () {
            expect(response.data).to.have.property('version', '0.0.0-unreleased.0');
        });

        it('does not expose framework details', function () {
            expect(response.headers).to.not.have.property('x-powered-by');
        });
    });
});