import createError from "http-errors";
import clone from "rfdc";
import pluralize from "pluralize";
import apiSpec from "../lib/api-spec.js";
import logger from "../lib/logger.js";
import Database, { DesignDoc } from "../lib/database.js";
import Ledger from "./Ledger.js";
import { round, getUnitCost } from "../lib/helpers.js";

export const ID_PREFIX = 'transaction/';

const database = new Database('inventory');
await database.initialize();

/**
 * Instantiate transaction subclasses from a document, based on the `type` field.
 * @param {object} document 
 * @returns {Purchase|Sale}
 */
function newFromDocument(document) {
    // TODO Fix this so it works with the new data model.
    switch (document.type) {
        case 'Purchase': return new Purchase(document);
        case 'Sale': return new Sale(document);
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
        return newFromDocument(document);
    }

    static async record(document, options) {
        // Validate document.
        if (!document?.id) throw new Error('Cannot record a transaction without an event id');
        if (!document.date) document.date = new Date().toISOString();

        // Validate the event.
        if (!document.event) throw new Error('Cannot record a transaction without an event');
        if (!(document.event instanceof TransactionEvent)) throw new Error('Events must extend TransactionEvent');
        await document.event.validate(400);

        // Create the transaction.
        const transaction = new this(document);

        // Calculate the quantity/cost adjustments.
        await transaction.recalculateAdjustments();

        // Save the transaction.
        if (options?.dryRun) {
            const exists = await database.get(transaction.document._id).catch(error => {
                if (error.statusCode === 404) return false;
                else throw error;
            });
            if (exists) throw createError(409, `(Dry run) Transaction '${transaction.id}' already exists`);
        }
        else await transaction.save().catch(error => {
            if (error.statusCode === 409) throw createError(409, `Transaction '${transaction.id}' already exists`);
            // TODO Enable idempotence by comparing against the saved document.
            else throw error;
        });
        return transaction;
    }

    constructor(document) {
        // Convert user-facing id field to document _id field.
        if (document.id) {
            document._id = ID_PREFIX + document.id;
            delete document.id;
        }

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
        return this.event.type;
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

    get adjustments() {
        return this.document.adjustments;
    }

    get event() {
        // TODO Coerce to an event instance, if not already one.
        return this.document.event;
    }

    get isSaved() {
        return Boolean(this.document._rev);
    }

    async recalculateAdjustments() {
        this.document.adjustments = await this.event.calculateAdjustments(this.date);
    }

    toJSON() {
        const properties = apiSpec.components.schemas.Transaction.properties;
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
        await database.insert(this.document);
    }
}

export class TransactionEvent {
    static async record() {
        throw new Error('Cannot record an abstract TransactionEvent');
    }

    constructor(data) {
        // Only allow subclasses to be instantiated.
        if (this.constructor === TransactionEvent) throw new Error('Cannot initialize an abstract TransactionEvent');
        Object.assign(this, data);
    }

    get type() {
        return this.constructor.name;
    }

    validate(status = 500, errors) {
        if (errors.length) {
            throw createError(status, [`${this.type} validation errors:`, ...errors].join('\n - '));
        }
    }

    async calculateAdjustments(date) {
        throw new Error(`${this.type} failed to implement calculateAdjustments`);
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
}

export class Purchase extends TransactionEvent {

    validate(status) {
        const errors = [];
        const itemIds = new Set();
        const { items } = this;
        if (!items?.length) errors.push('No items specified');
        else items.forEach((item, index) => {
            const { id, quantity, cost } = item;
            if (!id) errors.push(`Missing item ID at index ${index}`);
            else if (itemIds.has(id)) errors.push(`Duplicate item ID: ${id}`);
            else {
                itemIds.add(id);
                if (isNaN(quantity)) errors.push(`Item must have a quantity: ${id}`);
                else if (quantity <= 0) errors.push(`Item quantity must be positive: ${id}`);
                if (isNaN(cost)) errors.push(`Item must have a cost: ${id}`);
                else if (cost <= 0) errors.push('Item cost must be positive: ${id}');
            }
        });
        super.validate(status, errors);
    }

    async calculateAdjustments(date) {

        // TODO Implement cost adjustments.
        if (this.costAdjustments) throw createError(501, "Cost adjustments for purchases aren't yet implemented", { expose: true });

        // Determine the adjustments necessary for all items.
        return await Promise.all(this.items.map(async item => {
            const inventory = await Ledger.getInventoryValue({ itemId: item.id, endDate: date });
            if (inventory.pending) logger.warn(`Purchasing '${item.id}' with ${pluralize('pending transaction', inventory.pending, true)} in queue`);

            // Create the adjustment.
            const adjustment = {
                id: item.id,
                quantity: item.quantity
            };

            // Calculate the actual cost of the item.
            const actualItemCost = item.cost; // TODO Add cost adjustment.

            // Calculate cost delta.
            if (inventory.quantity >= 0) adjustment.cost = actualItemCost;
            else {
                // For negative existing inventory, we have to calculate how much this purchase was pre-consumed.
                const remainingQuantity = inventory.quantity + item.quantity;
                if (remainingQuantity <= 0) adjustment.cost = 0;
                else adjustment.cost = round(remainingQuantity * actualItemCost / item.quantity);
            }

            // Add the adjustment to the list.
            return adjustment;
        }));
    }
}

export class Sale extends TransactionEvent {
    validate(status) {
        const errors = [];
        const itemIds = new Set();
        const { items } = this;
        if (!items?.length) errors.push('No items specified');
        else items.forEach((item, index) => {
            const { id } = item;
            if (!id) errors.push(`Missing item ID at index ${index}`);
            else if (itemIds.has(id)) errors.push(`Duplicate item ID: ${id}`);
            else itemIds.add(id);
            // TODO Add more validation.
        });
        super.validate(status, errors);
    }


    async calculateAdjustments(date) {
        // Determine the adjustments necessary for all items.
        return await Promise.all(this.items.map(async item => {
            const inventory = await Ledger.getInventoryValue({ itemId: item.id, endDate: date });
            if (inventory.pending) logger.warn(`Selling '${item.id}' with ${pluralize('pending transaction', inventory.pending, true)} in queue`);

            // Create the adjustment.
            const adjustment = {
                id: item.id,
                quantity: item.quantity * -1
            };

            /* Calculate cost delta.
             * If there is more inventory available than is being sold, we need to calculate the unit cost.
             * Otherwise, we can set the total cost to zero by inverting it.*/
            adjustment.cost = inventory.quantity > item.quantity
                ? round(adjustment.quantity * getUnitCost(inventory.quantity, inventory.cost, false))
                : adjustment.cost = inventory.cost * -1;

            // Add the adjustment to the list.
            return adjustment;
        }));
    }
}

export class Manufacture extends TransactionEvent {
    validate(status) {
        const errors = [];
        const itemIds = new Set();
        const { materials } = this;
        if (!materials?.length) errors.push('No materials specified');
        else materials.forEach((item, index) => {
            const { id } = item;
            if (!id) errors.push(`Missing materials item ID at index ${index}`);
            else if (itemIds.has(id)) errors.push(`Duplicate materials item ID: ${id}`);
            else itemIds.add(id);
            // TODO Add more validation.
        });
        if (!this.product?.id) errors.push('Missing product ID');
        else if (itemIds.has(this.product.id)) errors.push('Cannot consume and produce the same item');
        if (this.product?.quantity <= 0) errors.push('Product quantity must be positive');
        super.validate(status, errors);
    }


    async calculateAdjustments(date) {

        // TODO Implement cost adjustments.
        if (this.additionalCosts) throw createError(501, "Additional costs for manufacturing isn't yet implemented", { expose: true });


        // Determine the adjustments necessary for all items.
        let totalCosts = 0;
        const adjustments = await Promise.all(this.materials.map(async item => {
            const inventory = await Ledger.getInventoryValue({ itemId: item.id, endDate: date });
            if (inventory.pending) logger.warn(`Purchasing '${item.id}' with ${pluralize('pending transaction', inventory.pending, true)} in queue`);

            // Don't allow consuming more inventory than is available.
            if (inventory.quantity < item.quantity) throw createError(400, `Insufficient inventory to consume ${item.quantity} x ${item.id}`);

            // Determine the value of the consumed items.
            const value = round(item.quantity * getUnitCost(inventory.quantity, inventory.cost, false));

            // Add it to the total material cost.
            totalCosts += value;

            // Create the adjustment.
            return {
                id: item.id,
                quantity: item.quantity * -1,
                cost: value * -1
            };
        }));

        // Add the product.
        adjustments.push({
            id: this.product.id,
            quantity: this.product.quantity,
            cost: totalCosts
        });

        // Return all adjustments.
        return adjustments;
    }
}

export class Count extends TransactionEvent {
    validate(status) {
        const errors = [];
        const itemIds = new Set();
        const { items } = this;
        if (!items?.length) errors.push('No items specified');
        else items.forEach((item, index) => {
            const { id } = item;
            if (!id) errors.push(`Missing item ID at index ${index}`);
            else if (itemIds.has(id)) errors.push(`Duplicate item ID: ${id}`);
            else itemIds.add(id);
            // TODO Add more validation.
        });
        super.validate(status, errors);
    }


    async calculateAdjustments(date) {
        // Determine the adjustments necessary for all items.
        return await Promise.all(this.items.map(async item => {
            const inventory = await Ledger.getInventoryValue({ itemId: item.id, endDate: date });
            if (inventory.pending) logger.warn(`Selling '${item.id}' with ${pluralize('pending transaction', inventory.pending, true)} in queue`);

            // Create the adjustment.
            const adjustment = {
                id: item.id,
                quantity: item.quantity - inventory.quantity
            };

            // If a target cost is supplied, enforce it. Otherwise, use the inventory unit-cost.
            if (item.cost) adjustment.cost = item.cost - inventory.cost;
            else {
                const inventoryUnitCost = getUnitCost(inventory.quantity, inventory.cost, false)
                adjustment.cost = round(adjustment.quantity * inventoryUnitCost);
            }

            // Never let total cost drop below zero.
            if (inventory.cost + adjustment.cost < 0) adjustment.cost = inventory.cost * -1;

            // Add the adjustment to the list.
            return adjustment;
        }));
    }
}

