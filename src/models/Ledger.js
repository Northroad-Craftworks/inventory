import createError from "http-errors";
import pluralize from "pluralize";
import * as database from "../lib/database.js";
import { formatCost, getUnitCost } from "../lib/helpers.js";

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
        values: {
            map: function (doc) {
                // Emit accounts
                const ITEM_PREFIX = 'item/';
                if (doc._id.startsWith(ITEM_PREFIX)) {
                    const { name, account, unit } = doc;
                    const id = doc._id.substring(ITEM_PREFIX.length);
                    const metadata = { name, account, unit };
                    emit([id, '_metadata'], { metadata });
                    emit(['_total', '_metadata'], {
                        items: {
                            [id]: { metadata }
                        }
                    });
                    return;
                }

                // Emit transactions.
                if (doc._id.startsWith('transaction/')) {
                    const { audited, date, adjustments } = doc;
                    for (const adjustment of adjustments) {
                        const { id, quantity, cost } = adjustment;
                        const value = { quantity, cost, pending: audited ? 0 : 1 };
                        emit([id, date], value);
                        emit(['_total', date], {
                            total: value,
                            items: {
                                [id]: value
                            }
                        });
                    }
                }
            },
            reduce: '_sum'
        }
    }
});

export default class Ledger {
    static async getInventoryValue(options) {
        if (options?.itemId && options?.account) throw new Error('Cannot specify both item and account');
        const itemId = options?.itemId || '_total';
        if (!itemId || typeof itemId !== 'string') throw new Error('Missing or invalid itemId');
        const startDate = options?.startDate ? new Date(options.startDate).toISOString() : null;
        const endDate = options?.endDate ? new Date(options.endDate).toISOString() : {};
        const query = {
            reduce: true,
            group_level: 1,
            start_key: [itemId, startDate],
            end_key: [itemId, endDate || {}]
        };
        const result = await database.view(designDoc, 'values', query);
        if (!result?.rows?.[0]?.value) throw createError(404, `No results for ${itemId}`);
        if (options?.account) {
            // TODO Filter the results by account.
            throw createError(501, "Cannot yet calculate inventory cost for an account.");
        }
        else {
            // TODO Check to ensure metadata was included.
            return { quantity: 0, cost: 0, ...result.rows[0].value };
        }
    }

    static async getItemLedger(itemId, options) {
        if (!itemId) throw new Error('An item ID is required to get an item ledger');

        // Construct metadata about the ledger.
        const ledgerData = {
            startDate: options?.startDate || null,
            endDate: options?.endDate || new Date().toISOString(),
            item: {
                id: itemId
            }
        };

        // Query the view
        const query = {
            reduce: false,
            start_key: [itemId, ledgerData.startDate],
            end_key: [itemId, ledgerData.endDate]
        };
        // TODO Use a different view, as this one mis-reports costs after negative inventory.
        const results = await database.view(designDoc, 'values', query);

        // Parse the results.
        if (!results.rows?.length) throw createError(404, `No ledger found for ${itemId}`);
        const [firstRow, ...remainingRows] = results.rows;
        const firstRowMetadata = firstRow?.key[2] !== '_metadata';
        if (firstRowMetadata) Object.assign(ledgerData.item, firstRow.value.metadata);
        else {
            const metadataQuery = { reduce: false, key: [itemId, '_metadata'] };
            const metadataResults = await database.view(designDoc, 'values', metadataQuery);
            const metadataValue = metadataResults?.rows?.[0]?.value?.metadata;
            if (!metadataValue) throw new Error(`Unable to find metadata for ${itemId}`);
            Object.assign(ledgerData.item, metadataValue);
        }
        const entryRows = firstRowMetadata ? remainingRows : results.rows;
        ledgerData.entries = entryRows.map(row => row.value);
        return new Ledger(ledgerData);
    }

    constructor(data) {
        const { entries, ...rest } = data;
        Object.assign(this, rest);

        // Build the entries.
        let lastEntry;
        this.entries = entries.map(entry => {
            if (entry instanceof LedgerEntry) throw new Error('Cannot re-use LedgerEntries');
            const newEntry = new LedgerEntry(this, entry);
            if (lastEntry) newEntry.setTotals(lastEntry);
            lastEntry = newEntry;
            return newEntry;
        });
    }

    get fileHeader() {
        return [
            `Item: ${this.item.name} (${this.item.id})`,
            `Dates: ${this.startDate || 'Beginning'} - ${this.endDate}`,
            `Account: ${this.item.account}`,
            `Quantity Unit: ${this.item.unit}`,
            ''
        ].join('\n');
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

    constructor(parent, data) {
        this.parent = parent;
        this.totalQuantity = data.quantity;
        this.totalCost = data.cost;
        Object.assign(this, data);
    }

    get unitCost() {
        return getUnitCost(this.quantity, this.cost);
    }

    get totalUnitCost() {
        return getUnitCost(this.totalQuantity, this.totalCost);
    }

    setTotals(previousEntry) {
        this.totalQuantity = previousEntry.totalQuantity + this.quantity;
        this.totalCost = previousEntry.totalCost + this.cost;
    }

    toCSV() {
        return csvLedgerFields
            .map(({ property, isCost }) => isCost ? formatCost(this[property]) : this[property])
            .map(value => value?.toString().replaceAll(',', '') || '')
            .join(',');
    }

    toString() {
        // TODO Fix this to match updated ledger properties
        const unit = this.parent.item?.unit || 'unit';
        const quantity = pluralize(unit, this.quantity, true);
        const totalQuantity = pluralize(unit, this.totalQuantity, true);
        return [
            this.date,
            this.type,
            `${quantity} @ ${formatCost(this.unitCost)} (${formatCost(this.cost)})`,
            `Total: ${totalQuantity} @ ${formatCost(this.totalUnitCost)} (${formatCost(this.totalCost)})`
        ].join(' ');
    }

    toJSON() {
        const { parent, ...rest } = this;
        return rest;
    }
}