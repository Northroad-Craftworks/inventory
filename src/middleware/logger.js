import morgan from 'morgan';
import logger from '../lib/logger.js';

export default morgan('dev', {
    stream: {
        write: message => logger.http(message?.trim?.())
    }
});