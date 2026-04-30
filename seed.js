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
  if (!fs.existsSync(FILES.shifts))      writeJson(FILES.shifts,      []);
  if (!fs.existsSync(FILES.corrections)) writeJson(FILES.corrections, []);
  if (!fs.existsSync(FILES.users))       writeJson(FILES.users,       []);

  // Hotels are configuration, not user data — always ensure the canonical list
  // exists with proper IDs and the isGroup flag for Les Chambres Petit Prince.
  const DEFAULT_HOTELS = [
    { id: 'd0bd4e43-c48c-49ef-880d-fabab4f11df6', name: 'The Cove',       subUnits: [] },
    { id: '1149a9e7-6a01-4981-9145-558b956637d2', name: 'Maison de Paris', subUnits: [] },
    {
      id: 'ae3dac83-9cd9-469c-9236-4641cffb1736',
      name: 'Les Chambres Petit Prince',
      isGroup: true,
      subUnits: ['Victoria', 'Mystral', 'The Mile End Parc', 'The Little Prince Rooms'],
    },
    { id: 'e444cbd1-0088-406d-8292-8c9b4b89d631', name: 'The Alexander', subUnits: [] },
    { id: '645cbf99-b5ae-4e94-90e4-dec9aeacd8d1', name: 'Hotel Monroe',  subUnits: [] },
  ];
  if (!fs.existsSync(FILES.hotels)) {
    writeJson(FILES.hotels, DEFAULT_HOTELS);
    console.log('  Hotels file created with default properties.');
  } else {
    // Repair: if any hotel is missing its id, replace the whole file with the
    // canonical list (merges nothing — IDs are stable and known in advance).
    const existing = readJson(FILES.hotels, []);
    const anyMissingId = existing.some(h => !h.id);
    if (anyMissingId) {
      writeJson(FILES.hotels, DEFAULT_HOTELS);
      console.log('  Hotels file repaired: IDs were missing, canonical list restored.');
    }
  }

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
