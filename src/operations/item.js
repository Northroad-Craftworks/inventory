import createError from 'http-errors';

export function listItems(req, res, next) {
    throw createError(501, "Operation 'items.list' is not yet available");
}

export function createItem(req, res, next) {
    const document = { id: req.params.itemId, ...req.body};
    res.json(document);
    // const valid = validate.InventoryItem(document);
    // if (!valid) res.status(400).json({
    //     message: "Invalid request",
    //     errors: validate.InventoryItem.errors
    // })
    // else {
    //     res.json(document);
    // }
}

export function readItem(req, res, next) {
    throw createError(501, "Operation 'items.fetch' is not yet available");
}

export function updateItem(req, res, next) {
    const document = { id: req.params.itemId, ...req.body};
    res.json(document);
}

export function deleteItem(req, res, next) {
    throw createError(501, "Operation 'items.destroy' is not yet available");
}