#!/usr/bin/env node
/**
 * Fixes corrupted npm integrity hashes in package-lock.json where Portuguese
 * keyboard/autocorrect injected characters (ã, ção, etc.) into base64 strings.
 * Run after backup: node scripts/fix-package-lock-integrity-encoding.mjs src/api/package-lock.json
 */

import fs from 'node:fs';
import path from 'node:path';

function repairIntegrity(value) {
  if (typeof value !== 'string' || !value.startsWith('sha512-')) {
    return value;
  }
  return value
    .replace(/qçã/g, 'qqa')
    .replace(/ção/g, 'cao')
    .replace(/çã/g, 'ca')
    .replace(/ão/g, 'ao')
    .replace(/ã/g, 'a')
    .replace(/ç/g, 'c')
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/â/g, 'a')
    .replace(/ê/g, 'e')
    .replace(/ô/g, 'o')
    .replace(/õ/g, 'o')
    .replace(/à/g, 'a');
}

function walk(obj) {
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      walk(item);
    }
    return;
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === 'integrity' && typeof val === 'string') {
      obj[key] = repairIntegrity(val);
    } else {
      walk(val);
    }
  }
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/fix-package-lock-integrity-encoding.mjs <path-to-package-lock.json>');
  process.exit(1);
}

const resolved = path.resolve(file);
const raw = fs.readFileSync(resolved, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('Invalid JSON:', resolved, e.message);
  process.exit(1);
}

walk(data);
fs.writeFileSync(resolved, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log('Updated integrity fields:', resolved);
