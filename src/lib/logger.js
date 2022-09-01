import winston from 'winston';

const { createLogger, format, transports } = winston;

export const consoleTransport = new transports.Console({
    format: format.combine(
        format.errors({ stack: true }),
        format.colorize(),
        format.cli(),
        format.printf(({ timestamp, level, message }) => {
            const timestampOpts = { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }
            return `${new Date(timestamp).toLocaleTimeString([], timestampOpts)} ${level}: ${message}`
        })
    )
});

export const logger = createLogger({
    level: process.env.LOG_LEVEL || 'http',
    format: format.combine(
        format.errors({ stack: false }),
        format.uncolorize(),
        format.timestamp(),
        format.json()
    ),
    transports: [
        consoleTransport,
        new transports.File({ filename: 'logs/error.log', level: 'error' }),
        new transports.File({ filename: 'logs/all.log' })
    ]
});
logger.debug(`Log level set to '${logger.level}'`);

export default logger;