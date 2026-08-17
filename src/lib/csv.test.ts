import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '@/lib/csv';

test('parseCSV: splits a header + data rows into a cell grid', () => {
  const grid = parseCSV('phone,name\n+233551234567,John\n+233247654321,Ama');
  assert.deepEqual(grid, [
    ['phone', 'name'],
    ['+233551234567', 'John'],
    ['+233247654321', 'Ama'],
  ]);
});

test('parseCSV: keeps a quoted comma inside one cell', () => {
  const grid = parseCSV('phone,name\n+233551234567,"Doe, John"');
  assert.equal(grid[1][0], '+233551234567');
  assert.equal(grid[1][1], 'Doe, John');
});

test('parseCSV: trims whitespace around cells', () => {
  const grid = parseCSV('  phone ,  name  \n  +233551234567 , John ');
  assert.equal(grid[0][0], 'phone');
  assert.equal(grid[0][1], 'name');
  assert.equal(grid[1][0], '+233551234567');
  assert.equal(grid[1][1], 'John');
});

test('parseCSV: handles a quoted field that spans the whole cell', () => {
  const grid = parseCSV('phone,name\n"+233551234567",John');
  assert.equal(grid[1][0], '+233551234567');
  assert.equal(grid[1][1], 'John');
});