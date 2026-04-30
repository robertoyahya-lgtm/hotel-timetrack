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
    {
      id: 'd0bd4e43-c48c-49ef-880d-fabab4f11df6', name: 'The Cove', subUnits: [],
      address: '4501 Rue Drolet, Montréal, QC H2T 1R1',
      coordinates: { lat: 45.523682, lng: -73.583714, radius: 200 },
    },
    {
      id: '1149a9e7-6a01-4981-9145-558b956637d2', name: 'Maison de Paris', subUnits: [],
      address: '901 Rue Sherbrooke E, Montréal, QC H2L 1L3',
      coordinates: { lat: 45.513149, lng: -73.569234, radius: 200 },
    },
    {
      id: 'ae3dac83-9cd9-469c-9236-4641cffb1736',
      name: 'Les Chambres Petit Prince',
      isGroup: true,
      subUnits: ['Victoria', 'Mystral', 'The Mile End Parc', 'The Little Prince Rooms'],
      coordinates: null,
      subUnitCoordinates: {
        'Victoria':             { lat: 45.491408, lng: -73.630485, radius: 200, address: '5475 Avenue Victoria, Montréal, QC H3W 2P7' },
        'Mystral':              { lat: 45.521256, lng: -73.577538, radius: 200, address: '4152 Rue Saint-Denis, Montréal, QC H2W 2M5' },
        'The Mile End Parc':    { lat: 45.523717, lng: -73.606155, radius: 200, address: '5826 Avenue du Parc, Montréal, QC H2V 4H3' },
        'The Little Prince Rooms': { lat: 45.496549, lng: -73.554720, radius: 200, address: '64 Rue Prince, Montréal, QC H3C 2M8' },
      },
    },
    {
      id: 'e444cbd1-0088-406d-8292-8c9b4b89d631', name: 'The Alexander', subUnits: [],
      address: '411 Rue des Récollets, Montréal, QC H2Y 2L2',
      coordinates: { lat: 45.501325, lng: -73.558754, radius: 200 },
    },
    {
      id: '645cbf99-b5ae-4e94-90e4-dec9aeacd8d1', name: 'Hotel Monroe', subUnits: [],
      address: '1470 Rue Mackay, Montréal, QC H3G 2H6',
      coordinates: { lat: 45.494243, lng: -73.573730, radius: 200 },
    },
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
