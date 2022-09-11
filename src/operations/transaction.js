import { Transaction, Purchase, Sale } from "../models/Transaction.js";

export async function getTransaction(req, res) {
    const transaction = await Transaction.get(req.params.transactionId);
    res.json(transaction);
}

export async function recordPurchase(req, res) {
    const transaction = await Purchase.record(req.body);
    res.status(201).json(transaction);
}

export async function recordSale(req, res) {
    const transaction = await Sale.record(req.body);
    res.status(201).json(transaction);
}