import morgan from 'morgan';
import chalk from 'chalk';
import logger from '../lib/logger.js';

morgan.token('user', req => {
    const user = req.user || req.initialUser;
    if (user) {
        const { id, email, provider } = user;
        const userId = email || id || 'Unknown';
        if (provider === 'Anonymous') return chalk.green(userId);
        else return chalk.cyan(userId);
    }
    return chalk.red('Unauthenticated');
});

morgan.token('trace', req => {
    const { traceId, generatedTraceId } = req;
    if (!traceId) return chalk.red('no-trace');
    if (generatedTraceId) return chalk.yellow(traceId);
    return chalk.blue(traceId);
    
});

function format(tokens, req, res) {
    let status = tokens.status(req, res);
    if (!status) status = chalk.red("canceled");
    else if (status.startsWith('3')) status = chalk.cyan(status);
    else if (status.startsWith('4')) status = chalk.yellow(status);
    else if (status.startsWith('5')) status = chalk.red(status);
    else status = chalk.green(status);

    const trace = tokens.trace(req);
    const user = tokens.user(req);
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const responseTime = tokens['response-time'](req, res);
    const contentLength = tokens.res(req, res, 'content-length');

    return `${trace} ${user} ${method} ${url} - ${status} - ${responseTime || 'unknown '}ms - ${contentLength || 0} bytes`;
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