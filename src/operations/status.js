import { version } from '../lib/api-spec.js';

export function getStatus(req, res) {
    req.skipLog = true;
    res.json({ version });
}