import morgan from 'morgan';
import chalk from 'chalk';
import logger from '../lib/logger.js';

function format(tokens, req, res) {
    let status = tokens.status(req, res);
    if (!status) status = chalk.red("canceled");
    else if (status.startsWith('3')) status = chalk.cyan(status);
    else if (status.startsWith('4')) status = chalk.yellow(status);
    else if (status.startsWith('5')) status = chalk.red(status);
    else status = chalk.green(status);

    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const responseTime = tokens['response-time'](req, res);
    const contentLength = tokens.res(req, res, 'content-length');

    return `${method} ${url} ${status} - ${responseTime || 'unknown '}ms - ${contentLength || 0} bytes`;
}

const options = {
    skip: (req, res) => {
        return Boolean(req.skipLog);
    },
    stream: {
        write: message => logger.http(message?.trim?.())
    }
};

export default morgan(format, options);