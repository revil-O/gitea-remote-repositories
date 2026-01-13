/**
 * Build output for Node.js test runner
 */
import * as path from 'path';

export const testRunner = 'mocha';
export const testTimeout = 10000;
export const testMatch = ['**/test/**/*.test.ts'];
export const rootDir = path.dirname(__dirname);
