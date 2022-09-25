import createError from "http-errors";
import apiSpec from "../lib/api-spec.js";
import * as database from "../lib/database.js";
import { formatCost } from "../lib/helpers.js";

export const ID_PREFIX = 'item/';

const itemIndex = new database.DesignDoc('item-index:v1', {
    language: 'query',
    views: {
        all: {
            map: {
                fields: { _id: 'asc' },
                partial_filter_selector: { _id: { '$regex': '^item/' } }
            },
            options: {
                def: { fields: ['_id'] }
            }
        }
    }
});

export default class Item {

    static async get(id) {
        // TODO Get inventory as well.
        const document = await database.get(ID_PREFIX + id).catch(error => {
            if (error.statusCode === 404) throw createError(404, `Item ${id} does not exist`);
            else throw error;
        });
        return new Item(document);
    }

    static async list(options) {
        // TODO Use a view to get everything, with the appropriate metadata and inventory.
        const query = {
            limit: 50,
            selector: options?.filter || {},
            use_index: `${itemIndex.name}/all`
        }

        // Get the first set of items.
        let results = await database.find(query);
        const items = results.docs.map(doc => new Item(doc));

        // Keep getting pages until there are no more pages.
        while (results.getNextPage){
            results = await results.getNextPage();
            items.push(...results.docs.map(doc => new Item(doc)));
        }

        // Return
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
            await destroyDocument(_id, _rev);
        }
    }

    toString() {
        const label = `${this.name || this.id}:`;
        if (!this.quantity) return `${label} Out of Stock`;
        const totalCost = formatCost(this.totalCost);
        const unitCosts = formatCost(this.unitCost);
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