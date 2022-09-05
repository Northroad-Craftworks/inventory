import database from "../lib/database";

export const MODEL_PREFIX = 'item:'

export default class Item {
    static async list(){
        // TODO Do this with a view instead.
        const results = await database.list({include_docs: true});
        return results.rows
            .filter(row => row.id.startsWith(MODEL_PREFIX))
            .map(row => new Item(row.doc));
    }

    /**
     * Unique ID of the material, part, or product
     * @type {string}
     */
    id;

    
    name;


    constructor(document){
        Object.apply(this, document);
        // TODO Validate the item
    }
}