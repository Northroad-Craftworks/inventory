import { parse as parseCSV } from 'csv-parse';
import { readFile } from 'fs/promises';
import ora from 'ora';
import Item from './models/Item.js';
import Adjustment from './models/Adjustment.js';
import { startDate } from './lib/config.js';

const START_DATE = "2022-01-01";

const spinner = ora();

// Load materials.
spinner.start('Loading materials...');
const materialsCSV = await readFile('data/export-materials.csv', 'utf-8');
const materialParser = parseCSV(materialsCSV, { columns: true });
let materialsCount = 0;
for await (const record of materialParser) {
    const itemProperties = {
        id: record.id,
        name: record.name,
        sku: record.sku,
        unit: record.tracking_unit,
        category: record.category,
        account: "Raw Materials"
    };
    const initialOptions = {
        quantity: Number(record.starting_quantity ?? 0),
        unitCost: Number(record.starting_unit_price ?? 0),
    };
    await Item.create(itemProperties, initialOptions);
    materialsCount++;
}
spinner.succeed(`Loaded ${materialsCount} materials`);

// Load Purchases
spinner.start('Loading purchases...');
const purchasesCSV = await readFile('data/export-expense-purchases.csv', 'utf-8');
const purchasesParser = parseCSV(purchasesCSV, { columns: true });
const purchases = new Map();
for await (const record of purchasesParser) {
    purchases.set(record.id, {
        id: record.id,
        date: record.date.substr(0, 10),
        code: record.code,
        vendor: record.vendor,
        subTotal: Number(record['item total']),
        tax: Number(record.tax),
        shipping: Number(record.shipping),
        discount: Number(record.discount),
        total: Number(record.grand_total)
    });
}
const purchaseLineItemsCSV = await readFile('data/export-purchase-line-items.csv', 'utf-8');
const purchaseLineItemsParser = parseCSV(purchaseLineItemsCSV, { columns: true });
let purchaseCount = 0;
for await (const record of purchaseLineItemsParser) {
    const purchase = purchases.get(record['expense id']);
    const quantity = Number(record.quantity);
    const totalCost = Number(record['total price']);
    const unitCost = totalCost / quantity;
    const date = purchase.date;
    // TODO Compensate for taxes
    const item = await Item.getBySKU(record['item code']);
    await item.adjust({ quantity, unitCost, date, type: Adjustment.TYPES.PURCHASE });
    purchaseCount++;
}
spinner.succeed(`Loaded ${purchaseCount} item purchases`);

// TODO Load manufactures
// TODO Load sales

// Generate report
// TODO Break this into other functions.
spinner.start("Generating report...");
const items = await Item.list();
await Promise.all(items.map(async item => item.recaculate()));
let totalValue = 0;
const report = [];
items.forEach(item => {
    const { name, sku, quantity, unitCost } = item;
    const value = quantity * unitCost;
    report.push(`${name} (${sku}) x${quantity} @ $${unitCost} = $${value}`);
    totalValue += value;
});
report.push(`TOTAL: $${totalValue}`)
spinner.succeed('Generated report')
console.log(`\n\n${report.join('\n')}`);
