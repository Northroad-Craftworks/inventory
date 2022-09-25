
const currencyFormatter = new Intl.NumberFormat('en-us', { style: 'currency', currency: 'usd' });
/**
 * A helper function to format a number into a US currency.
 */
export function formatCost(cost){
    if (Number.isNaN(Number(cost))) return '';
    return currencyFormatter.format(cost);
}


/**
 * A helper function to calculate the unit cost based of a quantity and cost.
 * @param {number} quantity
 * @param {number} cost
 * @param {boolean} rounded - Whether to round to the nearest cent.
 * @returns {number} Unit cost value
 */
export function getUnitCost(quantity, cost, rounded = true) {
    const unitCost = quantity && cost / quantity;
    return rounded ? round(unitCost) : unitCost;
}

/**
 * A helper function to round a value to an arbitrary precision.
 * @param {number} value 
 * @param {number} [digits = 2] - Number of decimal places to round to.
 * @returns {number} Value, rounded to the specified digits.
 */
export function round(value, digits = 2) {
    if (!Number.isInteger(digits) || digits < 1 || digits > 5) throw new Error('Invalid digits for rounding');
    const scale = 10**digits;
    return Math.round(scale * value) / scale;
}