import crypto from 'crypto'

const HEADER = 'X-Trace-Id'

export default function traceId(req, res, next) {
    // Let other middleware update the traceId, if needed.
    req.setTraceId = traceId => {
        if (!traceId) {
            traceId = crypto.randomBytes(4).toString('hex')
            req.generatedTraceId = true;
        }
        else req.generatedTraceId = false;
        req.traceId = traceId;
        res.set(HEADER, req.traceId);
    }

    // Get or generate a traceId.
    req.setTraceId(req.headers[HEADER] || req.query.trace);

    // Continue
    next();
}