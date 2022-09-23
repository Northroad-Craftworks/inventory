import createError from "http-errors";
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
        values: {
            map: function (doc) {
                // Emit accounts
                const ITEM_PREFIX = 'item/';
                if (doc._id.startsWith(ITEM_PREFIX)) {
                    const { name, account, unit } = doc;
                    const id = doc._id.substring(ITEM_PREFIX.length);
                    const metadata = { name, account, unit }
                    emit([id, '_metadata'], { metadata });
                    emit(['_total', '_metadata'], {
                        items: {
                            [id]: {metadata}
                        }
                    })
                    return;
                }

                // Emit transactions.
                if (doc._id.startsWith('transaction/')) {
                    const { audited, date, items, materials } = doc;
                    for (const item of items) {
                        const value = {
                            inventoryQuantity: item.quantityDelta,
                            inventoryCost: item.costDelta,
                            pending: audited ? 0 : 1
                        };
                        emit([item.id, date], value);
                        emit(['_total', date], {
                            total: value,
                            items: {
                                [item.id]: value
                            }
                        })
                    }
                }
            },
            reduce: '_sum'
        }
        // items: {
        //     map: function (doc) {
        //         // Emit accounts
        //         const ITEM_PREFIX = 'item/';
        //         if (doc._id.startsWith(ITEM_PREFIX)) {
        //             const { name, account, unit } = doc;
        //             const id = doc._id.substring(ITEM_PREFIX.length);
        //             emit([id, '_metadata'], { name, account, unit });
        //             return;
        //         }

        //         // Emit transactions.
        //         const TRANSACTION_PREFIX = 'transaction/';
        //         if (doc._id.startsWith(TRANSACTION_PREFIX)) {
        //             const { _id, audited, type, date, items, materials } = doc;

        //             // Invert transaction costs for sales and consumed materials.
        //             const multiplier = (type === 'Sale' || type === 'Manufacture') ? -1 : 1;

        //             for (const item of items) {
        //                 const { quantity, cost, inventoryQuantity, inventoryCost } = item;
        //                 emit([item.id, date], {
        //                     date,
        //                     transaction: _id.substring(TRANSACTION_PREFIX.length),
        //                     type,
        //                     quantity: quantity * multiplier,
        //                     cost: cost * multiplier,
        //                     unitCost: quantity && (cost / quantity),
        //                     inventoryQuantity,
        //                     inventoryCost,
        //                     inventoryUnitCost: inventoryQuantity && (inventoryCost / inventoryQuantity),
        //                     audited
        //                 });
        //             }
        //         }
        //     },
        //     reduce: function (keys, values, rereduce) {
        //         const latest = values.reduce((a, b) => a.date.localeCompare(b.date) > 0 ? a : b);
        //         const pending = sum(values.map(value => {
        //             if (rereduce) return value.pending;
        //             return value.audited ? 0 : 1;
        //         }));
        //         if (rereduce) {
        //             latest.pending = pending;
        //             return latest;
        //         }
        //         else {
        //             const pending = values.reduce((count, value) => count += value.audited ? 0 : 1, 0);
        //             const { id, date, audited } = latest;
        //             const { inventoryQuantity, inventoryCost, inventoryUnitCost } = latest;
        //             return { date, inventoryQuantity, inventoryCost, inventoryUnitCost, pending };
        //         }
        //     }
        // },
        // cogs: {
        //     map: function (doc) {
        //         if (!doc._id.startsWith('transaction/')) return;
        //         if (doc.type === 'Purchase') {
        //             for (const item of doc.items) emit(doc.date, { purchases: item.cost });
        //         }
        //         // TODO Handle personal use
        //         // TODO Handle labor
        //     },
        //     reduce: '_sum'
        // },
        // inventory_value: {
        //     map: function (doc) {
        //         const PREFIX = 'transaction/';
        //         if (!doc._id.startsWith(PREFIX)) return;
        //         const { audited, date, items } = doc;

        //         for (const item of items) {
        //             const { id, inventoryQuantity, inventoryCost } = item;
        //             const value = {
        //                 items: {
        //                     [id]: { date, inventoryQuantity, inventoryCost }
        //                 },
        //                 inventoryCost,
        //                 pending: audited ? 1 : 0
        //             };
        //             emit([id, date], value);
        //             emit(['_total', date], value);
        //         }
        //     },
        //     reduce: function (keys, values, rereduce) {
        //         const reduction = values.reduce((acc, value) => {
        //             Object.entries(value.items).forEach(([id, item]) => {
        //                 const accItem = acc.items[id];
        //                 if (!accItem || accItem.date < item.date) acc.items[id] = item;
        //             });
        //             acc.pending += value.pending;
        //             return acc;
        //         });
        //         if (rereduce) reduction.inventoryCost = sum(Object.values(reduction.items).map(item => item.inventoryCost));
        //         return reduction;
        //     }
        // }
    }
});

export default class Ledger {
    // static async getInventory(item, date) {
    //     // TODO Refactor this to use options.
    //     item = item?.id || item || '_total';
    //     if (date instanceof Date) date = date.toISOString();
    //     else if (!date) date = {};
    //     const query = {
    //         reduce: true,
    //         group_level: 1,
    //         start_key: [item],
    //         end_key: [item, date]
    //     };
    //     const results = await database.view(designDoc, 'items', query);
    //     if (results?.rows?.length > 1) throw new Error('Too many rows returned by ledger view');
    //     const value = results?.rows[0]?.value;
    //     if (!value) throw new Error(`Invalid results from inventoryValue view`);
    //     return value;
    // }

    // static async getItemLedger(itemId, options) {
    //     if (!itemId) throw new Error('An item ID is required to get an item ledger');
    //     const filter = {
    //         itemId,
    //         startDate: options?.startDate || null,
    //         endDate: options?.endDate || new Date().toISOString()
    //     };
    //     const query = {
    //         reduce: false,
    //         start_key: [itemId, filter.startDate],
    //         end_key: [itemId, filter.endDate]
    //     };
    //     const results = await database.view(designDoc, 'items', query);
    //     return new Ledger(filter, results.rows.map(row => row.value));
    // }

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
        if (options?.account){
            // TODO Filter the results by account.
            throw createError(501, "Cannot yet calculate inventory cost for an account.");
        }
        else {
            // TODO Parse this result into another object.
            return result.rows[0].value;
        }
    }

    // constructor(filter, entries) {
    //     Object.assign(this, filter);
    //     this.entries = entries.map(entry => {
    //         if (entry instanceof LedgerEntry) return entry;
    //         return new LedgerEntry(entry);
    //     });
    // }

    // get fileHeader() {
    //     return `Item: ${this.itemId}\nDates: ${this.startDate || 'Beginning'} - ${this.endDate}\n`;
    // }

    // toCSV() {
    //     return [
    //         this.fileHeader,
    //         csvLedgerFields.map(field => field.label).join(','),
    //         ...this.entries.map(entry => entry.toCSV())
    //     ].join('\n');
    // }

    // toString() {
    //     return `${this.fileHeader}${['Entries:', ...this.entries.map(entry => entry.toString())].join('\n- ')}`;
    // }
}

// export class LedgerEntry {

//     constructor(data) {
//         // TODO Properly define the data structure.
//         Object.assign(this, data);
//     }

//     toCSV() {
//         return csvLedgerFields
//             .map(({ property, isCost }) => isCost ? formatCost(this[property]) : this[property])
//             .map(value => value?.toString().replaceAll(',', '') || '')
//             .join(',');
//     }

//     toString() {
//         // TODO Fix this to match updated ledger properties
//         return [
//             this.date,
//             this.type,
//             `${this.quantity} @ ${formatCost(this.unitCost)} (${formatCost(this.cost)})`,
//             `Total: ${this.inventoryQuantity} @ ${formatCost(this.inventoryUnitCost)} (${formatCost(this.inventoryCost)})`
//         ].join(' ');
//     }
// }