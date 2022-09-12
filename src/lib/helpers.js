/**
 * A helper function to calculate the unit cost based of a quantity and cost.
 * @param {number} quantity
 * @param {number} cost
 * @param {boolean} rounded - Whether to round to the nearest cent.
 * @returns {number} Unit cost value
 */
export function getUnitCost(quantity, cost, rounded = true) {
    const unitCost = quantity && cost / quantity;
    return rounded ? Math.round(100 * unitCost) / 100 : unitCost;
}