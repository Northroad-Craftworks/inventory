import createError from 'http-errors';

export function list(req, res, next){
    throw createError(501, "Operation 'items.list' is not yet available");
}

export function define(req, res, next){
    throw createError(501, "Operation 'items.define' is not yet available");
}

export function fetch(req, res, next){
    throw createError(501, "Operation 'items.fetch' is not yet available");
}

export function destroy(req, res, next){
    throw createError(501, "Operation 'items.destroy' is not yet available");
}