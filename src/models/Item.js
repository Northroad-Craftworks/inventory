import createError from "http-errors";
import apiSpec from "../lib/api-spec.js";
import database from "../lib/database.js";
import logger from '../lib/logger.js';

export const ID_PREFIX = 'item/';

const costFormatter = new Intl.NumberFormat('en-us', { style: 'currency', currency: 'usd' });

export default class Item {

    static async get(id) {
        const document = await database.get(ID_PREFIX + id).catch(error => {
            if (error.statusCode === 404) throw createError(404, `Item ${id} does not exist`);
            else throw error;
        });
        return new Item(document);
    }
    
    static async list() {
        // TODO Do this with a view instead.
        const results = await database.list({ include_docs: true });
        const items = results.rows
            .filter(row => row.id.startsWith(ID_PREFIX))
            .map(row => new Item(row.doc));
        return items;
    }

    static async create(id, properties) {
        const item = new Item({ _id: ID_PREFIX + id, ...properties });
        await item.save().catch(error => {
            if (error.statusCode === 409) throw createError(409, `Item ${id} already exists`);
            else throw error;
        });
        return item;
    }


    constructor(document) {
        this.document = document;
        if (!this.id) throw new Error('Invalid document ID for an item');
    }

    get id() {
        const documentId = this.document._id;
        const match = documentId.match(`^${ID_PREFIX}(?<id>.+)$`);
        return match?.groups?.id;
    }

    get name() {
        return this.document.name || this.id;
    }

    get account() {
        return this.document.account || 'Raw Materials';
    }

    get unit() {
        return this.document.unit || 'each';
    }

    get quantity() {
        return this.document.quantity || 0;
    }

    get totalCost() {
        return this.document.totalCost || 0;
    }

    get unitCost() {
        return this.quantity ? Math.round(100 * this.totalCost / this.quantity) / 100 : 0;
    }

    get hidden() {
        return this.document.hidden || false;
    }

    patch(updates) {
        Object.assign(this.document, updates);
    }

    async save() {
        const { rev } = await database.insert(this.document);
        this.document._rev = rev;
    }

    async destroy() {
        const { _id, _rev } = this.document;
        if (_rev) {
            delete this.document._rev;
            await database.destroy(_id, _rev);
        }
    }


    toString() {
        const label = `${this.name || this.id}:`;
        if (!this.quantity) return `${label} Out of Stock`;
        const totalCost = costFormatter.format(this.totalCost);
        const unitCosts = costFormatter.format(this.unitCost);
        return `${label} ${this.quantity} x ${unitCosts}/${this.unit} = ${totalCost}`;
    }

    toJSON() {
        return Object
            .entries(apiSpec.components.schemas.Item.properties)
            .reduce((acc, [field, options]) => {
                if (options.writeOnly) return acc;
                acc[field] = this[field];
                return acc;
            }, {});
    }
}