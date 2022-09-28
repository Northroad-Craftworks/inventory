import { version } from '../lib/api-spec.js';

const { HOSTNAME } = process.env

export function getStatus(req, res) {
    req.skipLog = true;
    res.json({
        version,
        hostname: process.env.HOSTNAME || 'local'
    });
}