import axios from 'axios';
import { expect, chance } from './test-setup.js';
import { localUrl } from '../src/app.js';

// Create axios defaults for API calls.
const api = axios.create({
    method: 'GET',
    baseURL: localUrl,
    validateStatus: () => true,
    json: true
});

describe('server.js', function () {
    describe('status', function () {
        let response;
        before('call the API', async function () {
            response = await api.get('status');
        });

        it('reports the server version', function () {
            expect(response.data).to.have.property('version', '0.0.0-unreleased.0');
        });

        it('does not expose framework details', function () {
            expect(response.headers).to.not.have.property('x-powered-by');
        });
    });

    describe('createItem', function () {
        it('should return an error', async function () {
            const body = {
                "name": chance.name
            }
            const response = await api.put('item/foo', body);
            expect(response.status).to.equal(400);
        });
    });

    describe('unhandled requests', function () {
        let response;
        before('call the API', async function () {
            response = await api.get(chance.word());
        });

        it('throw a 404 error', function () {
            expect(response.status).to.equal(404);
        });

        it('do not expose framework details', function () {
            expect(response.headers).to.not.have.property('x-powered-by');
        });
    });
});