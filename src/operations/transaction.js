import { Transaction, Purchase, Sale, Manufacture } from "../models/Transaction.js";


export async function getTransaction(req, res) {
    const transaction = await Transaction.get(req.params.transactionId);
    res.json(transaction);
}

export async function recordPurchase(req, res) {
    await recordTransaction(Purchase, req, res);
}

export async function recordSale(req, res) {
    await recordTransaction(Sale, req, res);
}

export async function recordManufacture(req, res) {
    await recordTransaction(Manufacture, req, res);
}

async function recordTransaction(Model, req, res) {
    // Parse the request.
    const { id, date, description, ...eventData } = req.body;

    // Create the event.
    const event = new Model(eventData);

    // Create the transaction.
    const document = {id, date, description, event};
    const options = {
        dryRun: req.query?.dryRun
    };
    const transaction = await Transaction.record(document, options);
    res.status(transaction.isSaved ? 201 : 200).json(transaction);
}