'use strict';
/**
 * seed.js — One-time bootstrap.
 *
 * Safe to run multiple times: only creates files / records that don't exist.
 *  - Initialises empty data files (users, shifts, hotels, corrections)
 *  - Creates a single starter admin account ONLY if no users exist
 *
 * After the first sign-in, manage all real staff from Admin → Employees.
 *
 * Run once: node seed.js
 */
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DATA = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

const FILES = {
  users:       path.join(DATA, 'users.json'),
  hotels:      path.join(DATA, 'hotels.json'),
  shifts:      path.join(DATA, 'shifts.json'),
  corrections: path.join(DATA, 'corrections.json'),
};

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function main() {
  // 1. Ensure every data file exists with a sensible default.
  if (!fs.existsSync(FILES.hotels))      writeJson(FILES.hotels,      []);
  if (!fs.existsSync(FILES.shifts))      writeJson(FILES.shifts,      []);
  if (!fs.existsSync(FILES.corrections)) writeJson(FILES.corrections, []);
  if (!fs.existsSync(FILES.users))       writeJson(FILES.users,       []);

  // 2. Bootstrap a starter admin only when the system has no users at all.
  const users = readJson(FILES.users, []);
  if (users.length === 0) {
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe2026!';
    const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
    const hashed   = await bcrypt.hash(password, 10);
    const now      = new Date().toISOString();

    users.push({
      id: uuidv4(),
      name: 'Administrator',
      email,
      password: hashed,
      role: 'admin',
      hotelId: null,
      hotelName: null,
      subUnit: null,
      active: true,
      createdAt: now,
      deactivatedAt: null,
    });
    writeJson(FILES.users, users);

    console.log('\n  Initial admin account created.');
    console.log('  Email:    ' + email);
    console.log('  Password: ' + password);
    console.log('\n  Sign in, then change the password from My Account.\n');
  } else {
    console.log('\n  Data files verified. ' + users.length + ' user account(s) present — no changes made.\n');
  }

  // 3. Remove deprecated files from older schema versions.
  ['employees.json', 'properties.json'].forEach(f => {
    const fp = path.join(DATA, f);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
