import chai from 'chai';
import { consoleTransport } from '../src/logger.js';

// Set up chai
export const should = chai.should();
export const expect = chai.expect;

// Silence console output from the logger.
consoleTransport.silent = true;