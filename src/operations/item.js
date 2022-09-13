import createError from 'http-errors';
import Item from '../models/Item.js';

export async function listItems(req, res, next) {
    // Pre-validate the accepts header;
    // TODO Support CSV.
    const accepts = req.accepts(['json', 'text/plain']);
    if (!accepts) throw createError(406);

    // Get all items.
    const items = await Item.list({ filter: req.query });

    // Return the results in the accepted format.
    if (accepts === 'json') res.json(items);
    else if (accepts === 'text/plain') res.type('text/plain').send(items.join('\n'));
    else throw new Error('Impossible MIME type match');
}

export async function createItem(req, res) {
    const item = await Item.create(req.params.itemId, req.body);
    res.status(201).json(item);
}

export async function readItem(req, res) {
    const item = await Item.get(req.params.itemId);
    res.json(item);
}

export async function updateItem(req, res) {
    const item = await Item.get(req.params.itemId);
    item.patch(req.body);
    await item.save();
    res.json(item);
}

export async function deleteItem(req, res) {
    const item = await Item.get(req.params.itemId);
    // TODO Check ledgers to make sure the item can be deleted.
    if (item.quantity) throw createError(403, 'Cannot delete an item that has inventory in stock');
    await item.destroy();
    res.send({ ok: true });
}