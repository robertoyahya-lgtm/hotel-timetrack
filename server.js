'use strict';
const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app    = express();
const PORT   = process.env.PORT || 3001;

// In production (Render/Railway), point DATA_DIR at a mounted persistent volume.
// Locally it defaults to ./data so nothing changes for development.
const DATA   = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');

// JWT secret. In production a real secret MUST be provided via env.
const DEFAULT_SECRET = 'htps-secret-v2-2026';
const SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || SECRET === DEFAULT_SECRET)) {
  console.error('FATAL: JWT_SECRET environment variable is required in production.');
  process.exit(1);
}

// Trust the platform proxy (Render / Railway terminate HTTPS in front of the app).
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB ──────────────────────────────────────────────────────────────────────

const db = {
  read(file) {
    const fp = path.join(DATA, file);
    if (!fs.existsSync(fp)) { fs.writeFileSync(fp, '[]'); return []; }
    try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; }
  },
  write(file, data) {
    fs.writeFileSync(path.join(DATA, file), JSON.stringify(data, null, 2));
  }
};

// ─── Auth middleware ──────────────────────────────────────────────────────────

function auth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = jwt.verify(header.slice(7), SECRET);
      if (roles.length && !roles.includes(payload.role))
        return res.status(403).json({ error: 'Insufficient permissions' });
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired session' });
    }
  };
}

function omit(obj, ...keys) {
  const o = { ...obj };
  keys.forEach(k => delete o[k]);
  return o;
}

// ─── Static pages ────────────────────────────────────────────────────────────

app.get('/login', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public/index.html')));

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const users = db.read('users.json');
  const user  = users.find(u => u.email?.toLowerCase() === email.toLowerCase() && u.active !== false);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok)  return res.status(401).json({ error: 'Invalid email or password' });

  const payload = {
    id: user.id, name: user.name, email: user.email,
    role: user.role, hotelId: user.hotelId, hotelName: user.hotelName,
    subUnit: user.subUnit, position: user.position || null
  };
  const token = jwt.sign(payload, SECRET, { expiresIn: '16h' });
  res.json({ token, user: payload });
});

app.get('/api/auth/me', auth(), (req, res) => res.json(req.user));

// Self-service profile update (any authenticated user)
app.put('/api/auth/profile', auth(), async (req, res) => {
  const users = db.read('users.json');
  const idx   = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const { name, email, password } = req.body;

  // Check email uniqueness (excluding self)
  if (email && email.toLowerCase() !== users[idx].email.toLowerCase()) {
    const taken = users.find(u => u.id !== req.user.id && u.email?.toLowerCase() === email.toLowerCase());
    if (taken) return res.status(409).json({ error: 'That email address is already in use' });
  }

  const updates = {};
  if (name)     updates.name     = name.trim();
  if (email)    updates.email    = email.trim().toLowerCase();
  if (password) updates.password = await bcrypt.hash(password, 10);

  users[idx] = { ...users[idx], ...updates };
  db.write('users.json', users);

  // Return fresh payload (no password)
  const u = users[idx];
  res.json(omit(u, 'password'));
});

// ─── HOTELS ──────────────────────────────────────────────────────────────────

app.get('/api/hotels', auth(), (_req, res) => {
  res.json(db.read('hotels.json').filter(h => h.active !== false));
});

// ─── USERS ───────────────────────────────────────────────────────────────────

app.get('/api/users', auth('admin', 'manager', 'accounting', 'supervisor'), (req, res) => {
  let users = db.read('users.json');
  if (req.user.role === 'manager')
    users = users.filter(u => u.hotelId === req.user.hotelId && u.role === 'employee');
  else if (req.user.role === 'supervisor')
    // Read-only view of employees of the supervisor's hotel
    users = users.filter(u => u.hotelId === req.user.hotelId && u.role === 'employee');
  res.json(users.map(u => omit(u, 'password')));
});

const VALID_ROLES = ['employee', 'manager', 'supervisor', 'accounting', 'admin'];

// ─── POSITIONS (job titles, e.g. Receptionist / Cleaner) ─────────────────────
// Admin-managed list. Used to tag employees so payroll can be filtered by job.

function readPositions() {
  return db.read('positions.json');
}

function isPositionInUse(name) {
  return db.read('users.json').some(
    u => u.active !== false && u.position === name
  );
}

app.get('/api/positions', auth('admin', 'accounting', 'manager'), (_req, res) => {
  const positions = readPositions();
  const users = db.read('users.json');
  // Return both the bare list and a usage count so the admin UI can show
  // why a delete might be blocked.
  const detailed = positions.map(name => ({
    name,
    inUse: users.filter(u => u.active !== false && u.position === name).length
  }));
  res.json({ positions, detailed });
});

app.post('/api/positions', auth('admin'), (req, res) => {
  const raw = (req.body?.name || '').trim();
  if (!raw) return res.status(400).json({ error: 'name is required' });
  if (raw.length > 40) return res.status(400).json({ error: 'name too long (max 40 chars)' });

  const positions = readPositions();
  if (positions.some(p => p.toLowerCase() === raw.toLowerCase()))
    return res.status(409).json({ error: 'Position already exists' });

  positions.push(raw);
  positions.sort((a, b) => a.localeCompare(b));
  db.write('positions.json', positions);
  res.status(201).json({ positions });
});

app.delete('/api/positions/:name', auth('admin'), (req, res) => {
  const target = req.params.name;
  if (target === 'Unassigned')
    return res.status(400).json({ error: 'The "Unassigned" position cannot be removed.' });
  if (isPositionInUse(target))
    return res.status(409).json({ error: 'Cannot delete: position is still assigned to one or more active employees.' });

  const positions = readPositions().filter(p => p !== target);
  db.write('positions.json', positions);
  res.json({ positions });
});

app.post('/api/users', auth('admin'), async (req, res) => {
  const { name, email, password, role, hotelId, subUnit, position } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password and role are required' });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });

  // Position is required for employees so payroll reports always have a row.
  // For admin/accounting/manager/supervisor it's optional and defaults to null.
  let resolvedPosition = null;
  if (role === 'employee') {
    const positions = readPositions();
    if (!position || !positions.includes(position))
      return res.status(400).json({ error: `position is required for employees and must be one of: ${positions.join(', ')}` });
    resolvedPosition = position;
  } else if (position) {
    const positions = readPositions();
    if (!positions.includes(position))
      return res.status(400).json({ error: `position must be one of: ${positions.join(', ')}` });
    resolvedPosition = position;
  }

  const users = db.read('users.json');
  if (users.find(u => u.email?.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ error: 'Email already exists' });

  const hotels  = db.read('hotels.json');
  const hotel   = hotels.find(h => h.id === hotelId);
  const hashed  = await bcrypt.hash(password, 10);

  const user = {
    id: uuidv4(), name, email, role,
    password: hashed,
    hotelId:   hotelId   || null,
    hotelName: hotel?.name || null,
    subUnit:   subUnit   || null,
    position:  resolvedPosition,
    active: true,
    createdAt: new Date().toISOString(),
    deactivatedAt: null
  };
  users.push(user);
  db.write('users.json', users);
  res.status(201).json(omit(user, 'password'));
});

app.put('/api/users/:id', auth('admin'), async (req, res) => {
  const users = db.read('users.json');
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const updates = { ...req.body };
  if (updates.role && !VALID_ROLES.includes(updates.role))
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });

  // Validate position against the admin-managed list when provided.
  if (Object.prototype.hasOwnProperty.call(updates, 'position')) {
    if (updates.position === '' || updates.position === null) {
      updates.position = null;
    } else {
      const positions = readPositions();
      if (!positions.includes(updates.position))
        return res.status(400).json({ error: `position must be one of: ${positions.join(', ')}` });
    }
  }

  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  } else {
    delete updates.password;
  }
  if (updates.hotelId) {
    const hotel = db.read('hotels.json').find(h => h.id === updates.hotelId);
    updates.hotelName = hotel?.name || null;
  }
  users[idx] = { ...users[idx], ...updates };
  db.write('users.json', users);
  res.json(omit(users[idx], 'password'));
});

app.put('/api/users/:id/deactivate', auth('admin'), (req, res) => {
  const users = db.read('users.json');
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users[idx].active = false;
  users[idx].deactivatedAt = new Date().toISOString();
  db.write('users.json', users);
  res.json({ ok: true });
});

app.put('/api/users/:id/activate', auth('admin'), (req, res) => {
  const users = db.read('users.json');
  const idx   = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users[idx].active = true;
  users[idx].deactivatedAt = null;
  db.write('users.json', users);
  res.json({ ok: true });
});

// ─── SHIFTS ──────────────────────────────────────────────────────────────────

// Check own active shift
app.get('/api/shifts/active', auth(), (req, res) => {
  const active = db.read('shifts.json')
    .find(s => s.userId === req.user.id && s.status === 'active');
  res.json(active || null);
});

// List shifts (scoped by role)
app.get('/api/shifts', auth(), (req, res) => {
  let shifts = db.read('shifts.json');
  const { role, id: uid, hotelId } = req.user;
  const { from, to, status, userId, hotelId: qHotel } = req.query;

  if (role === 'employee')         shifts = shifts.filter(s => s.userId === uid);
  else if (role === 'manager')     shifts = shifts.filter(s => s.hotelId === hotelId);
  else if (role === 'supervisor')  shifts = shifts.filter(s => s.hotelId === hotelId);

  if (from)    shifts = shifts.filter(s => s.startTime >= from);
  if (to)      shifts = shifts.filter(s => s.startTime <= to + 'T23:59:59.999Z');
  if (status)  shifts = shifts.filter(s => s.status === status);
  if (userId)  shifts = shifts.filter(s => s.userId === userId);
  if (qHotel && role !== 'employee') shifts = shifts.filter(s => s.hotelId === qHotel);

  shifts.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  res.json(shifts);
});

// Clock in
app.post('/api/shifts/start', auth('employee'), (req, res) => {
  const shifts = db.read('shifts.json');
  const { user } = req;

  const already = shifts.find(s => s.userId === user.id && s.status === 'active');
  if (already) return res.status(409).json({ error: 'You are already clocked in', shift: already });

  // Resolve position from the user record (JWT may be stale if admin re-tagged
  // the employee mid-session). Fall back to "Unassigned" so payroll always groups.
  const fresh = db.read('users.json').find(u => u.id === user.id);
  const stampPosition = fresh?.position || user.position || 'Unassigned';

  const shift = {
    id: uuidv4(),
    userId: user.id,     userName: user.name,
    hotelId: user.hotelId, hotelName: user.hotelName, subUnit: user.subUnit,
    position: stampPosition,
    startTime: new Date().toISOString(),
    endTime: null, totalMinutes: null,
    status: 'active',
    validated: false, validatedBy: null, validatedByName: null, validatedAt: null,
    isCorrection: false, correctionId: null,
    notes: '', editedBy: null, editedByName: null, editedAt: null,
    createdAt: new Date().toISOString()
  };
  shifts.push(shift);
  db.write('shifts.json', shifts);
  res.status(201).json(shift);
});

// Clock out
app.post('/api/shifts/end', auth('employee'), (req, res) => {
  const shifts = db.read('shifts.json');
  const idx = shifts.findIndex(s => s.userId === req.user.id && s.status === 'active');
  if (idx === -1) return res.status(404).json({ error: 'No active shift found' });

  const endTime      = new Date().toISOString();
  const totalMinutes = Math.round((new Date(endTime) - new Date(shifts[idx].startTime)) / 60000);
  shifts[idx] = { ...shifts[idx], endTime, totalMinutes, status: 'completed' };
  db.write('shifts.json', shifts);
  res.json(shifts[idx]);
});

// Edit shift (manager / admin)
app.put('/api/shifts/:id', auth('manager', 'admin'), (req, res) => {
  const shifts = db.read('shifts.json');
  const idx    = shifts.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Shift not found' });

  const { user } = req;
  if (user.role === 'manager' && shifts[idx].hotelId !== user.hotelId)
    return res.status(403).json({ error: 'Access denied' });

  const { startTime, endTime, notes } = req.body;
  const s = shifts[idx];
  const newStart = startTime || s.startTime;
  const newEnd   = endTime   || s.endTime;
  const mins     = newEnd ? Math.round((new Date(newEnd) - new Date(newStart)) / 60000) : s.totalMinutes;

  shifts[idx] = {
    ...s,
    startTime: newStart, endTime: newEnd, totalMinutes: mins,
    status:    newEnd ? (s.status === 'active' ? 'completed' : s.status) : s.status,
    notes:     notes ?? s.notes,
    editedBy:  user.id, editedByName: user.name, editedAt: new Date().toISOString()
  };
  db.write('shifts.json', shifts);
  res.json(shifts[idx]);
});

// Validate single shift
app.post('/api/shifts/:id/validate', auth('manager', 'admin'), (req, res) => {
  const shifts = db.read('shifts.json');
  const idx    = shifts.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Shift not found' });

  const { user } = req;
  if (user.role === 'manager' && shifts[idx].hotelId !== user.hotelId)
    return res.status(403).json({ error: 'Access denied' });

  shifts[idx] = {
    ...shifts[idx],
    status: 'validated', validated: true,
    validatedBy: user.id, validatedByName: user.name,
    validatedAt: new Date().toISOString()
  };
  db.write('shifts.json', shifts);
  res.json(shifts[idx]);
});

// Batch validate
app.post('/api/shifts/validate-batch', auth('manager', 'admin'), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });

  const shifts = db.read('shifts.json');
  const { user } = req;
  let count = 0;

  shifts.forEach((s, i) => {
    if (!ids.includes(s.id)) return;
    if (user.role === 'manager' && s.hotelId !== user.hotelId) return;
    if (s.status === 'validated' || s.status === 'active') return;
    shifts[i] = {
      ...s, status: 'validated', validated: true,
      validatedBy: user.id, validatedByName: user.name,
      validatedAt: new Date().toISOString()
    };
    count++;
  });

  db.write('shifts.json', shifts);
  res.json({ validated: count });
});

app.delete('/api/shifts/:id', auth('admin'), (req, res) => {
  db.write('shifts.json', db.read('shifts.json').filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

// ─── CORRECTIONS ─────────────────────────────────────────────────────────────

app.get('/api/corrections', auth(), (req, res) => {
  let list = db.read('corrections.json');
  const { role, id: uid, hotelId } = req.user;
  if (role === 'employee') list = list.filter(c => c.userId === uid);
  else if (role === 'manager') list = list.filter(c => c.hotelId === hotelId);
  else if (role === 'supervisor') list = list.filter(c => c.hotelId === hotelId);
  if (req.query.status) list = list.filter(c => c.status === req.query.status);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

app.post('/api/corrections', auth('employee'), (req, res) => {
  const { user } = req;
  const { date, requestedStart, requestedEnd, reason } = req.body;
  if (!date || !requestedStart || !requestedEnd || !reason)
    return res.status(400).json({ error: 'All fields are required' });

  const list = db.read('corrections.json');
  const item = {
    id: uuidv4(),
    userId: user.id, userName: user.name,
    hotelId: user.hotelId, hotelName: user.hotelName, subUnit: user.subUnit,
    date,
    requestedStart: `${date}T${requestedStart}:00.000Z`,
    requestedEnd:   `${date}T${requestedEnd}:00.000Z`,
    reason,
    status: 'pending',
    reviewedBy: null, reviewedByName: null, reviewedAt: null, reviewNotes: '',
    createdAt: new Date().toISOString()
  };
  list.push(item);
  db.write('corrections.json', list);
  res.status(201).json(item);
});

app.put('/api/corrections/:id/approve', auth('manager', 'admin'), (req, res) => {
  const list = db.read('corrections.json');
  const idx  = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { user } = req;
  const c = list[idx];
  if (user.role === 'manager' && c.hotelId !== user.hotelId)
    return res.status(403).json({ error: 'Access denied' });

  list[idx] = {
    ...c, status: 'approved',
    reviewedBy: user.id, reviewedByName: user.name,
    reviewedAt: new Date().toISOString(),
    reviewNotes: req.body.notes || ''
  };
  db.write('corrections.json', list);

  // Auto-create the corrected shift
  const shifts = db.read('shifts.json');
  const mins   = Math.round((new Date(c.requestedEnd) - new Date(c.requestedStart)) / 60000);
  // Re-read the employee so we tag the correction with their current position.
  const empNow = db.read('users.json').find(u => u.id === c.userId);
  shifts.push({
    id: uuidv4(),
    userId: c.userId, userName: c.userName,
    hotelId: c.hotelId, hotelName: c.hotelName, subUnit: c.subUnit,
    position: empNow?.position || 'Unassigned',
    startTime: c.requestedStart, endTime: c.requestedEnd,
    totalMinutes: mins, status: 'completed',
    validated: false, validatedBy: null, validatedByName: null, validatedAt: null,
    isCorrection: true, correctionId: c.id,
    notes: `Correction approved by ${user.name}. Reason: ${c.reason}`,
    editedBy: null, editedByName: null, editedAt: null,
    createdAt: new Date().toISOString()
  });
  db.write('shifts.json', shifts);

  res.json(list[idx]);
});

app.put('/api/corrections/:id/reject', auth('manager', 'admin'), (req, res) => {
  const list = db.read('corrections.json');
  const idx  = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { user } = req;
  if (user.role === 'manager' && list[idx].hotelId !== user.hotelId)
    return res.status(403).json({ error: 'Access denied' });

  list[idx] = {
    ...list[idx], status: 'rejected',
    reviewedBy: user.id, reviewedByName: user.name,
    reviewedAt: new Date().toISOString(),
    reviewNotes: req.body.notes || ''
  };
  db.write('corrections.json', list);
  res.json(list[idx]);
});

// ─── PAY PERIODS ─────────────────────────────────────────────────────────────

function buildPeriods(count = 10) {
  const base = new Date('2026-01-01T00:00:00.000Z');
  const now  = new Date();
  const cur  = Math.floor((now - base) / (14 * 86400000));
  const out  = [];
  for (let i = cur + 1; i >= Math.max(0, cur - count + 2); i--) {
    const start = new Date(base.getTime() + i * 14 * 86400000);
    const end   = new Date(start.getTime() + 14 * 86400000 - 1);
    const fmt   = d => d.toISOString().slice(0, 10);
    out.push({
      id: `P${String(i + 1).padStart(3, '0')}`,
      label: `${fmt(start)}  —  ${fmt(end)}`,
      start: start.toISOString(),
      end:   end.toISOString(),
      isCurrent: i === cur
    });
  }
  return out;
}

app.get('/api/payroll/periods', auth('accounting', 'admin', 'manager'), (_req, res) => {
  res.json(buildPeriods());
});

// Resolve the position to use for a given shift. Prefers the snapshot
// recorded on the shift itself (so historical reports stay correct even
// if an employee is later re-tagged); falls back to the current user record
// for older shifts that were created before this feature existed.
function shiftPosition(shift, usersById) {
  if (shift.position) return shift.position;
  const u = usersById[shift.userId];
  return u?.position || 'Unassigned';
}

app.get('/api/payroll/summary', auth('accounting', 'admin', 'manager'), (req, res) => {
  const { from, to, hotelId, position } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const { user } = req;
  let shifts = db.read('shifts.json').filter(s => s.status === 'validated' && s.endTime);

  if (user.role === 'manager') shifts = shifts.filter(s => s.hotelId === user.hotelId);
  if (hotelId) shifts = shifts.filter(s => s.hotelId === hotelId);
  shifts = shifts.filter(s => s.startTime >= from && s.startTime <= to + 'T23:59:59.999Z');

  const users  = db.read('users.json');
  const usersById = Object.fromEntries(users.map(u => [u.id, u]));

  // Apply position filter using the same resolution logic as the response,
  // so older un-stamped shifts still match correctly.
  if (position) {
    shifts = shifts.filter(s => shiftPosition(s, usersById) === position);
  }

  const byEmp     = {};
  const byHotel   = {};
  const byPosition = {};

  shifts.forEach(s => {
    const u   = usersById[s.userId];
    const pos = shiftPosition(s, usersById);

    if (!byEmp[s.userId]) {
      byEmp[s.userId] = {
        userId: s.userId, name: s.userName,
        hotelId: s.hotelId, hotelName: s.hotelName, subUnit: s.subUnit,
        position: pos,
        role: u?.role || 'employee', shifts: 0, minutes: 0
      };
    }
    byEmp[s.userId].shifts++;
    byEmp[s.userId].minutes += s.totalMinutes || 0;

    if (!byHotel[s.hotelId]) byHotel[s.hotelId] = { name: s.hotelName, shifts: 0, minutes: 0 };
    byHotel[s.hotelId].shifts++;
    byHotel[s.hotelId].minutes += s.totalMinutes || 0;

    if (!byPosition[pos]) byPosition[pos] = { position: pos, shifts: 0, minutes: 0 };
    byPosition[pos].shifts++;
    byPosition[pos].minutes += s.totalMinutes || 0;
  });

  res.json({
    from, to,
    filter: { hotelId: hotelId || null, position: position || null },
    totalShifts: shifts.length,
    totalMinutes: shifts.reduce((t, s) => t + (s.totalMinutes || 0), 0),
    byEmployee: Object.values(byEmp).sort((a, b) =>
      a.hotelName.localeCompare(b.hotelName) ||
      (a.position || '').localeCompare(b.position || '') ||
      a.name.localeCompare(b.name)),
    byHotel: Object.values(byHotel),
    byPosition: Object.values(byPosition).sort((a, b) =>
      a.position.localeCompare(b.position))
  });
});

// Excel export
app.get('/api/payroll/export/xlsx', auth('accounting', 'admin'), async (req, res) => {
  const ExcelJS = require('exceljs');
  const { from, to, hotelId, position } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const users  = db.read('users.json');
  const usersById = Object.fromEntries(users.map(u => [u.id, u]));
  let shifts = db.read('shifts.json').filter(s => s.status === 'validated' && s.endTime);
  shifts = shifts.filter(s => s.startTime >= from && s.startTime <= to + 'T23:59:59.999Z');
  if (hotelId) shifts = shifts.filter(s => s.hotelId === hotelId);
  if (position) shifts = shifts.filter(s => shiftPosition(s, usersById) === position);
  shifts.sort((a, b) =>
    a.hotelName.localeCompare(b.hotelName) ||
    shiftPosition(a, usersById).localeCompare(shiftPosition(b, usersById)) ||
    a.userName.localeCompare(b.userName));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Drivcoh Employees';

  // — Summary sheet —
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Employee',    key: 'name',     width: 24 },
    { header: 'Hotel',       key: 'hotel',    width: 26 },
    { header: 'Sub-unit',    key: 'sub',      width: 18 },
    { header: 'Position',    key: 'position', width: 16 },
    { header: 'Role',        key: 'role',     width: 14 },
    { header: 'Shifts',      key: 'shifts',   width: 8  },
    { header: 'Total Hours', key: 'hours',    width: 13 },
  ];
  const hRow = sum.getRow(1);
  hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3A5F' } };

  const byEmp = {};
  shifts.forEach(s => {
    const u   = usersById[s.userId];
    const pos = shiftPosition(s, usersById);
    if (!byEmp[s.userId]) byEmp[s.userId] = {
      name: s.userName, hotel: s.hotelName, sub: s.subUnit || '—',
      position: pos, role: u?.role || 'employee', shifts: 0, minutes: 0
    };
    byEmp[s.userId].shifts++;
    byEmp[s.userId].minutes += s.totalMinutes || 0;
  });
  Object.values(byEmp).forEach(e => sum.addRow({ ...e, hours: parseFloat((e.minutes / 60).toFixed(2)) }));

  // — Totals by position sheet —
  const pos = wb.addWorksheet('By Position');
  pos.columns = [
    { header: 'Position',    key: 'position', width: 22 },
    { header: 'Employees',   key: 'employees', width: 11 },
    { header: 'Shifts',      key: 'shifts',   width: 9  },
    { header: 'Total Hours', key: 'hours',    width: 13 },
  ];
  const pHead = pos.getRow(1);
  pHead.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  pHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3A5F' } };
  const byPos = {};
  Object.values(byEmp).forEach(e => {
    if (!byPos[e.position]) byPos[e.position] = { position: e.position, employees: 0, shifts: 0, minutes: 0 };
    byPos[e.position].employees++;
    byPos[e.position].shifts  += e.shifts;
    byPos[e.position].minutes += e.minutes;
  });
  Object.values(byPos)
    .sort((a, b) => a.position.localeCompare(b.position))
    .forEach(p => pos.addRow({ ...p, hours: parseFloat((p.minutes / 60).toFixed(2)) }));

  // — Detailed shifts sheet —
  const det = wb.addWorksheet('Detailed Shifts');
  det.columns = [
    { header: 'Employee',     key: 'name',     width: 24 },
    { header: 'Hotel',        key: 'hotel',    width: 26 },
    { header: 'Sub-unit',     key: 'sub',      width: 18 },
    { header: 'Position',     key: 'position', width: 16 },
    { header: 'Date',         key: 'date',     width: 12 },
    { header: 'Start',        key: 'start',    width: 10 },
    { header: 'End',          key: 'end',      width: 10 },
    { header: 'Hours',        key: 'hours',    width: 8  },
    { header: 'Validated By', key: 'val',      width: 20 },
    { header: 'Notes',        key: 'notes',    width: 32 },
  ];
  const dHead = det.getRow(1);
  dHead.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3A5F' } };

  const tf = iso => new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  shifts.forEach(s => det.addRow({
    name:  s.userName,     hotel: s.hotelName, sub: s.subUnit || '—',
    position: shiftPosition(s, usersById),
    date:  s.startTime.slice(0, 10), start: tf(s.startTime), end: tf(s.endTime),
    hours: parseFloat((s.totalMinutes / 60).toFixed(2)),
    val:   s.validatedByName || '—', notes: s.notes || ''
  }));

  const slug = position ? `-${position.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="payroll-${from}-to-${to}${slug}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// CSV export
app.get('/api/payroll/export/csv', auth('accounting', 'admin'), (req, res) => {
  const { from, to, hotelId, position } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const users = db.read('users.json');
  const usersById = Object.fromEntries(users.map(u => [u.id, u]));
  let shifts = db.read('shifts.json').filter(s => s.status === 'validated' && s.endTime);
  shifts = shifts.filter(s => s.startTime >= from && s.startTime <= to + 'T23:59:59.999Z');
  if (hotelId) shifts = shifts.filter(s => s.hotelId === hotelId);
  if (position) shifts = shifts.filter(s => shiftPosition(s, usersById) === position);
  shifts.sort((a, b) =>
    a.hotelName.localeCompare(b.hotelName) ||
    shiftPosition(a, usersById).localeCompare(shiftPosition(b, usersById)) ||
    a.userName.localeCompare(b.userName));

  const tf = iso => new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const rows = [['Employee', 'Hotel', 'Sub-unit', 'Position', 'Role', 'Date', 'Start', 'End', 'Hours', 'Validated By']];
  shifts.forEach(s => {
    const u = usersById[s.userId];
    rows.push([
      s.userName, s.hotelName, s.subUnit || '',
      shiftPosition(s, usersById),
      u?.role || 'employee',
      s.startTime.slice(0, 10), tf(s.startTime), tf(s.endTime),
      parseFloat((s.totalMinutes / 60).toFixed(2)),
      s.validatedByName || ''
    ]);
  });

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const slug = position ? `-${position.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="payroll-${from}-to-${to}${slug}.csv"`);
  res.send(csv);
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

app.get('/api/dashboard', auth(), (req, res) => {
  const { role, id: uid, hotelId } = req.user;
  let shifts = db.read('shifts.json');

  if (role === 'employee')         shifts = shifts.filter(s => s.userId === uid);
  else if (role === 'manager')     shifts = shifts.filter(s => s.hotelId === hotelId);
  else if (role === 'supervisor')  shifts = shifts.filter(s => s.hotelId === hotelId);

  const today   = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  res.json({
    activeNow:    shifts.filter(s => s.status === 'active').length,
    activeShifts: shifts.filter(s => s.status === 'active'),
    todayCount:   shifts.filter(s => s.startTime.startsWith(today)).length,
    pendingVal:   shifts.filter(s => s.status === 'completed').length,
    weekShifts:   shifts.filter(s => s.startTime >= weekAgo && s.endTime).length,
    weekMinutes:  shifts.filter(s => s.startTime >= weekAgo && s.endTime)
                        .reduce((t, s) => t + (s.totalMinutes || 0), 0),
    pendingCorrections: (role === 'manager' || role === 'admin')
      ? db.read('corrections.json').filter(c => c.status === 'pending' && (role === 'admin' || c.hotelId === hotelId)).length
      : 0
  });
});

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
// Idempotent. Only ever creates missing files / a missing first admin.
// Safe to run on every boot: existing data is never overwritten.

async function bootstrap() {
  if (!fs.existsSync(DATA)) {
    fs.mkdirSync(DATA, { recursive: true });
    console.log(`  Created data directory at ${DATA}`);
  }

  // Ensure each data file exists.
  for (const f of ['users.json', 'hotels.json', 'shifts.json', 'corrections.json']) {
    const fp = path.join(DATA, f);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, '[]');
  }

  // Seed positions list with sensible defaults the first time we boot.
  const positionsFp = path.join(DATA, 'positions.json');
  if (!fs.existsSync(positionsFp)) {
    fs.writeFileSync(positionsFp, JSON.stringify(
      ['Receptionist', 'Cleaner', 'Maintenance', 'Night Auditor', 'Other'],
      null, 2
    ));
  }

  // One-time migration: every user without a position gets "Unassigned" so
  // payroll/reports never have to deal with null values. This is idempotent —
  // users who already have a position keep it.
  {
    const usersForMigration = db.read('users.json');
    let touched = 0;
    usersForMigration.forEach(u => {
      if (u.position === undefined || u.position === null || u.position === '') {
        u.position = 'Unassigned';
        touched++;
      }
    });
    if (touched > 0) {
      // Make sure "Unassigned" is in the positions list so the dropdown shows it.
      const positions = db.read('positions.json');
      if (!positions.includes('Unassigned')) {
        positions.push('Unassigned');
        db.write('positions.json', positions);
      }
      db.write('users.json', usersForMigration);
      console.log(`  Migrated ${touched} user(s) to position="Unassigned".`);
    }
  }

  // Create initial admin only when the user table is empty.
  const users = db.read('users.json');
  if (users.length === 0) {
    const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe2026!';
    const hashed   = await bcrypt.hash(password, 10);
    users.push({
      id: uuidv4(),
      name: 'Administrator',
      email,
      password: hashed,
      role: 'admin',
      hotelId: null,
      hotelName: null,
      subUnit: null,
      position: null,
      active: true,
      createdAt: new Date().toISOString(),
      deactivatedAt: null,
    });
    db.write('users.json', users);
    console.log('  Initial admin created — sign in with the credentials above, then change the password from My Account.');
    console.log(`  Email:    ${email}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log(`  Password: ${password}   (set ADMIN_PASSWORD env to override)`);
    }
  }
}

// ─── START ───────────────────────────────────────────────────────────────────

bootstrap().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const ips = Object.values(require('os').networkInterfaces()).flat()
      .filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
    console.log('\n  Drivcoh Employees — Payroll Platform');
    console.log(`  Local:   http://localhost:${PORT}`);
    ips.forEach(ip => console.log(`  Network: http://${ip}:${PORT}`));
    console.log(`  Data:    ${DATA}`);
    console.log('');
  });
}).catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
