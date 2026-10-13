import assert from 'node:assert/strict';
import { adminConfigured } from '../src/auth.js';
assert.equal(adminConfigured({}), false);
assert.equal(adminConfigured({ANKOO_ADMIN_PASSWORD:'examplepassword',ANKOO_SESSION_SECRET:'a'.repeat(40)}), true);
console.log('Teste administrativo passou');
