import createError from "http-errors";
import clone from "rfdc";
import database from "../lib/database.js";
import Ledger from "./Ledger.js";

export const ID_PREFIX = 'transaction/';

function getImplementor(type) {
    switch (type) {
        case 'Purchase': return Purchase;
        // TODO Add other classes
        default: throw new Error(`No class available to represent a ${type} transaction`);
    }
}

export class Transaction {

    static async get(id) {
        const document = await database.get(ID_PREFIX + id).catch(error => {
            if (error.statusCode === 404) throw createError(404, `Transaction ${id} does not exist`);
            else throw error;
        });
        const SubClass = getImplementor(document.type);
        return new SubClass(document);
    }

    static async record(properties) {
        const transaction = new this(properties);
        await transaction.save().catch(error => {
            if (error.statusCode === 409) throw createError(409, `Transaction ${id} already exists`);
            else throw error;
        });
        return transaction;
    }

    constructor(document) {
        // Only allow subclasses to be instantiated.
        if (this.constructor === Transaction) throw new Error('Cannot initialize an abstract Transaction');

        // Convert user-facing id field to document _id field.
        if (document.id) {
            document._id = ID_PREFIX + document.id;
            delete document.id;
        }

        // Assert a date.
        if (!document.date) document.date = new Date().toISOString();

        // Store the document.
        this.document = document;
    }

    get date() {
        return new Date(this.document.date);
    }

    get id() {
        const documentId = this.document._id;
        const match = documentId.match(`^${ID_PREFIX}(?<id>.+)$`);
        return match?.groups?.id;
    }

    get type() {
        throw new Error('Abstract transactions must not exist');
    }

    get description() {
        return this.document.description ?? '-none-';
    }

    get user() {
        return this.document.user || '-unknown-';
    }

    get audited() {
        return Boolean(this.document.audited);
    }

    async save() {
        const document = {
            type: this.type,
            ...this.document
        };
        const { rev } = await database.insert(document);
        this.document._rev = rev;
    }
}

export class Purchase extends Transaction {

    constructor(document) {
        super(document);
    }

    get type() {
        return 'Purchase';
    }

    get items() {
        return clone(this.document.items);
    }

    get costAdjustments() {
        return clone(this.document.costAdjustments);
    }
}

export class Sale extends Transaction {
    static async record(properties) {
        // Update all the items with their current unit cost.
        await Promise.all(properties.items.map(async saleItem => {
            // Get the current unit cost of the item in inventory.
            const { quantity, unitCost } = await Ledger.getInventoryValue(saleItem.id);

            // Don't allow over-selling.
            if (quantity < saleItem.quantity) {
                /* Note: This is NOT guaranteed to result in non-negative inventory.
                 * If inventory quantity is inaccurate due to latency, a transaction may be allowed
                 * which will result in negative inventory once corrected by auditing. */
                throw new Error(`Insufficient quantity to sell ${saleItem.id} (${quantity}/${saleItem.quantity})`);
            }
            saleItem.cost = Math.round(saleItem.quantity * unitCost * 100) / 100;
        }));
        return super.record(properties);
    }

    constructor(document) {
        super(document);
    }

    get type() {
        return 'Sale';
    }

    get items() {
        return clone(this.document.items);
    }
}

export class Manufacture extends Transaction {
    constructor(document) {
        super(document);
    }

    get type() {
        return 'Manufacture';
    }

    get materials() {
        return clone(this.document.materials);
    }

    get additionalCosts() {
        return clone(this.document.costAdjustments);
    }

    get productId() {
        return this.document.productId;
    }

    get productQuantity() {
        return this.document.productQuantity;
    }

}

