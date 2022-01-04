import winston from 'winston';

const { createLogger, format, transports } = winston;

export const consoleTransport = new transports.Console({
    format: format.combine(
        format.errors({ stack: true }),
        format.colorize(),
        format.simple()
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

export default logger;