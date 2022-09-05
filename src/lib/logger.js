import { inspect } from 'util';
import winston from 'winston';
const { createLogger, format, transports } = winston;

// Define a custom formatter, which makes winston behave more like console.log
const objectFormatter = {
    transform: (info) => {
        const args = [info.message, ...(info[Symbol.for('splat')] || [])];
        info.message = args.map(arg => {
            const inspectOpts = { compact: true, depth: Infinity, colors: true };
            if (typeof arg === 'object') {
                if (arg instanceof Error) return `\n  ${arg.stack}`;
                return inspect(arg, inspectOpts);
            }
            return arg;
        }).join(' ');
        return info;
    }
};

// Add colors for custom levels.
winston.addColors({ couch: 'yellow' });

// Create a console-based transport which can be silenced separately from the others.
export const consoleTransport = new transports.Console({
    format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message }) => {
            const timestampOpts = {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
            };
            return `${new Date(timestamp).toLocaleTimeString([], timestampOpts)} ${level}: ${message}`;
        })
    )
})

// Add extra formatting to the file-based transports.
const fileFormat = format.combine(
    format.uncolorize(),
    format.json()
);

// Create the logger.
export const logger = createLogger({
    level: process.env.LOG_LEVEL || 'http',
    levels: { ...winston.config.npm.levels, couch: 5 },
    format: format.combine(
        format.errors(),
        objectFormatter,
        format.timestamp()
    ),
    transports: [
        consoleTransport,
        new transports.File({ format: fileFormat, filename: 'logs/error.log', level: 'error' }),
        new transports.File({ format: fileFormat, filename: 'logs/all.log' }),
    ]
});
logger.debug(`Log level set to '${logger.level}'`);

export default logger;