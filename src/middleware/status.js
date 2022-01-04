import { version } from '../utilities/api-spec.js';

export default (req, res) => {
    res.json({ version });
}