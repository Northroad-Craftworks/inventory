import createError from "http-errors";
import database from "../lib/database.js";
import logger from "../lib/logger.js";

export default class Ledger {
    static async getInventoryValue(item, date) {
        item = item?.id || item || '_total';
        if (date instanceof Date) date = date.toISOString();
        else if (!date) date = {};
        const query = {
            group_level: 1,
            start_key: [item],
            end_key: [item, date]
        };
        const results = await database.view('transactions', 'ledger', query);
        if (results?.rows?.length > 1) throw new Error('Too many rows returned by ledger view');
        if (JSON.stringify(results.rows[0].key) !== JSON.stringify([item])) throw new Error('Invalid key returned by ledger view');
        const value = results?.rows[0]?.value;
        if (!value) throw new Error(`Invalid results from inventoryValue view`);
        const { quantity, cost } = value;
        const unitCost = quantity && (cost / quantity);
        return { quantity, cost, unitCost };
    }

    static async getLedger(item, date) {
        
    }
}