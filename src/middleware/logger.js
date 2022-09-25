import morgan from 'morgan';
import chalk from 'chalk';
import logger from '../lib/logger.js';

morgan.token('user', req => {
    if (req.user) {
        const { id, email, provider } = req.user;
        const userId = email || id || 'Unknown';
        if (provider === 'Anonymous') return chalk.green(userId);
        else return chalk.cyan(userId);
    }
    return chalk.red('Unauthenticated');
});

function format(tokens, req, res) {
    let status = tokens.status(req, res);
    if (!status) status = chalk.red("canceled");
    else if (status.startsWith('3')) status = chalk.cyan(status);
    else if (status.startsWith('4')) status = chalk.yellow(status);
    else if (status.startsWith('5')) status = chalk.red(status);
    else status = chalk.green(status);

    const user = tokens.user(req, res);
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const responseTime = tokens['response-time'](req, res);
    const contentLength = tokens.res(req, res, 'content-length');

    return `${user} ${method} ${url} - ${status} - ${responseTime || 'unknown '}ms - ${contentLength || 0} bytes`;
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

export function disableLog(req, res, next) {
    req.skipLog = true;
    next();
}

export function enableLog(req, res, next) {
    req.skipLog = false;
    next();
}