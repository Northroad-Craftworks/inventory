import { startDate } from "../lib/config.js";
import generateId from "../lib/generate-id.js";
import Adjustment from "./Adjustment.js";

// TODO Replace this with a non-memory datastore.
const items = new Map();

export default class Item {

    /**
     * @param {*} properties 
     * @returns {Item} The created item
     */
    static async create(properties, initialOptions) {
        const item = await new Item(properties).save();
        if (initialOptions) await item.adjust({
            quantity: initialOptions.quantity || 0.0,
            unitCost: initialOptions.unitCost || 0.0,
            type: Adjustment.TYPES.INITIAL,
            date: startDate
        });
        return item;
    }

    /**
     * @returns {Item[]} The list of all items
     */
    static async list() {
        return [...items.values()];
    }

    /**
     * @param {string} id - Id of the item to find
     * @returns {Item} Matching item
     */
    static async getById(id) {
        return items.get(id);
    }

    /**
     * @param {string} sku - SKU of the item to find
     * @returns {Item} Matching item
     */
    static async getBySKU(sku) {
        return [...items.values()].find(item => item.sku === sku);
    }

    /**
     * Unique ID of the item.
     * @type string
     */
    id;

    /**
     * Friendly name of the item, for humans.
     * @type string
     */
    name;

    /**
     * Item's SKU
     * @type string
     */
    sku;

    /**
     * The unit used to measure the item
     * @type string
     */
    unit = 'item';

    /**
     * Item category, for organization purposes.
     * @type string
     */
    category;

    /**
     * Item account, for finance purposes.
     * Examples:
     *  - Raw Materials
     *  - In-Progress Materials
     *  - Finished Products
     *  - Resale Items
     * @type string
     */
    account = 'Raw Materials';


    /**
     * Quantity currently on hand.
     */
    quantity = 0;

    /**
     * Unit cost of inventory currently on hand.
     */
    unitCost = 0;

    // TODO Add tracking information

    constructor(properties) {
        Object.assign(this, properties);
        if (!this.id) this.id = generateId();
        if (!this.id.match(/^[a-z\d-]+$/)) throw new Error('Missing/invalid item id');
        if (items.has(this.id)) throw new Error(`Item already exists: ${this.id}`);
        if (!this.name) throw new Error("Items must have a name");
    }

    /**
     * Create a new adjustment related to this item.
     * @param {*} properties - Properties for {@link Adjustment.create}
     * @returns {Adjustment} Created adjustment
     */
    async adjust(properties) {
        return Adjustment.create({ ...properties, itemId: this.id });
    }

    async getAdjustments() {
        return Adjustment.listForItem(this.id);
    }

    // Recaculate the item's quantity and unit cost from adjustments.
    async recaculate(){
        // Get all the adjustments for this item, in sorted order.
        const adjustments = await this.getAdjustments();

        // Make sure the first adjustment is a baseline.
        if (!adjustments[0]?.isBaseline) throw new Error('Missing baseline adjustment');

        // Recalculate all adjustments, from the start to the finish.
        const lastAdjustment = adjustments.reduce((previous, current) => {
            current.recalculate(previous);
            return current;
        })
        this.quantity = lastAdjustment.endingQuantity;
        this.unitCost = lastAdjustment.endingUnitCost;
    }

    /**
     * Save the item to the datastore.
     * @returns {Item} The saved item, for chaining
     */
    async save() {
        // TODO Use a real datastore.
        items.set(this.id, this);
        return this;
    }
}