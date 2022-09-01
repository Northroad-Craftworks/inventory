import { version } from '../lib/api-spec.js';

export default (req, res) => {
    res.json({ version });
}