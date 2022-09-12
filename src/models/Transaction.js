import createError from "http-errors";
import clone from "rfdc";
import pluralize from "pluralize";
import apiSpec from "../lib/api-spec.js";
import logger from "../lib/logger.js";
import database from "../lib/database.js";
import Ledger from "./Ledger.js";
import { getUnitCost } from "../lib/helpers.js";

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

    static async record(properties, options) {
        const transaction = new this(properties);
        const { id } = transaction;
        if (options?.dryRun) {
            const exists = await database.get(ID_PREFIX + id).catch(error => {
                if (error.statusCode === 404) return false;
                else throw error;
            });
            if (exists) throw createError(409, `(Dry run) Transaction '${id}' already exists`);
        }
        else await transaction.save().catch(error => {
            if (error.statusCode === 409) throw createError(409, `Transaction '${id}' already exists`);
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

    get items() {
        return this.document.items?.map(item => {
            const { id, quantity, cost, inventoryQuantity, inventoryCost } = item;
            const unitCost = getUnitCost(quantity, cost);
            const inventoryUnitCost = getUnitCost(inventoryQuantity, inventoryCost);
            return { id, quantity, cost, unitCost, inventoryQuantity, inventoryCost, inventoryUnitCost };
        });
    }

    get isSaved() {
        return Boolean(this.document._rev);
    }

    toJSON() {
        const properties = apiSpec.components.schemas[this.type].properties;
        return Object
            .entries(properties)
            .reduce((acc, [field, options]) => {
                if (options.writeOnly) return acc;
                const value = this[field];
                acc[field] = value;
                if (value === undefined) logger.warn(`Missing value for ${field}`);
                return acc;
            }, {});
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
    static async record(properties, options) {
        // Update all the items with their inventory status.
        // TODO Can this be centralized?
        await Promise.all(properties.items.map(async item => {
            const ledger = await Ledger.getInventory(item.id);
            if (ledger.pending) logger.warn(`${pluralize('transaction', ledger.pending, true)} pending for ${item.id}`);

            // Validate inputs.
            if (item.quantity <= 0) throw createError(400, 'All item quantities must be positive');
            if (item.cost <= 0) throw createError(400, 'All item costs must be positive');

            // Calculate updated inventory quantity.
            item.inventoryQuantity = ledger.inventoryQuantity + item.quantity;
            if (item.inventoryQuantity <= 0) item.inventoryCost = 0;
            else if (ledger.inventoryQuantity >= 0) item.inventoryCost = ledger.inventoryCost + item.cost;
            else item.inventoryCost = item.inventoryQuantity * getUnitCost(item.quantity, item.cost, false);
        }));
        return super.record(properties, options);
    }

    constructor(document) {
        super(document);
    }

    get type() {
        return 'Purchase';
    }

    get costAdjustments() {
        return clone(this.document.costAdjustments);
    }
}

export class Sale extends Transaction {
    static async record(properties, options) {
        // Update all the items with their inventory status.
        // TODO Can this be centralized?
        await Promise.all(properties.items.map(async item => {
            const ledger = await Ledger.getInventory(item.id);
            const { pending, inventoryQuantity, inventoryCost, inventoryUnitCost } = ledger;
            if (pending) logger.warn(`Selling '${item.id}' with ${pluralize('transaction', pending, true)} in queue`);

            // Validate inputs.
            const { quantity, cost } = item;
            if (quantity <= 0) throw createError(400, 'All item quantities must be positive');
            if (cost !== undefined) throw createError(400, 'Cannot specify costs for sale transactions');

            // Calculate cost and inventory.
            item.cost = Math.round(quantity * inventoryUnitCost * 100) / 100;
            item.inventoryQuantity = inventoryQuantity - quantity;
            item.inventoryCost = inventoryCost - item.cost;
            if (item.inventoryCost < 0) item.inventoryCost = 0;

            // Calculate cogs.
            item.cogs = item.cost;
        }));
        return super.record(properties, options);
    }

    constructor(document) {
        super(document);
    }

    get type() {
        return 'Sale';
    }

}

export class Manufacture extends Transaction {
    constructor(document) {
        super(document);
    }

    get type() {
        return 'Manufacture';
    }

    get items() {
        // TODO Return a combination of materials and product.
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

