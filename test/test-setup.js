import Chance from 'chance';
import chai from 'chai';
import { consoleTransport } from '../src/utilities/logger.js';

// Silence console output from the logger.
consoleTransport.silent = true;

// Set up chai
export const should = chai.should();
export const expect = chai.expect;

// Set up chance
export const chance = new Chance();
