import * as database from "../lib/database.js";
import { formatCost } from "../lib/helpers.js";

const csvLedgerFields = [
    { label: 'Date', property: 'date' },
    { label: 'Transaction', property: 'transaction' },
    { label: 'Qty', property: 'quantity' },
    { label: 'Cost', property: 'cost', isCost: true },
    { label: 'Unit Cost', property: 'unitCost', isCost: true },
    { label: 'Total Qty', property: 'inventoryQuantity' },
    { label: 'Total Cost', property: 'inventoryCost', isCost: true },
    { label: 'Total Unit Cost', property: 'inventoryUnitCost', isCost: true },
    { label: 'Audited', property: 'audited' }
];

const designDoc = new database.DesignDoc('ledger:v1', {
    views: {
        items: {
            map: function (doc) {
                const PREFIX = 'transaction/';
                if (!doc._id.startsWith(PREFIX)) return;
                const { _id, audited, type, date, items, materials } = doc;

                // Invert transaction costs for sales and consumed materials.
                const multiplier = (type === 'Sale' || type === 'Manufacture') ? -1 : 1;

                for (const item of items) {
                    const { quantity, cost, inventoryQuantity, inventoryCost } = item;
                    emit([item.id, date], {
                        date,
                        transaction: _id.substring(PREFIX.length),
                        type,
                        quantity: quantity * multiplier,
                        cost: cost * multiplier,
                        unitCost: quantity && (cost / quantity),
                        inventoryQuantity,
                        inventoryCost,
                        inventoryUnitCost: inventoryQuantity && (inventoryCost / inventoryQuantity),
                        audited
                    });
                }
            },
            reduce: function (keys, values, rereduce) {
                const latest = values.reduce((a, b) => a.date.localeCompare(b.date) > 0 ? a : b);
                const pending = sum(values.map(value => {
                    if (rereduce) return value.pending;
                    return value.audited ? 0 : 1;
                }));
                if (rereduce) {
                    latest.pending = pending;
                    return latest;
                }
                else {
                    const pending = values.reduce((count, value) => count += value.audited ? 0 : 1, 0);
                    const { id, date, audited } = latest;
                    const { inventoryQuantity, inventoryCost, inventoryUnitCost } = latest;
                    return { date, inventoryQuantity, inventoryCost, inventoryUnitCost, pending };
                }
            }
        },
        purchase_costs: {
            map: function (doc) {
                if (!doc._id.startsWith('transaction/')) return;
                if (doc.type === 'Purchase') {
                    for (const item of doc.items) emit(doc.date, item.cost);
                }
                // TODO Handle personal use
            },
            reduce: '_sum'
        }
    }
});

export default class Ledger {
    static async getInventory(item, date) {
        item = item?.id || item || '_total';
        if (date instanceof Date) date = date.toISOString();
        else if (!date) date = {};
        const query = {
            reduce: true,
            group_level: 1,
            start_key: [item],
            end_key: [item, date]
        };
        const results = await database.view(designDoc, 'items', query);
        if (results?.rows?.length > 1) throw new Error('Too many rows returned by ledger view');
        const value = results?.rows[0]?.value;
        if (!value) throw new Error(`Invalid results from inventoryValue view`);
        return value;
    }

    static async getItemLedger(itemId, options) {
        if (!itemId) throw new Error('An item ID is required to get an item ledger');
        const filter = {
            itemId,
            startDate: options?.startDate || null,
            endDate: options?.endDate || new Date().toISOString()
        };
        const query = {
            reduce: false,
            start_key: [itemId, filter.startDate],
            end_key: [itemId, filter.endDate]
        };
        const results = await database.view(designDoc, 'items', query);
        return new Ledger(filter, results.rows.map(row => row.value));
    }

    constructor(filter, entries) {
        Object.assign(this, filter);
        this.entries = entries.map(entry => {
            if (entry instanceof LedgerEntry) return entry;
            return new LedgerEntry(entry);
        });
    }

    get fileHeader() {
        return `Item: ${this.itemId}\nDates: ${this.startDate || 'Beginning'} - ${this.endDate}\n`;
    }

    toCSV() {
        return [
            this.fileHeader,
            csvLedgerFields.map(field => field.label).join(','),
            ...this.entries.map(entry => entry.toCSV())
        ].join('\n');
    }

    toString() {
        return `${this.fileHeader}${['Entries:', ...this.entries.map(entry => entry.toString())].join('\n- ')}`;
    }
}

export class LedgerEntry {

    constructor(data) {
        // TODO Properly define the data structure.
        Object.assign(this, data);
    }

    toCSV() {
        return csvLedgerFields
            .map(({ property, isCost }) => isCost ? formatCost(this[property]) : this[property])
            .map(value => value?.toString().replaceAll(',', '') || '')
            .join(',');
    }

    toString() {
        return [
            this.date,
            this.type,
            `${this.quantity} @ ${formatCost(this.unitCost)} (${formatCost(this.cost)})`,
            `Total: ${this.inventoryQuantity} @ ${formatCost(this.inventoryUnitCost)} (${formatCost(this.inventoryCost)})`
        ].join(' ');
    }
}