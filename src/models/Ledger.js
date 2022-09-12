import createError from "http-errors";
import apiSpec from "../lib/api-spec.js";
import database from "../lib/database.js";
import { formatCost, round } from "../lib/helpers.js";

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
        const results = await database.view('ledger', 'items', query);
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
        const results = await database.view('ledger', 'items', query);
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