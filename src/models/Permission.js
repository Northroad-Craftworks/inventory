import { readFile } from 'fs/promises';
import YAML from 'yaml';
import apiSpec from '../lib/api-spec.js';

/**
 * All permission names must match this pattern.
 */
const namePattern = /^[a-z](?:[a-z-]*[a-z])?(?::[a-z](?:[a-z-]*[a-z])?)*$/;

/**
 * A map of all known permissions.
 */
export const permissions = new Map();

// TODO JSDoc Permission
export default class Permission {
    static list(options) {
        const all = [...permissions.values];
        return options?.collapsed ? Permission.collapse(all) : all;
    }

    static get(name){
        if (!name || typeof name !== 'string') throw new Error('Invalid permission name');

        return permissions.get(name);
    }

    /**
     * Takes a list of permissions and returns a deduplicated set.
     * Unnecessary nested permissions are removed.
     * @param {Iterable<Permission>} list 
     * @return {Permission}
     */
    static collapse(list) {
        return [...list]
            .sort((a, b) => a.depth - b.depth)
            .reduce((set, permission) => {
                for (const name of permission.chain){
                    if (set.has(name)) return set;
                }
                set.add(permission);
                return set;
            }, new Set());
    }

    /**
     * The name of the permission.
     * @type {string}
     */
    name;

    /**
     * The friendly description of the permission.
     * @type {string}
     */
    description;

    constructor({ name, description }) {
        if (!name || typeof name !== 'string') throw new Error('Permission name must be a string');
        if (!name.match(namePattern)) throw new Error(`Invalid permission name: ${name}`);
        if (permissions.has(name)) throw new Error(`Permission already exists: ${name}`);
        this.name = name;
        this.description = description;
        this._chain = name.split(':').map((_, index, array) => array.slice(0, index).join(':'));
        Object.freeze(this._chain);
        Object.freeze(this);
        permissions.set(name, this);
    }

    get depth() {
        return this._chain.length;
    }
}

// Load all pre-configured permissions from disk.
// const yaml = await readFile(new URL('../permissions.yaml', import.meta.url), 'utf-8');
// YAML.parse(yaml).forEach(config => new Permission(config));