import logger from "../../src/lib/logger.js";
import generateId from "../lib/generate-id.js";
import Item from "./Item.js";

/**
 * This defines the list of types for an adjustment.
 * This is a SORTED list, which defines the order in which same-date adjustments will be sorted.
 */
export const TYPES = {
    INITIAL: 'Initial',
    AUDIT: 'Audit',
    MANUAL: 'Manual',
    PURCHASE: 'Purchase',
    MANUFACTURE: 'Manufacture',
    CONSUME: 'Consume',
    SALE: 'Sale'
};

// TODO Replace this with a real datastore.
const adjustments = new Set();

/**
 * Sorts two adjustments into the order they should appear in a ledger.
 * @param {Adjustment} a 
 * @param {Adjustment} b 
 * @returns 
 */
export function sortAdjustments(a, b) {
    // Sort first by date.
    if (a.date !== b.date) return new Date(a) - new Date(b);

    // Otherwise, sort by type.
    if (a.type !== b.type) {
        const sequence = Object.values(TYPES);
        for (const type of sequence) {
            // TODO Check this order
            if (a.type === type) return -1;
            if (b.type === type) return 1;
        }
        throw new Error(`Cannot sort unknown types: '${a.type}' and '${b.type}'`);
    }

    // As a deterministic fallback, sort by quantity.
    return a.quantity - b.quantity; // TODO Check this order
}

export default class Adjustment {
    static get TYPES() {
        return TYPES;
    }

    /**
     * Creates a new adjustment
     * @param {Adjustment} properties
     * @returns {Adjustment} The created adjustment
     */
    static async create(properties) {
        return new Adjustment(properties).save();
    }

    /**
     * @returns {Adjustment[]} List of all adjustments
     */
    static async list() {
        return [...adjustments].sort(sortAdjustments);
    }

    /**
     * 
     * @param {*} itemId 
     * @returns {Adjustment[]} List of all adjustments associated with the given item.
     */
    static async listForItem(itemId) {
        // TODO Load from a storted view.
        return [...adjustments]
            .filter(adjustment => adjustment.itemId === itemId)
            .sort(sortAdjustments);
    }

    /**
     * ID of the item being adjusted.
     * @type string
     */
    itemId;

    /**
     * Date of the adjustment
     * @type string
     */
    date;

    /**
     * Type of adjustment
     */
    type;

    /**
     * Quantity being added (or removed, if negative.)
     * @type number
     */
    quantity = 0.0;

    /**
     * Unit cost of the quantity being added/removed
     * @type number
     */
    unitCost = 0.0;

    /**
     * Total quantity remaining after the adjustment.
     * @type number
     */
    endingQuantity = 0.0;

    /**
     * Total effective unit cost after the adjustment.
     * @type number
     */
    endingUnitCost = 0.0;


    // TODO Track the total quantity and cost before/after adjustment

    constructor(properties, previous) {
        Object.assign(this, properties);
        // Ensure the adjustment has an ID.
        if (!this.id) this.id = generateId();
        if (!this.id.match(/^[a-z\d-]+$/)) throw new Error('Missing/invalid adjustment id');

        // Validate item reference
        if (!this.itemId) throw new Error("Cannot create an adjustment without an itemId");

        // Validate date
        if (!this.date) throw new Error('Cannot create an adjustment without a date');
        // TODO Verify that the date is sensible.

        // Validate changes
        if (!this.type) throw new Error('Cannot create an adjustment without a type');
        if (this.unitCost < 0) throw new Error('Unit cost cannot be negative');
        switch(this.type){
            // Initial and audit adjustments override any previous values.
            case TYPES.INITIAL:
            case TYPES.AUDIT:
                if (this.quantity > 0 && !this.unitCost) logger.warn(`Adjustment has no cost: ${id} (${itemId})`);
                // Set the ending quantity and unit costs.
                this.endingQuantity = this.quantity;
                this.endingUnitCost = this.unitCost;
                break;

            // Purchases and manufactures increase quantity and adjust unit cost.
            case TYPES.PURCHASE:
            case TYPES.MANUFACTURE:
                if (this.quantity <= 0) throw new Error(`${this.type} adjustments must have positive quantity`);
                if (!this.unitCost) logger.warn(`Adjustment has no cost: ${id} (${itemId})`);
                break;
                
            // Sales and consumptions reduce quantity without affecting unit costs.
            case TYPES.SALE:
            case TYPES.CONSUME:
                if (this.quantity >= 0) throw new Error(`${this.type} adjustments must have negative quantity`);
                break;

            default:
                throw new Error(`Invalid adjustment type: ${this.type}`);
        }

        // Adjust from previous, if available.
        if (previous) this.recalculate(previous);
    }

    /**
     * Baseline adjustments (Initial and Audit) set the quantity and unit cost of an item, ignoring any previous
     * adjustments for the item. All recalculations must start from a baseline in order to be accurate.
     * @return {boolean} Whether the adjustment is a baseline.
     */
    get isBaseline(){
        return this.type === TYPES.INITIAL || this.type === TYPES.AUDIT;
    }

    /**
     * Recalculates the totals of this adjustment based on the previous one.
     * @param {Adjustment} previous 
     */
    recalculate(previous) {
        if (this.type === TYPES.INITIAL) throw new Error('Nothing can be before an initial adjustment');

        // Extract values from previous adjustment and save a link to it.
        const { endingQuantity: existingQuantity, endingUnitCost: existingUnitCost } = previous;
        this.previous = previous;
        
        // Quantity is almost always cumulative.
        this.endingQuantity = existingQuantity + this.quantity;

        // Calculate the ending values based on the type.
        switch (this.type) {
            // Audit adjustments override any previous values.
            case TYPES.AUDIT:
                this.endingQuantity = this.quantity;
                this.endingUnitCost = this.unitCost;
                break;

            // Purchases and manufactures increase quantity and adjust unit cost.
            case TYPES.PURCHASE:
            case TYPES.MANUFACTURE:
                // If the existing quantity was negative, the unit cost only uses this transaction.
                if (existingQuantity < 0) this.endingUnitCost = this.unitCost;
                else {
                    // Otherwise, add the total costs and divide by total quantity.
                    const existingTotalCost = existingQuantity * existingUnitCost;
                    const purchaseTotalCost = this.quantity + this.unitCost;
                    this.endingUnitCost = (existingTotalCost + purchaseTotalCost) / this.endingQuantity;
                }
                break;

            // Sales and consumptions reduce quantity without affecting unit costs.
            case TYPES.SALE:
            case TYPES.CONSUME:
                // Unit cost is inherited from the previous adjustment.
                this.endingUnitCost = this.unitCost = existingUnitCost;

            // TODO Implement manual adjustments
            case TYPES.MANUAL:
            default:
                throw new Error(`Recalculation does not yet support ${this.type} adjustments`);
        }
    }

    /**
     * Save the adjustment to the datastore
     * @return {Adjustment} The saved adjustment, for chaining.
     */
    async save() {
        // TODO Save to a real datastore.
        adjustments.add(this);
        return this;
    }
}