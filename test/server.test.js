import axios from 'axios';
import { expect, chance } from './test-setup.js';
import { localUrl } from '../src/server.js';

// Create axios defaults for API calls.
const callAPI = axios.create({
    method: 'GET',
    baseURL: localUrl,
    validateStatus: () => true
});

describe('server.js', function () {
    describe('status', function () {
        let response;
        before('call the API', async function () {
            response = await callAPI({ url: 'status' });
        });

        it('reports the server version', function () {
            expect(response.data).to.have.property('version', '0.0.0-unreleased.0');
        });

        it('does not expose framework details', function () {
            expect(response.headers).to.not.have.property('x-powered-by');
        });
    });

    describe('unhandled requests', function () {
        const randomEndpoint = chance.word();
        let response;
        before('call the API', async function () {
            response = await callAPI({ url: randomEndpoint });
        });

        it('throw a 404 error', function () {
            expect(response.status).to.equal(404);
        });

        it('do not expose framework details', function () {
            expect(response.headers).to.not.have.property('x-powered-by');
        });
    });
});