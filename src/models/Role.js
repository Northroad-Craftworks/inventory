import pluralize from "pluralize";
import logger from "../lib/logger.js";
import Permission from "./Permission.js";
import apiSpec from '../lib/api-spec.js';

/**
 * All role names must match this pattern.
 */
const namePattern = /^[a-z](?:[a-z-]*[a-z])?$/

/**
 * A map of all roles known to the system.
 */
export const roles = new Map();

export default class Role {
    static get(name) {
        return roles.get(name) || new Role({ name });
    }

    constructor({ name, description, permissions }) {
        if (typeof name !== 'string') throw new Error('Role name must be a string');
        if (!name.match(namePattern)) throw new Error(`Invalid role name: ${name}`);
        if (roles.has(name)) throw new Error(`Role already exists: ${name}`);

        if (description && typeof description !== 'string') throw new Error('Role description must be a string');

        this.name = name;
        this.description = description;
        this._permissions = new Set();

        permissions?.forEach?.(permission => this.addPermission(permission));
    }

    get permissions() {
        return [...this.permissions];
    }

    addPermission(name) {
        const permission = Permission.get(name);
        if (!permission) throw new Error(`Permission ${name} is not defined`);
        if (this.hasPermission(permission)) return;
        this.permissions.add(permission);
        logger.debug(`Added ${permission.name} to ${this.name} role`);
    }

    hasPermission(name) {
        if (!name || typeof name !== 'string') throw new Error('Missing/invalid permission name');
    }

    collapsePermissions() {
        const startCount = this._permissions.size();
        this._permissions = Permission.collapse(this._permissions);
        const diff = startCount - this._permissions.size();
        logger.debug(`Collapsed permissions for ${this.name}, removed ${pluralize('permission', diff, true)}`);
    }
}