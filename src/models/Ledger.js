import database from "../lib/database.js";
import logger from "../lib/logger.js";

export default class Ledger {
    static async getInventory(item, date) {
        item = item?.id || item || '_total';
        if (date instanceof Date) date = date.toISOString();
        else if (!date) date = {};
        const query = {
            start_key: [item],
            end_key: [item, date]
        };
        const results = await database.view('ledger', 'items', query);
        if (results?.rows?.length > 1) throw new Error('Too many rows returned by ledger view');
        const value = results?.rows[0]?.value;
        if (!value) throw new Error(`Invalid results from inventoryValue view`);
        return value;
    }
}