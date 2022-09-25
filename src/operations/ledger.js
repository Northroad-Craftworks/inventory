import Ledger from "../models/Ledger.js";

export async function getItemLedger(req, res){
    // Pre-validate the accepts header;
    const accepts = req.accepts(['json', 'text/csv', 'text/plain']);
    if (!accepts) throw createError(406);

    // Get the ledger
    const ledger = await Ledger.getItemLedger(req.params.itemId, req.query);

    // Return the results in the accepted format.
    if (accepts === 'json') res.json(ledger);
    else if (accepts === 'text/csv') res.type('text/csv').send(ledger.toCSV());
    else if (accepts === 'text/plain') res.type('text/plain').send(ledger.toString());
    else throw new Error('Impossible MIME type match');
}