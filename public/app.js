'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let currentRoute = '';
let clockTimer   = null;
let timerElem    = null;
let activeShift  = null;
let weekOffset   = 0;

// ─── Auth ─────────────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('htp_token');
const getUser  = () => { try { return JSON.parse(localStorage.getItem('htp_user')); } catch { return null; } };

function signOut() {
  localStorage.removeItem('htp_token');
  localStorage.removeItem('htp_user');
  window.location.href = '/login';
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  if (res.status === 401) { signOut(); return; }
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

const GET    = url        => api('GET',    url);
const POST   = (url, b)  => api('POST',   url, b);
const PUT    = (url, b)  => api('PUT',    url, b);
const DELETE = url        => api('DELETE', url);

// ─── Navigation & routing ─────────────────────────────────────────────────────

const NAV_ICONS = {
  clock:       '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.2 1.4"/></svg>',
  timesheet:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5 2v3M11 2v3"/></svg>',
  correction:  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.4 2.6l2 2-8 8H3v-2.4l8.4-7.6z"/></svg>',
  overview:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5" height="6" rx="1"/><rect x="9" y="2" width="5" height="3.5" rx="1"/><rect x="9" y="7" width="5" height="7" rx="1"/><rect x="2" y="10" width="5" height="4" rx="1"/></svg>',
  shifts:      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h9M5 8h9M5 12h9"/><circle cx="2.5" cy="4" r=".7" fill="currentColor"/><circle cx="2.5" cy="8" r=".7" fill="currentColor"/><circle cx="2.5" cy="12" r=".7" fill="currentColor"/></svg>',
  validate:    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5.5 8.2l1.8 1.8L11 6.5"/></svg>',
  corrections: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3.5h10v7.5H7l-3 2.5v-2.5H3z"/></svg>',
  employees:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5.5" r="2.4"/><path d="M2 13c0-2.3 1.8-3.8 4-3.8s4 1.5 4 3.8"/><path d="M11 4.5a2.2 2.2 0 010 4M14 13c0-2-1.4-3.4-3.2-3.7"/></svg>',
  payroll:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M2 7h12M5 10.5h2"/></svg>',
  analytics:   '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5l3.5-4 3 2.5 3.5-6 2 3"/><path d="M2 14h12"/></svg>',
  account:     '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="6" r="2.6"/><path d="M3 13.5c.7-2.3 2.7-3.4 5-3.4s4.3 1.1 5 3.4"/></svg>',
};

const NAV = {
  employee: [
    { route: 'clock',      label: 'Clock In / Out' },
    { route: 'timesheet',  label: 'My Timesheet' },
    { route: 'correction', label: 'Request Correction' },
    { route: 'account',    label: 'My Account' },
  ],
  manager: [
    { route: 'overview',    label: 'Overview' },
    { route: 'shifts',      label: 'Shifts' },
    { route: 'employees',   label: 'Employees' },
    { route: 'validate',    label: 'Validate Hours' },
    { route: 'corrections', label: 'Corrections', badge: 'pending_corrections' },
    { route: 'payroll',     label: 'Payroll' },
    { route: 'analytics',   label: 'Analyse' },
    { route: 'clock',       label: 'Clock In / Out' },
    { route: 'account',     label: 'My Account' },
  ],
  // Supervisor: can now create employees, edit/validate shifts at their hotel.
  supervisor: [
    { route: 'overview',    label: 'Overview' },
    { route: 'shifts',      label: 'Shifts' },
    { route: 'validate',    label: 'Validate Hours' },
    { route: 'employees',   label: 'Employees' },
    { route: 'corrections', label: 'Corrections', badge: 'pending_corrections' },
    { route: 'clock',       label: 'Clock In / Out' },
    { route: 'account',     label: 'My Account' },
  ],
  admin: [
    { route: 'employees',   label: 'Employees' },
    { route: 'overview',    label: 'Overview' },
    { route: 'shifts',      label: 'All Shifts' },
    { route: 'validate',    label: 'Validate Hours' },
    { route: 'corrections', label: 'Corrections' },
    { route: 'payroll',     label: 'Payroll' },
    { route: 'analytics',   label: 'Analyse' },
    { route: 'account',     label: 'My Account' },
  ],
  accounting: [
    { route: 'payroll',    label: 'Payroll' },
    { route: 'analytics',  label: 'Analyse' },
    { route: 'account',    label: 'My Account' },
  ],
};

const PAGE_TITLES = {
  clock: 'Clock In / Out', timesheet: 'My Timesheet', correction: 'Request Correction',
  overview: 'Overview', shifts: 'Shifts', validate: 'Validate Hours',
  corrections: 'Corrections', employees: 'Employees', payroll: 'Payroll',
  analytics: 'Analyse', account: 'My Account'
};

const DEFAULT_ROUTE = {
  employee:   'clock',
  manager:    'overview',
  supervisor: 'overview',
  admin:      'employees',
  accounting: 'payroll'
};

function navigate(route) {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  currentRoute = route;

  document.getElementById('page-title').textContent = PAGE_TITLES[route] || '';
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.route === route));

  const body = document.getElementById('page-body');
  body.innerHTML = '<div class="empty-state text-muted">Loading...</div>';
  document.getElementById('topbar-actions').innerHTML = '';

  const user = getUser();
  const renders = {
    clock:       renderClock,
    timesheet:   renderTimesheet,
    correction:  renderCorrectionPage,
    overview:    renderOverview,
    shifts:      renderShifts,
    validate:    renderValidate,
    corrections: renderCorrections,
    employees:   renderEmployees,
    payroll:     renderPayroll,
    analytics:   renderAnalytics,
    account:     renderAccount,
  };
  if (renders[route]) renders[route](user);
}

function renderSidebar(pendingCount = 0) {
  const user = getUser();
  if (!user) return;

  // Nav
  const items = NAV[user.role] || [];
  document.getElementById('sidebar-nav').innerHTML = items.map(item => {
    const badgeHtml = item.badge && pendingCount > 0
      ? `<span class="nav-badge">${pendingCount}</span>` : '';
    const icon = NAV_ICONS[item.route] || '';
    return `<button class="nav-item" data-route="${item.route}">
      <span class="nav-icon">${icon}</span>
      <span class="nav-label">${esc(item.label)}</span>
      ${badgeHtml}
    </button>`;
  }).join('');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      closeSidebar();
      navigate(btn.dataset.route);
    });
  });

  // User card
  document.getElementById('user-card').innerHTML = `
    <div class="user-card-name">${esc(user.name)}</div>
    <div class="user-card-role">${esc(user.role)}</div>
    ${user.hotelName ? `<div class="user-card-hotel">${esc(user.hotelName)}${user.subUnit ? ' — ' + esc(user.subUnit) : ''}</div>` : ''}
  `;

  document.getElementById('btn-signout').addEventListener('click', signOut);
}

// Mobile sidebar
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
});
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  if (!getToken()) { window.location.href = '/login'; return; }
  try {
    const user = await GET('/api/auth/me');
    localStorage.setItem('htp_user', JSON.stringify(user));
    document.getElementById('app').style.display = 'flex';

    // Load pending corrections count for badge
    let pending = 0;
    if (user.role === 'manager' || user.role === 'admin' || user.role === 'supervisor') {
      try {
        const dash = await GET('/api/dashboard');
        pending = dash.pendingCorrections || 0;
      } catch {}
    }
    renderSidebar(pending);
    navigate(DEFAULT_ROUTE[user.role] || 'clock');

    // Check for forgotten clock-outs on login and every 10 minutes
    checkLongRunningShifts(user);
    setInterval(() => checkLongRunningShifts(getUser()), 10 * 60 * 1000);
  } catch {
    signOut();
  }
}

// ─── Long-running shift banner (forgotten clock-outs) ─────────────────────────
async function checkLongRunningShifts(user) {
  if (!user) return;
  try {
    const threshold = 8; // hours
    const list = await GET(`/api/shifts/long-running?threshold=${threshold}`);
    const banner = document.getElementById('long-run-banner');
    if (!list || list.length === 0) {
      if (banner) banner.remove();
      return;
    }
    const existing = document.getElementById('long-run-banner');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'long-run-banner';
    el.className = 'long-run-banner';

    if (user.role === 'employee' || user.role === 'supervisor') {
      // Own forgotten shift
      const s = list[0];
      const h = s.hoursElapsed.toFixed(1);
      el.innerHTML = `
        <div class="long-run-inner">
          <span class="long-run-icon">⏰</span>
          <div class="long-run-text">
            <strong>As-tu oublié de te dépointer ?</strong>
            <span>Tu es pointé(e) depuis <strong>${h}h</strong> à ${esc(s.hotelName || '')}${s.subUnit ? ' · ' + esc(s.subUnit) : ''}.</span>
          </div>
          <button class="long-run-btn" onclick="doClockOut();document.getElementById('long-run-banner').remove()">Se dépointer maintenant</button>
          <button class="long-run-dismiss" onclick="this.closest('#long-run-banner').remove()" title="Dismiss">✕</button>
        </div>`;
    } else {
      // Manager/admin: list all long-running shifts
      el.innerHTML = `
        <div class="long-run-inner">
          <span class="long-run-icon">⚠️</span>
          <div class="long-run-text">
            <strong>${list.length} shift${list.length > 1 ? 's' : ''} ouvert${list.length > 1 ? 's' : ''} depuis plus de ${threshold}h</strong>
            <span>${list.map(s => `${esc(s.userName)} (${s.hoursElapsed.toFixed(1)}h — ${esc(s.hotelName || '')}${s.subUnit ? ' · ' + esc(s.subUnit) : ''})`).join(' · ')}</span>
          </div>
          <button class="long-run-dismiss" onclick="this.closest('#long-run-banner').remove()" title="Dismiss">✕</button>
        </div>`;
    }

    // Insert banner just before the page-body (after the topbar)
    const pageBody = document.getElementById('page-body');
    pageBody.parentElement.insertBefore(el, pageBody);
  } catch {}
}

document.addEventListener('DOMContentLoaded', init);

// ─── Modal helpers ────────────────────────────────────────────────────────────
function showModal(html) {
  const box = document.getElementById('modal-box');
  box.innerHTML = html;
  box.className = 'modal';
  document.getElementById('modal-overlay').style.display = 'flex';
}
function showModalLg(html) {
  showModal(html);
  document.getElementById('modal-box').className = 'modal modal-lg';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast-area').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'2-digit' });
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-CA', { hour:'2-digit', minute:'2-digit', hour12: false });
}
function fmtDur(mins) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2,'0')}m` : `${m}m`;
}
function fmtDurH(mins) {
  return mins != null ? (mins / 60).toFixed(2) + 'h' : '—';
}
function toLocalDTInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function today() { return new Date().toISOString().slice(0, 10); }
function badgeFor(status) {
  const map = { active:'active', completed:'completed', validated:'validated', rejected:'rejected',
                pending:'pending', approved:'approved' };
  return `<span class="badge badge-${map[status]||'completed'}">${esc(status)}</span>`;
}
function roleBadge(role) {
  return `<span class="badge badge-${role||'employee'}">${esc(role||'employee')}</span>`;
}

// GPS flag badge displayed in the Validate table so managers see off-site alerts.
function geoBadgeClass(shift) {
  const f = shift.geoFlag;
  if (!f || f === 'ok' || f === 'no_gps' || f === 'no_coords') return 'geo-ok';
  if (f === 'roaming') return 'geo-roaming';
  return 'geo-warn'; // off_site | unknown_location
}
function geoBadgeHtml(shift) {
  const f = shift.geoFlag;
  if (!f || f === 'no_gps' || f === 'no_coords') {
    return `<span class="geo-badge geo-badge-none" title="Pas de vérification GPS">—</span>`;
  }
  if (f === 'ok') {
    return `<span class="geo-badge geo-badge-ok" title="À la propriété assignée">✓ Site</span>`;
  }
  if (f === 'roaming') {
    const sub = shift.geoDetectedSubUnit ? ` (${shift.geoDetectedSubUnit})` : '';
    return `<span class="geo-badge geo-badge-roaming" title="Support LCPP${sub}">↔ LCPP${sub}</span>`;
  }
  if (f === 'off_site') {
    const where = shift.geoDetectedHotel || 'autre site';
    const dist  = shift.geoDistance ? ` · ${shift.geoDistance} m` : '';
    return `<span class="geo-badge geo-badge-warn" title="A pointé depuis ${where}${dist}">⚠ ${esc(where)}${dist}</span>`;
  }
  if (f === 'unknown_location') {
    const dist = shift.geoDistance ? ` · ${shift.geoDistance} m` : '';
    return `<span class="geo-badge geo-badge-warn" title="Position inconnue${dist}">⚠ Hors site${dist}</span>`;
  }
  return `<span class="geo-badge geo-badge-none">—</span>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYEE PAGES
// ═══════════════════════════════════════════════════════════════════════════

async function renderClock(user) {
  const body = document.getElementById('page-body');

  const now  = new Date();
  const date = now.toLocaleDateString('fr-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  body.innerHTML = `
    <div class="clock-page">
      <div class="clock-now">
        <div class="clock-date" style="font-size:15px;font-weight:600;color:var(--gray-700);text-transform:capitalize">${date}</div>
        <div style="font-size:13px;color:var(--gray-400);margin-top:4px">${esc(user.hotelName || '')}${user.subUnit ? ' — ' + esc(user.subUnit) : ''}</div>
      </div>
      <div id="shift-area"><div class="empty-state text-muted">Vérification...</div></div>
      <div id="recent-area"></div>
    </div>`;

  try { activeShift = await GET('/api/shifts/active'); } catch { activeShift = null; }
  renderShiftArea(user);
  loadRecentShifts(user.id);
}

function renderShiftArea(user) {
  const area = document.getElementById('shift-area');
  if (!area) return;

  if (activeShift) {
    // Employee has arrived — waiting to depart
    area.innerHTML = `
      <div style="background:var(--blue-lt);border:1px solid var(--blue-mid);border-radius:var(--radius);padding:20px;text-align:center;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--blue);margin-bottom:8px">Arrivée enregistrée</div>
        <div style="font-size:32px;font-weight:800;color:var(--gray-900);letter-spacing:-1px">${fmtTime(activeShift.startTime)}</div>
        <div style="font-size:13px;color:var(--gray-500);margin-top:4px">${fmtDate(activeShift.startTime)}</div>
      </div>
      <button class="clock-btn clock-btn-out" id="btn-depart">Départ</button>
    `;
    document.getElementById('btn-depart').addEventListener('click', doClockOut);
  } else {
    // Check if employee already completed a shift today
    const todayStr = new Date().toISOString().slice(0, 10);
    area.innerHTML = `<div id="today-check"><div class="empty-state text-muted" style="padding:16px">Chargement...</div></div>
      <button class="clock-btn clock-btn-in" id="btn-arrivee"${!user.hotelId ? ' disabled' : ''}>Arrivée</button>
      ${!user.hotelId ? '<p class="text-muted text-sm" style="text-align:center;margin-top:8px">Aucun hôtel assigné. Contactez votre administrateur.</p>' : ''}`;
    if (user.hotelId) document.getElementById('btn-arrivee').addEventListener('click', doClockIn);
    checkTodayShift(user.id);
  }
}

async function checkTodayShift(userId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const el = document.getElementById('today-check');
  if (!el) return;
  try {
    const shifts = await GET(`/api/shifts?from=${todayStr}&to=${todayStr}`);
    const done   = shifts.find(s => s.endTime && s.startTime.startsWith(todayStr));
    if (done) {
      el.innerHTML = `
        <div style="background:var(--green-lt);border:1px solid #bbf7d0;border-radius:var(--radius);padding:16px;text-align:center;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--green);margin-bottom:6px">Journée terminée</div>
          <div style="font-size:22px;font-weight:800;color:var(--gray-900)">${fmtTime(done.startTime)} — ${fmtTime(done.endTime)}</div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:4px">${fmtDur(done.totalMinutes)} travaillés · ${badgeFor(done.status)}</div>
        </div>`;
      // Disable the Arrivée button if already done today
      const btn = document.getElementById('btn-arrivee');
      if (btn) { btn.disabled = true; btn.style.opacity = '.4'; btn.title = 'Shift déjà complété aujourd\'hui'; }
    } else {
      el.innerHTML = `
        <div style="border:1px solid var(--gray-200);border-radius:var(--radius);padding:16px;text-align:center;margin-bottom:16px;color:var(--gray-400)">
          <div style="font-size:13px">Pas encore arrivé aujourd'hui.</div>
        </div>`;
    }
  } catch { el.innerHTML = ''; }
}

// ── Geolocation utilities (client-side mirror of server logic) ────────────────

// Wraps navigator.geolocation as a Promise.
function requestGPS(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) { reject(new Error('unavailable')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 90000 }
    );
  });
}

// Haversine distance in metres (same formula as server).
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Client-side geo verdict (mirrors server's computeGeoVerdict).
// Used to show a pre-confirmation dialog before sending to server.
function clientGeoVerdict(lat, lng, userHotel, userSubUnit, allHotels) {
  if (!userHotel) return { type: 'no_coords' };

  let assignedCoords = null;
  if (userHotel.isGroup && userSubUnit && userHotel.subUnitCoordinates?.[userSubUnit]) {
    assignedCoords = userHotel.subUnitCoordinates[userSubUnit];
  } else if (!userHotel.isGroup && userHotel.coordinates) {
    assignedCoords = userHotel.coordinates;
  }
  if (!assignedCoords) return { type: 'no_coords' };

  const distToAssigned = Math.round(haversineM(lat, lng, assignedCoords.lat, assignedCoords.lng));
  if (distToAssigned <= (assignedCoords.radius || 200))
    return { type: 'ok', distance: distToAssigned };

  // LCPP: employee rotates freely among all sub-units
  if (userHotel.isGroup && userHotel.subUnitCoordinates) {
    for (const [suName, suC] of Object.entries(userHotel.subUnitCoordinates)) {
      if (suName === userSubUnit) continue;
      if (Math.round(haversineM(lat, lng, suC.lat, suC.lng)) <= (suC.radius || 200))
        return { type: 'roaming', distance: distToAssigned, detectedSubUnit: suName };
    }
  }

  // Check all other hotels
  let nearest = null, nearestDist = Infinity;
  for (const h of (allHotels || [])) {
    if (h.id === userHotel.id) continue;
    if (h.isGroup && h.subUnitCoordinates) {
      for (const [suName, suC] of Object.entries(h.subUnitCoordinates)) {
        const d = Math.round(haversineM(lat, lng, suC.lat, suC.lng));
        if (d < nearestDist) { nearestDist = d; nearest = { name: `${h.name} — ${suName}`, r: suC.radius || 200 }; }
      }
    } else if (h.coordinates) {
      const d = Math.round(haversineM(lat, lng, h.coordinates.lat, h.coordinates.lng));
      if (d < nearestDist) { nearestDist = d; nearest = { name: h.name, r: h.coordinates.radius || 200 }; }
    }
  }
  if (nearest && nearestDist <= nearest.r)
    return { type: 'off_site', distance: distToAssigned, detectedHotelName: nearest.name, detectedDistance: nearestDist };

  return { type: 'unknown_location', distance: distToAssigned };
}

// Shows a confirmation modal when the employee is not at their assigned property.
// Returns a Promise<boolean> (true = proceed, false = cancel).
function showGeoConfirmModal(verdict, assignedName) {
  return new Promise(resolve => {
    const isOffSite = verdict.type === 'off_site';
    const body = isOffSite
      ? `<p style="margin-bottom:8px">Vous semblez être à <strong>${esc(verdict.detectedHotelName)}</strong>, non à votre propriété assignée (<strong>${esc(assignedName)}</strong>).</p>
         <p class="text-muted text-sm">Distance estimée depuis votre propriété : <strong>${verdict.distance} m</strong></p>`
      : `<p style="margin-bottom:8px">Vous n'êtes pas détecté à proximité de votre propriété assignée (<strong>${esc(assignedName)}</strong>).</p>
         <p class="text-muted text-sm">Distance estimée : <strong>${verdict.distance} m</strong></p>`;

    showModal(`
      <div class="modal-head" style="display:flex;align-items:center;gap:8px">
        <span style="font-size:20px">📍</span> Pointage hors site
      </div>
      <div class="modal-body">
        ${body}
        <div class="geo-confirm-box">
          Êtes-vous en déplacement de support ? Avez-vous informé votre manager ou superviseur ?
        </div>
      </div>
      <div class="modal-foot" style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-secondary" id="geo-cancel">Annuler</button>
        <button class="btn btn-primary"   id="geo-confirm">Pointer quand même</button>
      </div>`);

    document.getElementById('geo-confirm').addEventListener('click', () => { closeModal(); resolve(true); });
    document.getElementById('geo-cancel').addEventListener('click',  () => { closeModal(); resolve(false); });
  });
}

async function doClockIn() {
  const btn  = document.getElementById('btn-arrivee');
  const user = getUser();
  btn.disabled = true;

  // ── Step 1: request GPS ──────────────────────────────────────────────────
  btn.textContent = 'Localisation…';
  let gpsCoords   = null;
  let gpsNote     = null;

  try {
    const pos = await requestGPS();
    gpsCoords = { lat: pos.lat, lng: pos.lng };
    if (pos.accuracy > 150) gpsNote = `Précision GPS faible (±${Math.round(pos.accuracy)} m).`;
  } catch (err) {
    const denied = err?.code === 1;
    gpsNote = denied
      ? 'Localisation refusée — GPS désactivé. Votre manager peut demander une vérification.'
      : 'GPS non disponible. Le pointage sera enregistré sans vérification de position.';
  }

  // ── Step 2: if off-site, ask for confirmation ────────────────────────────
  if (gpsCoords) {
    try {
      const hotels    = await GET('/api/hotels');
      const userHotel = hotels.find(h => h.id === user.hotelId);
      const verdict   = clientGeoVerdict(gpsCoords.lat, gpsCoords.lng, userHotel, user.subUnit, hotels);

      if (verdict.type === 'roaming') {
        // LCPP internal movement — allowed silently, brief info after clock-in
        gpsNote = `Support ${esc(verdict.detectedSubUnit)} enregistré.`;
      } else if (verdict.type === 'off_site' || verdict.type === 'unknown_location') {
        const assignedName = user.subUnit || user.hotelName || 'votre propriété';
        const confirmed = await showGeoConfirmModal(verdict, assignedName);
        if (!confirmed) {
          btn.disabled = false; btn.textContent = 'Arrivée'; return;
        }
        gpsNote = verdict.type === 'off_site'
          ? `Pointage enregistré depuis ${esc(verdict.detectedHotelName)} — votre manager sera informé.`
          : 'Pointage enregistré hors site — votre manager sera informé.';
      }
    } catch { /* hotels fetch failed — skip client-side check, server will handle */ }
  }

  // ── Step 3: POST to server ───────────────────────────────────────────────
  btn.textContent = 'Enregistrement…';
  try {
    activeShift = await POST('/api/shifts/start', gpsCoords || {});
    if (gpsNote) toast(gpsNote, gpsNote.includes('manager') ? 'warn' : 'ok');
    toast('Arrivée enregistrée ✓', 'ok');
    renderShiftArea(getUser());
    checkLongRunningShifts(getUser()); // refresh banner
  } catch (e) {
    toast(e?.error || 'Impossible d\'enregistrer l\'arrivée.', 'err');
    btn.disabled = false; btn.textContent = 'Arrivée';
  }
}

async function doClockOut() {
  if (!confirm('Confirmer votre départ ?')) return;
  const btn = document.getElementById('btn-depart');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  try {
    const done = await POST('/api/shifts/end', {});
    activeShift = null;
    toast(`Départ enregistré — ${fmtDur(done.totalMinutes)} travaillés.`, 'ok');
    renderShiftArea(getUser());
    loadRecentShifts(getUser().id);
  } catch (e) {
    toast(e.error || 'Impossible d\'enregistrer le départ.', 'err');
    btn.disabled = false; btn.textContent = 'Départ';
  }
}

async function loadRecentShifts(userId) {
  const area = document.getElementById('recent-area');
  if (!area) return;
  try {
    const shifts = await GET(`/api/shifts?userId=${userId}`);
    const done   = shifts.filter(s => s.endTime).slice(0, 6);
    if (done.length === 0) { area.innerHTML = ''; return; }
    area.innerHTML = `
      <div class="card mt16">
        <div class="card-head">Recent Shifts</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>
              ${done.map(s => `
                <tr>
                  <td>${fmtDate(s.startTime)}</td>
                  <td>${fmtTime(s.startTime)}</td>
                  <td>${fmtTime(s.endTime)}</td>
                  <td class="fw600">${fmtDur(s.totalMinutes)}</td>
                  <td>${badgeFor(s.status)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch {}
}

// ── Timesheet ─────────────────────────────────────────────────────────────────
async function renderTimesheet() {
  const body = document.getElementById('page-body');
  body.innerHTML = `
    <div class="week-nav">
      <button class="week-btn" id="week-prev">Previous</button>
      <div class="week-label" id="week-label"></div>
      <button class="week-btn" id="week-next" ${weekOffset >= 0 ? 'disabled' : ''}>Next</button>
    </div>
    <div class="card">
      <div class="table-wrap" id="timesheet-table"><div class="empty-state text-muted">Loading...</div></div>
    </div>`;

  document.getElementById('week-prev').addEventListener('click', () => { weekOffset--; renderTimesheetData(); });
  document.getElementById('week-next').addEventListener('click', () => { if (weekOffset < 0) { weekOffset++; renderTimesheetData(); } });
  renderTimesheetData();
}

async function renderTimesheetData() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + weekOffset * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6); sun.setHours(23, 59, 59, 999);

  const fmt = d => d.toLocaleDateString('en-CA', { month:'short', day:'numeric' });
  document.getElementById('week-label').textContent = `${fmt(mon)} — ${fmt(sun)}`;
  document.getElementById('week-next').disabled = weekOffset >= 0;

  const from = mon.toISOString().slice(0, 10);
  const to   = sun.toISOString().slice(0, 10);

  try {
    const shifts = await GET(`/api/shifts?from=${from}&to=${to}`);
    const days   = [];
    for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(d.getDate() + i); days.push(d); }

    const todayStr = new Date().toISOString().slice(0, 10);
    let totalMins  = 0;

    const rows = days.map(d => {
      const ds   = d.toISOString().slice(0, 10);
      const hits = shifts.filter(s => s.startTime.startsWith(ds));
      hits.forEach(s => { totalMins += s.totalMinutes || 0; });
      const isToday = ds === todayStr;
      const dayLabel = d.toLocaleDateString('en-CA', { weekday:'short', month:'short', day:'numeric' });

      if (hits.length === 0) {
        return `<tr><td><div class="timesheet-day-header${isToday?' today':''}">${dayLabel}</div></td><td colspan="3" class="text-muted text-sm">—</td></tr>`;
      }
      return hits.map((s, idx) => `
        <tr>
          ${idx === 0 ? `<td rowspan="${hits.length}"><div class="timesheet-day-header${isToday?' today':''}">${dayLabel}</div></td>` : ''}
          <td>${fmtTime(s.startTime)}</td>
          <td>${s.endTime ? fmtTime(s.endTime) : '<span class="dot-live"></span> active'}</td>
          <td><span class="timesheet-hours">${fmtDur(s.totalMinutes)}</span>&nbsp;${badgeFor(s.status)}</td>
        </tr>`).join('');
    });

    document.getElementById('timesheet-table').innerHTML = `
      <table>
        <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Duration</th></tr></thead>
        <tbody>
          ${rows.join('')}
          <tr class="timesheet-total-row">
            <td class="fw600">Week Total</td>
            <td colspan="2"></td>
            <td class="fw600">${fmtDur(totalMins)}</td>
          </tr>
        </tbody>
      </table>`;
  } catch {
    document.getElementById('timesheet-table').innerHTML = '<div class="empty-state text-muted">Error loading timesheet.</div>';
  }
}

// ── Correction request ────────────────────────────────────────────────────────
async function renderCorrectionPage() {
  const body = document.getElementById('page-body');
  body.innerHTML = `
    <div style="max-width:520px">
      <div class="card mb12">
        <div class="card-head">Request a Shift Correction</div>
        <div class="card-body">
          <p class="text-muted text-sm mb12">Use this form if you forgot to clock in or out. Your manager will review the request.</p>
          <div class="form-grid">
            <div class="form-group span2"><label>Date of the missed shift *</label>
              <input class="form-control" type="date" id="cr-date" max="${today()}" value="${today()}"></div>
            <div class="form-group"><label>Start time *</label>
              <input class="form-control" type="time" id="cr-start" value="09:00"></div>
            <div class="form-group"><label>End time *</label>
              <input class="form-control" type="time" id="cr-end" value="17:00"></div>
            <div class="form-group span2"><label>Reason *</label>
              <textarea class="form-control" id="cr-reason" placeholder="Explain why the correction is needed..."></textarea></div>
          </div>
          <div class="mt16">
            <button class="btn btn-primary" id="btn-submit-correction">Submit Request</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">My Correction Requests</div>
        <div class="table-wrap" id="my-corrections"><div class="empty-state text-muted">Loading...</div></div>
      </div>
    </div>`;

  document.getElementById('btn-submit-correction').addEventListener('click', submitCorrection);
  loadMyCorrections();
}

async function submitCorrection() {
  const date   = document.getElementById('cr-date').value;
  const start  = document.getElementById('cr-start').value;
  const end    = document.getElementById('cr-end').value;
  const reason = document.getElementById('cr-reason').value.trim();
  if (!date || !start || !end || !reason) { toast('All fields are required.', 'err'); return; }
  if (start >= end) { toast('End time must be after start time.', 'err'); return; }

  const btn = document.getElementById('btn-submit-correction');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    await POST('/api/corrections', { date, requestedStart: start, requestedEnd: end, reason });
    toast('Correction request submitted.', 'ok');
    document.getElementById('cr-reason').value = '';
    loadMyCorrections();
  } catch (e) {
    toast(e.error || 'Could not submit.', 'err');
  }
  btn.disabled = false; btn.textContent = 'Submit Request';
}

async function loadMyCorrections() {
  const el = document.getElementById('my-corrections');
  if (!el) return;
  try {
    const list = await GET('/api/corrections');
    if (list.length === 0) { el.innerHTML = '<div class="empty-state text-muted">No requests yet.</div>'; return; }
    el.innerHTML = `<table>
      <thead><tr><th>Date</th><th>Requested</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${list.map(c => `
        <tr>
          <td>${esc(c.date)}</td>
          <td>${fmtTime(c.requestedStart)} — ${fmtTime(c.requestedEnd)}</td>
          <td>${badgeFor(c.status)}</td>
          <td class="text-muted text-sm">${esc(c.reviewNotes || '—')}</td>
        </tr>`).join('')}</tbody>
    </table>`;
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// MANAGER PAGES
// ═══════════════════════════════════════════════════════════════════════════

// Per-hotel filter state for the Currently On Shift table.
let overviewDashboard = null;
let overviewHotelFilter = null;

async function renderOverview(user) {
  const body = document.getElementById('page-body');
  try {
    const d = await GET('/api/dashboard');
    overviewDashboard = d;
    // Clear stale filter if the chosen hotel no longer has any shifts visible.
    if (overviewHotelFilter && !(d.activeByHotel || []).some(h => h.hotelId === overviewHotelFilter)) {
      overviewHotelFilter = null;
    }

    body.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card green"><div class="stat-value">${d.activeNow}</div><div class="stat-label">On Shift Now</div></div>
        <div class="stat-card blue"><div class="stat-value">${d.todayCount}</div><div class="stat-label">Today's Shifts</div></div>
        <div class="stat-card amber"><div class="stat-value">${d.pendingVal}</div><div class="stat-label">Pending Validation</div></div>
        <div class="stat-card"><div class="stat-value">${fmtDurH(d.weekMinutes)}</div><div class="stat-label">This Week</div></div>
      </div>

      ${(d.activeByHotel && d.activeByHotel.length > 0) ? `
        <div class="card mb12 prop-filter-card">
          <div class="prop-filter-header">
            <div class="prop-filter-title">
              ${d.activeNow > 0 ? '<span class="dot-live"></span>' : ''}
              Active by Property
            </div>
            <div class="prop-filter-hint">Select a property to filter the shifts below</div>
          </div>
          <div class="prop-filter-grid" id="ov-hotel-grid">
            <button class="prop-filter-item ${overviewHotelFilter === null ? 'is-selected' : ''}" onclick="setOverviewHotelFilter(null)">
              <div class="prop-filter-left">
                <div class="prop-filter-icon">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="12" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/><path d="M8 10v2"/></svg>
                </div>
                <span class="prop-filter-name">All Properties</span>
              </div>
              <div class="prop-filter-count ${d.activeNow > 0 ? 'is-live' : ''}">
                ${d.activeNow > 0 ? '<span class="prop-live-dot"></span>' : ''}
                <span>${d.activeNow}</span>
              </div>
            </button>
            ${d.activeByHotel.map(h => `
              <button class="prop-filter-item ${overviewHotelFilter === h.hotelId ? 'is-selected' : ''} ${h.count > 0 ? 'has-staff' : ''}"
                   onclick="setOverviewHotelFilter('${h.hotelId}')">
                <div class="prop-filter-left">
                  <div class="prop-filter-icon">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="10" height="11" rx="1"/><path d="M6 14V9h4v5M6 6h1M9 6h1M6 3V1M10 3V1"/></svg>
                  </div>
                  <span class="prop-filter-name">${esc(h.hotelName)}</span>
                </div>
                <div class="prop-filter-count ${h.count > 0 ? 'is-live' : ''}">
                  ${h.count > 0 ? '<span class="prop-live-dot"></span>' : ''}
                  <span>${h.count}</span>
                </div>
              </button>`).join('')}
          </div>
        </div>` : ''}

      <div class="card mb12">
        <div class="card-head">
          <span>Currently On Shift${d.activeShifts.length > 0 ? ' <span class="dot-live"></span>' : ''}</span>
          <span class="text-muted text-sm" id="ov-active-meta"></span>
        </div>
        <div id="ov-active-body"></div>
      </div>

      ${d.pendingCorrections > 0 ? `
        <div style="background:var(--amber-lt);border:1px solid #fde68a;border-radius:var(--radius);padding:12px 16px;font-size:13px">
          <strong>${d.pendingCorrections} pending correction request${d.pendingCorrections > 1 ? 's' : ''}</strong> waiting for your review.
          <button class="btn btn-sm btn-warning" style="margin-left:12px" onclick="navigate('corrections')">Review</button>
        </div>` : ''}
    `;
    renderOverviewActiveTable();
  } catch {
    body.innerHTML = '<div class="empty-state text-muted">Error loading overview.</div>';
  }
}

// Renders only the Currently On Shift table body — keeps the rest of the page
// stable when the user toggles the per-hotel filter.
function renderOverviewActiveTable() {
  const d = overviewDashboard;
  if (!d) return;
  const bodyEl = document.getElementById('ov-active-body');
  const metaEl = document.getElementById('ov-active-meta');
  if (!bodyEl) return;

  const rows = overviewHotelFilter
    ? d.activeShifts.filter(s => s.hotelId === overviewHotelFilter)
    : d.activeShifts;

  if (metaEl) {
    if (overviewHotelFilter) {
      const h = (d.activeByHotel || []).find(x => x.hotelId === overviewHotelFilter);
      metaEl.textContent = `${rows.length} on shift at ${h ? h.hotelName : 'this property'}`;
    } else {
      metaEl.textContent = '';
    }
  }

  bodyEl.innerHTML = rows.length === 0
    ? `<div class="empty-state text-muted" style="padding:20px">${overviewHotelFilter ? 'Nobody on shift at this property right now.' : 'Nobody currently on shift.'}</div>`
    : `<div class="table-wrap"><table>
        <thead><tr><th>Employee</th><th>Role</th><th>Position</th><th>Hotel / Property</th><th>Sub-unit</th><th>Started</th></tr></thead>
        <tbody>${rows.map(s => `
          <tr>
            <td class="td-name">${esc(s.userName)}</td>
            <td>${roleBadge(s.userRole || 'employee')}</td>
            <td>${s.position && s.position !== 'Unassigned'
              ? `<span class="badge badge-position">${esc(s.position)}</span>`
              : '<span class="text-muted">—</span>'}</td>
            <td>${esc(s.hotelName || '—')}</td>
            <td class="text-muted">${esc(s.subUnit || '—')}</td>
            <td>${fmtTime(s.startTime)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
}

function setOverviewHotelFilter(hotelId) {
  overviewHotelFilter = (hotelId === overviewHotelFilter) ? null : hotelId;
  // Update button selected state without re-rendering the whole page.
  document.querySelectorAll('.prop-filter-item').forEach(c => c.classList.remove('is-selected'));
  const target = overviewHotelFilter
    ? document.querySelector(`.prop-filter-item[onclick="setOverviewHotelFilter('${overviewHotelFilter}')"]`)
    : document.querySelector('.prop-filter-item[onclick="setOverviewHotelFilter(null)"]');
  if (target) target.classList.add('is-selected');
  renderOverviewActiveTable();
}

async function renderShifts(user) {
  const body = document.getElementById('page-body');
  const hotels = user.role === 'admin' ? await GET('/api/hotels') : [];

  body.innerHTML = `
    <div class="filters">
      <input class="form-control f-search" id="s-search" type="text" placeholder="Search employee...">
      ${user.role === 'admin' ? `<select class="form-control" id="s-hotel">
        <option value="">All Hotels</option>
        ${hotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
      </select>` : ''}
      <input class="form-control" type="date" id="s-from" value="${daysAgoStr(7)}">
      <input class="form-control" type="date" id="s-to"   value="${today()}">
      <select class="form-control" id="s-status">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="validated">Validated</option>
      </select>
      <button class="btn btn-secondary" id="s-load">Search</button>
    </div>
    <div class="card" id="shifts-card">
      <div class="table-wrap" id="shifts-table"><div class="empty-state text-muted">Click Search to load shifts.</div></div>
    </div>`;

  document.getElementById('s-load').addEventListener('click', () => loadShiftsTable(user));
  document.getElementById('s-search').addEventListener('keydown', e => { if (e.key === 'Enter') loadShiftsTable(user); });
  loadShiftsTable(user);
}

async function loadShiftsTable(user) {
  const search = document.getElementById('s-search').value.trim().toLowerCase();
  const hotel  = user.role === 'admin' ? (document.getElementById('s-hotel')?.value || '') : '';
  const from   = document.getElementById('s-from').value;
  const to     = document.getElementById('s-to').value;
  const status = document.getElementById('s-status').value;

  const params = new URLSearchParams();
  if (from)   params.set('from', from);
  if (to)     params.set('to', to);
  if (status) params.set('status', status);
  if (hotel)  params.set('hotelId', hotel);

  const el = document.getElementById('shifts-table');
  el.innerHTML = '<div class="empty-state text-muted">Loading...</div>';

  try {
    let shifts = await GET('/api/shifts?' + params);
    if (search) shifts = shifts.filter(s => s.userName.toLowerCase().includes(search));

    const head = document.getElementById('shifts-card');
    const totalMins = shifts.filter(s => s.totalMinutes).reduce((t, s) => t + s.totalMinutes, 0);
    head.querySelector('.card-head')?.remove();
    head.insertAdjacentHTML('afterbegin', `<div class="card-head">
      <span>${shifts.length} shift${shifts.length !== 1 ? 's' : ''}</span>
      <span class="text-muted text-sm">${fmtDurH(totalMins)} total</span>
    </div>`);

    if (shifts.length === 0) { el.innerHTML = '<div class="empty-state text-muted">No shifts found.</div>'; return; }

    const canEditShifts = user.role === 'admin' || user.role === 'manager' || user.role === 'supervisor';
    el.innerHTML = `<table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Role</th>
          <th>Position</th>
          <th>Hotel / Property</th>
          <th>Sub-unit</th><th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Status</th>
          ${canEditShifts ? '<th>Actions</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${shifts.map(s => `
          <tr>
            <td><div class="td-name">${esc(s.userName)}</div>${s.isCorrection ? '<div class="td-sub">Correction</div>' : ''}</td>
            <td>${roleBadge(s.userRole || 'employee')}</td>
            <td>${s.position && s.position !== 'Unassigned'
              ? `<span class="badge badge-position">${esc(s.position)}</span>`
              : '<span class="text-muted">—</span>'}</td>
            <td>${esc(s.hotelName || '—')}</td>
            <td class="text-muted">${esc(s.subUnit || '—')}</td>
            <td>${fmtDate(s.startTime)}</td>
            <td>${fmtTime(s.startTime)}</td>
            <td>${s.endTime ? fmtTime(s.endTime) : '<span class="dot-live"></span>'}</td>
            <td class="fw600">${fmtDur(s.totalMinutes)}</td>
            <td>${badgeFor(s.status)}</td>
            ${canEditShifts ? `<td>
              <div class="btn-row">
                ${s.status !== 'active' ? `<button class="btn btn-sm btn-secondary" onclick="openEditShift('${s.id}')">Edit</button>` : ''}
                ${s.status === 'completed' ? `<button class="btn btn-sm btn-success" onclick="quickValidate('${s.id}')">Validate</button>` : ''}
                ${user.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteShift('${s.id}')">Delete</button>` : ''}
              </div>
            </td>` : ''}
          </tr>`).join('')}
      </tbody>
    </table>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state text-muted">Error loading shifts.</div>';
  }
}

async function quickValidate(shiftId) {
  try {
    await POST(`/api/shifts/${shiftId}/validate`, {});
    toast('Shift validated.', 'ok');
    loadShiftsTable(getUser());
  } catch { toast('Could not validate.', 'err'); }
}

async function deleteShift(shiftId) {
  if (!confirm('Delete this shift permanently?')) return;
  try {
    await DELETE(`/api/shifts/${shiftId}`);
    toast('Shift deleted.');
    loadShiftsTable(getUser());
  } catch { toast('Could not delete.', 'err'); }
}

async function openEditShift(shiftId) {
  const shifts = await GET(`/api/shifts`);
  const s = shifts.find(x => x.id === shiftId);
  if (!s) return;

  // Audit history — show all past edits if any
  const histHTML = (s.editHistory?.length > 0) ? `
    <div class="edit-history">
      <div class="edit-history-title">Historique des modifications</div>
      ${[...s.editHistory].reverse().map(h => `
        <div class="edit-history-row">
          <span class="edit-history-who">${esc(h.editedByName)} (${esc(h.editedByRole)})</span>
          <span class="edit-history-when">${fmtDate(h.editedAt)} ${fmtTime(h.editedAt)}</span>
          <div class="edit-history-change">
            ${h.oldStartTime !== h.newStartTime
              ? `Arrivée : <s>${fmtTime(h.oldStartTime)}</s> → <strong>${fmtTime(h.newStartTime)}</strong> `
              : ''}
            ${h.oldEndTime !== h.newEndTime
              ? `Départ : <s>${h.oldEndTime ? fmtTime(h.oldEndTime) : '—'}</s> → <strong>${h.newEndTime ? fmtTime(h.newEndTime) : '—'}</strong>`
              : ''}
            ${h.notes ? `<div class="text-muted text-sm mt4">"${esc(h.notes)}"</div>` : ''}
          </div>
        </div>`).join('')}
    </div>` : '';

  showModalLg(`
    <div class="modal-head">
      <div class="modal-head-title">Modifier le shift — ${esc(s.userName)}</div>
      <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="modal-body">
      <div class="edit-shift-context">
        <span>${esc(s.hotelName)}${s.subUnit ? ' — ' + esc(s.subUnit) : ''}</span>
        <span class="text-muted">·</span>
        <span>${s.position || '—'}</span>
        <span class="text-muted">·</span>
        <span>${fmtDate(s.startTime)}</span>
        ${s.editHistory?.length > 0 ? `<span class="edit-badge">Modifié ${s.editHistory.length}×</span>` : ''}
      </div>
      <div class="form-grid mt12">
        <div class="form-group">
          <label>Arrivée *</label>
          <input class="form-control" type="datetime-local" id="es-start" value="${toLocalDTInput(s.startTime)}">
        </div>
        <div class="form-group">
          <label>Départ</label>
          <input class="form-control" type="datetime-local" id="es-end" value="${toLocalDTInput(s.endTime)}">
        </div>
        <div class="form-group span2">
          <label>Motif de la modification <span class="text-muted text-sm">(conservé dans l'historique)</span></label>
          <textarea class="form-control" id="es-notes" placeholder="Ex : Théo a commencé à 7h45, non 8h00">${esc(s.notes||'')}</textarea>
        </div>
      </div>
      ${histHTML}
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveEditShift('${s.id}')">Enregistrer</button>
    </div>
  `);
}

async function saveEditShift(id) {
  const start = document.getElementById('es-start').value;
  const end   = document.getElementById('es-end').value;
  const notes = document.getElementById('es-notes').value;
  if (!start) { toast('L\'heure d\'arrivée est requise.', 'err'); return; }
  try {
    await PUT(`/api/shifts/${id}`, {
      startTime: new Date(start).toISOString(),
      endTime:   end ? new Date(end).toISOString() : null,
      notes
    });
    toast('Shift mis à jour ✓', 'ok');
    closeModal();
    loadShiftsTable(getUser());
    loadValTable(getUser()); // refresh validate table if open
  } catch (e) { toast(e?.error || 'Erreur lors de l\'enregistrement.', 'err'); }
}

// ── Validate hours ────────────────────────────────────────────────────────────
async function renderValidate(user) {
  const body = document.getElementById('page-body');
  const hotels = user.role === 'admin' ? await GET('/api/hotels') : [];
  const periods = await GET('/api/payroll/periods');

  body.innerHTML = `
    <div class="card mb12">
      <div class="card-body" style="padding:14px 18px">
        <div class="filters">
          <select class="form-control" id="val-mode">
            <option value="custom">Custom Range</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            ${periods.slice(0,4).map(p => `<option value="p:${p.start}:${p.end}">${esc(p.label)}</option>`).join('')}
          </select>
          <input class="form-control" type="date" id="val-from" value="${daysAgoStr(7)}">
          <input class="form-control" type="date" id="val-to"   value="${today()}">
          ${user.role === 'admin' ? `<select class="form-control" id="val-hotel">
            <option value="">All Hotels</option>
            ${hotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
          </select>` : ''}
          <button class="btn btn-secondary" id="val-load">Load</button>
        </div>
        <div class="btn-row mt12">
          <button class="btn btn-success" id="btn-val-all">Validate All Completed</button>
          <button class="btn btn-primary" id="btn-val-sel" disabled>Validate Selected</button>
          <span class="text-muted text-sm" id="val-sel-count"></span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap" id="val-table"><div class="empty-state text-muted">Click Load to show shifts.</div></div>
    </div>`;

  document.getElementById('val-mode').addEventListener('change', function () {
    const v = this.value;
    if (v === 'today') {
      document.getElementById('val-from').value = today();
      document.getElementById('val-to').value   = today();
    } else if (v === 'week') {
      document.getElementById('val-from').value = daysAgoStr(6);
      document.getElementById('val-to').value   = today();
    } else if (v.startsWith('p:')) {
      const [,start,end] = v.split(':');
      document.getElementById('val-from').value = start.slice(0,10);
      document.getElementById('val-to').value   = end.slice(0,10);
    }
  });

  document.getElementById('val-load').addEventListener('click', () => loadValTable(user));
  document.getElementById('btn-val-all').addEventListener('click', () => validateAllCompleted(user));
  document.getElementById('btn-val-sel').addEventListener('click', () => validateSelected(user));
  loadValTable(user);
}

let valShifts = [];

async function loadValTable(user) {
  const from  = document.getElementById('val-from').value;
  const to    = document.getElementById('val-to').value;
  const hotel = user.role === 'admin' ? (document.getElementById('val-hotel')?.value || '') : '';

  const params = new URLSearchParams({ from, to });
  if (hotel) params.set('hotelId', hotel);

  const el = document.getElementById('val-table');
  el.innerHTML = '<div class="empty-state text-muted">Loading...</div>';

  try {
    valShifts = (await GET('/api/shifts?' + params)).filter(s => s.status !== 'active');
    if (valShifts.length === 0) { el.innerHTML = '<div class="empty-state text-muted">No shifts in this period.</div>'; return; }

    el.innerHTML = `<table>
      <thead>
        <tr>
          <th class="th-check"><input type="checkbox" id="chk-all" title="Select all"></th>
          <th>Employé</th>
          ${user.role === 'admin' ? '<th>Propriété</th>' : ''}
          <th>Date</th><th>Début</th><th>Fin</th><th>Durée</th><th>GPS</th><th>Statut</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${valShifts.map(s => `
          <tr class="${geoBadgeClass(s) === 'geo-warn' ? 'val-row-geo-warn' : ''}">
            <td>${s.status === 'completed' ? `<input type="checkbox" class="val-chk" data-id="${s.id}">` : ''}</td>
            <td>
              <div class="td-name">${esc(s.userName)}</div>
              ${s.position ? `<div class="td-sub">${esc(s.position)}</div>` : ''}
            </td>
            ${user.role === 'admin' ? `<td>${esc(s.hotelName)}${s.subUnit ? `<div class="td-sub">${esc(s.subUnit)}</div>` : ''}</td>` : ''}
            <td>${fmtDate(s.startTime)}</td>
            <td>${fmtTime(s.startTime)}</td>
            <td>${s.endTime ? fmtTime(s.endTime) : '<span class="text-muted">—</span>'}</td>
            <td class="fw600">${s.totalMinutes ? fmtDur(s.totalMinutes) : '—'}</td>
            <td>${geoBadgeHtml(s)}</td>
            <td>
              ${badgeFor(s.status)}${s.validatedByName ? `<div class="td-sub">par ${esc(s.validatedByName)}</div>` : ''}
              ${s.editHistory?.length > 0 ? `<div class="td-sub" title="${s.editHistory.length} modification(s)">✏️ ×${s.editHistory.length}</div>` : ''}
            </td>
            <td>
              ${s.status !== 'active' ? `<button class="btn btn-xs btn-secondary" onclick="openEditShift('${s.id}')">Modifier</button>` : ''}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

    document.getElementById('chk-all').addEventListener('change', function () {
      document.querySelectorAll('.val-chk').forEach(c => c.checked = this.checked);
      updateSelCount();
    });
    el.addEventListener('change', e => { if (e.target.classList.contains('val-chk')) updateSelCount(); });
  } catch { el.innerHTML = '<div class="empty-state text-muted">Error loading shifts.</div>'; }
}

function updateSelCount() {
  const checked = document.querySelectorAll('.val-chk:checked').length;
  document.getElementById('btn-val-sel').disabled = checked === 0;
  document.getElementById('val-sel-count').textContent = checked > 0 ? `${checked} selected` : '';
}

async function validateSelected(user) {
  const ids = [...document.querySelectorAll('.val-chk:checked')].map(c => c.dataset.id);
  if (!ids.length) return;
  try {
    const r = await POST('/api/shifts/validate-batch', { ids });
    toast(`${r.validated} shift${r.validated !== 1 ? 's' : ''} validated.`, 'ok');
    loadValTable(user);
  } catch { toast('Error validating.', 'err'); }
}

async function validateAllCompleted(user) {
  const ids = valShifts.filter(s => s.status === 'completed').map(s => s.id);
  if (!ids.length) { toast('No completed shifts to validate.', 'warn'); return; }
  if (!confirm(`Validate all ${ids.length} completed shift${ids.length !== 1 ? 's' : ''}?`)) return;
  try {
    const r = await POST('/api/shifts/validate-batch', { ids });
    toast(`${r.validated} shift${r.validated !== 1 ? 's' : ''} validated.`, 'ok');
    loadValTable(user);
  } catch { toast('Error validating.', 'err'); }
}

// ── Corrections ───────────────────────────────────────────────────────────────
async function renderCorrections(user) {
  const body = document.getElementById('page-body');
  body.innerHTML = `
    <div class="filters">
      <select class="form-control" id="corr-status">
        <option value="pending">Pending</option>
        <option value="">All</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <button class="btn btn-secondary" id="corr-load">Refresh</button>
    </div>
    <div class="card">
      <div class="table-wrap" id="corr-table"><div class="empty-state text-muted">Loading...</div></div>
    </div>`;

  document.getElementById('corr-load').addEventListener('click', () => loadCorrTable(user));
  loadCorrTable(user);
}

async function loadCorrTable(user) {
  const status = document.getElementById('corr-status').value;
  const el     = document.getElementById('corr-table');
  el.innerHTML = '<div class="empty-state text-muted">Loading...</div>';

  try {
    let list = await GET('/api/corrections' + (status ? `?status=${status}` : ''));
    if (list.length === 0) { el.innerHTML = '<div class="empty-state text-muted">No correction requests.</div>'; return; }

    el.innerHTML = `<table>
      <thead>
        <tr>
          <th>Employee</th>
          ${user.role === 'admin' ? '<th>Hotel</th>' : ''}
          <th>Date</th><th>Requested Hours</th><th>Reason</th><th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(c => `
          <tr>
            <td class="td-name">${esc(c.userName)}</td>
            ${user.role === 'admin' ? `<td>${esc(c.hotelName)}</td>` : ''}
            <td>${esc(c.date)}</td>
            <td>${fmtTime(c.requestedStart)} — ${fmtTime(c.requestedEnd)}</td>
            <td class="text-muted text-sm" style="max-width:200px">${esc(c.reason)}</td>
            <td>${badgeFor(c.status)}${c.reviewedByName ? `<div class="td-sub">by ${esc(c.reviewedByName)}</div>` : ''}</td>
            <td>
              ${c.status === 'pending' ? `
                <div class="btn-row">
                  <button class="btn btn-xs btn-success" onclick="approveCorrection('${c.id}')">Approve</button>
                  <button class="btn btn-xs btn-danger"  onclick="rejectCorrection('${c.id}')">Reject</button>
                </div>` : '—'}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  } catch { el.innerHTML = '<div class="empty-state text-muted">Error loading.</div>'; }
}

async function approveCorrection(id) {
  showModal(`
    <div class="modal-head">
      <div class="modal-head-title">Approve Correction</div>
      <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Notes (optional)</label>
        <textarea class="form-control" id="corr-notes" placeholder="Add a note for the employee..."></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="doApprove('${id}')">Approve & Create Shift</button>
    </div>`);
}

async function doApprove(id) {
  const notes = document.getElementById('corr-notes').value;
  try {
    await PUT(`/api/corrections/${id}/approve`, { notes });
    toast('Correction approved. Shift created.', 'ok');
    closeModal();
    loadCorrTable(getUser());
  } catch (e) { toast(e.error || 'Error.', 'err'); }
}

async function rejectCorrection(id) {
  showModal(`
    <div class="modal-head">
      <div class="modal-head-title">Reject Correction</div>
      <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Reason for rejection *</label>
        <textarea class="form-control" id="rej-notes" placeholder="Explain why this is being rejected..."></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="doReject('${id}')">Reject Request</button>
    </div>`);
}

async function doReject(id) {
  const notes = document.getElementById('rej-notes').value.trim();
  if (!notes) { toast('Please provide a reason.', 'err'); return; }
  try {
    await PUT(`/api/corrections/${id}/reject`, { notes });
    toast('Correction rejected.', 'ok');
    closeModal();
    loadCorrTable(getUser());
  } catch (e) { toast(e.error || 'Error.', 'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PAGES
// ═══════════════════════════════════════════════════════════════════════════

async function renderEmployees() {
  const body   = document.getElementById('page-body');
  const user   = getUser();
  const hotels = await GET('/api/hotels');
  // Admin, manager and supervisor can manage employees.
  // Scope is enforced server-side (own hotel, limited role options).
  const canManage    = user.role === 'admin' || user.role === 'manager' || user.role === 'supervisor';
  const isAdmin      = user.role === 'admin';
  const isSupervisor = user.role === 'supervisor';

  // Positions are admin-managed; admin/accounting/manager can read.
  let positions = [];
  try { positions = (await GET('/api/positions')).positions || []; } catch {}

  document.getElementById('topbar-actions').innerHTML = canManage
    ? `${isAdmin ? '<button class="btn btn-secondary" onclick="openManagePositions()">Manage Positions</button>' : ''}
       <button class="btn btn-primary" onclick="openAddEmployee()">Add Employee</button>`
    : '';

  body.innerHTML = `
    <div class="filters">
      <input class="form-control f-search" id="emp-search" type="text" placeholder="Search name or email...">
      ${canManage ? `<select class="form-control" id="emp-hotel-filter">
        <option value="">All Hotels</option>
        ${hotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
      </select>` : '<input type="hidden" id="emp-hotel-filter" value="">'}
      ${canManage ? `<select class="form-control" id="emp-role-filter">
        <option value="">All Roles</option>
        <option value="employee">Employee</option>
        <option value="manager">Manager</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Admin</option>
        <option value="accounting">Accounting</option>
      </select>` : '<input type="hidden" id="emp-role-filter" value="">'}
      <select class="form-control" id="emp-position-filter">
        <option value="">All Positions</option>
        ${positions.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
      </select>
      <select class="form-control" id="emp-active-filter">
        <option value="true">Active</option>
        <option value="">All</option>
        <option value="false">Inactive</option>
      </select>
    </div>
    <div class="card">
      <div class="table-wrap" id="emp-table"><div class="empty-state text-muted">Loading...</div></div>
    </div>`;

  ['emp-search','emp-hotel-filter','emp-role-filter','emp-position-filter','emp-active-filter'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => loadEmpTable(hotels));
  });
  document.getElementById('emp-search').addEventListener('input', () => loadEmpTable(hotels));
  loadEmpTable(hotels);
}

let allEmployees = [];

async function loadEmpTable(hotels) {
  const me         = getUser();
  // Managers and supervisors can edit/deactivate their own hotel's employees.
  const canManage  = me.role === 'admin' || me.role === 'manager' || me.role === 'supervisor';
  const search     = document.getElementById('emp-search').value.toLowerCase();
  const hotelFil   = document.getElementById('emp-hotel-filter').value;
  const roleFil    = document.getElementById('emp-role-filter').value;
  const positionFil = document.getElementById('emp-position-filter').value;
  const activeFil  = document.getElementById('emp-active-filter').value;

  const el = document.getElementById('emp-table');

  try {
    allEmployees = await GET('/api/users');
    let users = allEmployees;
    if (search)       users = users.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    if (hotelFil)     users = users.filter(u => u.hotelId === hotelFil);
    if (roleFil)      users = users.filter(u => u.role === roleFil);
    if (positionFil)  users = users.filter(u => (u.position || 'Unassigned') === positionFil);
    if (activeFil === 'true')  users = users.filter(u => u.active !== false);
    if (activeFil === 'false') users = users.filter(u => u.active === false);

    if (users.length === 0) { el.innerHTML = '<div class="empty-state text-muted">No employees found.</div>'; return; }

    el.innerHTML = `<table>
      <thead>
        <tr><th>Name</th><th>Email</th><th>Role</th><th>Position</th><th>Hotel / Group</th><th>Property / Sub-unit</th><th>Status</th>${canManage ? '<th>Actions</th>' : ''}</tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td class="td-name">${esc(u.name)}</td>
            <td class="text-muted">${esc(u.email)}</td>
            <td>${roleBadge(u.role)}</td>
            <td>${u.position && u.position !== 'Unassigned'
              ? `<span class="badge badge-position">${esc(u.position)}</span>`
              : '<span class="text-muted">—</span>'}</td>
            <td>${esc(u.hotelName || '—')}</td>
            <td class="text-muted">${esc(u.subUnit || '—')}</td>
            <td>${u.active !== false
              ? '<span class="badge badge-validated">Active</span>'
              : '<span class="badge badge-inactive">Inactive</span>'}</td>
            ${canManage ? `<td>
              <div class="btn-row">
                <button class="btn btn-xs btn-secondary" onclick="openEditEmployee('${u.id}')">Edit</button>
                ${u.active !== false
                  ? `<button class="btn btn-xs btn-danger" onclick="deactivateUser('${u.id}', '${esc(u.name)}')">Deactivate</button>`
                  : `<button class="btn btn-xs btn-success" onclick="activateUser('${u.id}')">Reactivate</button>`}
              </div>
            </td>` : ''}
          </tr>`).join('')}
      </tbody>
    </table>`;
  } catch { el.innerHTML = '<div class="empty-state text-muted">Error loading employees.</div>'; }
}

async function openAddEmployee() {
  const me           = getUser();
  const isAdmin      = me.role === 'admin';
  const isSupervisor = me.role === 'supervisor';
  const hotels  = await GET('/api/hotels');
  // Manager/supervisor scope: hotel is forced to their own, roles are restricted.
  const myHotel = hotels.find(h => h.id === me.hotelId);
  let positions = [];
  try { positions = (await GET('/api/positions')).positions || []; } catch {}

  const roleOptions = isAdmin
    ? `<option value="employee">Employee</option>
       <option value="manager">Manager</option>
       <option value="supervisor">Supervisor</option>
       <option value="accounting">Accounting</option>
       <option value="admin">Admin</option>`
    : isSupervisor
      ? `<option value="employee">Employee</option>`
      : `<option value="employee">Employee</option>
         <option value="supervisor">Supervisor</option>`;

  const hotelField = isAdmin
    ? `<div class="form-group"><label>Hotel / Company</label>
        <select class="form-control" id="ae-hotel" onchange="updateSubUnits(this,'ae-subunit','ae-subunit-lbl')">
          <option value="">— No hotel —</option>
          ${hotels.map(h => `<option value="${h.id}" data-subunits='${JSON.stringify(h.subUnits || [])}' data-isgroup="${h.isGroup ? 'true' : 'false'}">${esc(h.name)}</option>`).join('')}
        </select></div>
       <div class="form-group"><label id="ae-subunit-lbl">Sub-unit / Property</label>
        <select class="form-control" id="ae-subunit"><option value="">— None —</option></select></div>`
    : `<div class="form-group"><label>Hotel / Company</label>
        <input class="form-control" id="ae-hotel-display" value="${esc(myHotel?.name || '—')}" disabled>
        <input type="hidden" id="ae-hotel" value="${esc(me.hotelId || '')}"></div>
       <div class="form-group"><label id="ae-subunit-lbl">${myHotel?.isGroup ? 'Property *' : 'Sub-unit'}</label>
        <select class="form-control" id="ae-subunit">
          <option value="">— None —</option>
          ${(myHotel?.subUnits || []).map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select></div>`;

  showModal(`
    <div class="modal-head">
      <div class="modal-head-title">Add Employee</div>
      <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="modal-body">
      <p class="text-muted text-sm mb12">
        Use the employee's <strong>real email address</strong>. They will use it to sign in.
      </p>
      <div class="form-grid">
        <div class="form-group span2"><label>Full Name *</label>
          <input class="form-control" id="ae-name" placeholder="First and last name" autocomplete="off"></div>
        <div class="form-group span2"><label>Real Email Address *</label>
          <input class="form-control" type="email" id="ae-email" placeholder="firstname.lastname@example.com" autocomplete="off"></div>
        <div class="form-group span2"><label>Temporary Password *</label>
          <input class="form-control" type="password" id="ae-pw" placeholder="They can change it in My Account" autocomplete="new-password"></div>
        <div class="form-group"><label>Role *</label>
          <select class="form-control" id="ae-role" onchange="onRoleChange('ae')">
            ${roleOptions}
          </select></div>
        <div class="form-group"><label id="ae-position-lbl">Position *</label>
          <select class="form-control" id="ae-position">
            <option value="">— Select a position —</option>
            ${positions.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
          </select>
          <div id="ae-position-hint" class="text-muted text-sm" style="margin-top:4px;display:none">
            Managers &amp; supervisors who work on-site should have an operational position (e.g. Receptionist).
          </div></div>
        ${hotelField}
        <div class="form-group span2"><label>Status</label>
          <select class="form-control" id="ae-active">
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select></div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewEmployee()">Add Employee</button>
    </div>`);
  onRoleChange('ae');
}

// Show "Position *" for employees; show hint for manager/supervisor.
function onRoleChange(prefix) {
  const role = document.getElementById(`${prefix}-role`).value;
  const lbl  = document.getElementById(`${prefix}-position-lbl`);
  const hint = document.getElementById(`${prefix}-position-hint`);
  if (lbl) lbl.textContent = role === 'employee' ? 'Position *' : 'Operational Position';
  if (hint) hint.style.display = (role === 'manager' || role === 'supervisor') ? '' : 'none';
}

function updateSubUnits(hotelSel, subId, lblId) {
  const opt     = hotelSel.options[hotelSel.selectedIndex];
  const sub     = JSON.parse(opt.dataset.subunits || '[]');
  const isGroup = opt.dataset.isgroup === 'true';
  const el      = document.getElementById(subId);
  const lbl     = lblId ? document.getElementById(lblId) : null;
  if (lbl) lbl.textContent = isGroup ? 'Property *' : 'Sub-unit';
  el.innerHTML = '<option value="">— None —</option>' +
    sub.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
}

async function saveNewEmployee() {
  const name     = document.getElementById('ae-name').value.trim();
  const email    = document.getElementById('ae-email').value.trim();
  const pw       = document.getElementById('ae-pw').value;
  const role     = document.getElementById('ae-role').value;
  const position = document.getElementById('ae-position').value;
  const hotelId  = document.getElementById('ae-hotel').value;
  const subUnit  = document.getElementById('ae-subunit').value;
  const active   = document.getElementById('ae-active').value === 'true';
  // Check if selected hotel is a group (requires a specific property)
  const hotelSel = document.getElementById('ae-hotel');
  const selOpt   = hotelSel?.options?.[hotelSel.selectedIndex];
  const isGroupH = selOpt?.dataset?.isgroup === 'true';
  if (!name || !email || !pw || !role) { toast('Name, email, password and role are required.', 'err'); return; }
  if (role === 'employee' && !position) { toast('Please pick a position for this employee.', 'err'); return; }
  if (isGroupH && !subUnit) { toast('Please select a Property within this company group.', 'err'); return; }
  try {
    await POST('/api/users', {
      name, email, password: pw, role,
      position: position || null,
      hotelId: hotelId || null, subUnit: subUnit || null, active
    });
    toast('Employee added.', 'ok');
    closeModal();
    loadEmpTable(await GET('/api/hotels'));
  } catch (e) { toast(e.error || 'Error adding employee.', 'err'); }
}

async function openEditEmployee(id) {
  const me      = getUser();
  const isAdmin = me.role === 'admin';
  const hotels  = await GET('/api/hotels');
  let positions = [];
  try { positions = (await GET('/api/positions')).positions || []; } catch {}
  const u = allEmployees.find(x => x.id === id);
  if (!u) return;
  const hotel    = hotels.find(h => h.id === u.hotelId);
  const subUnits = hotel?.subUnits || [];

  // Role choices — admin sees all; manager sees only employee/supervisor.
  const roleOptions = isAdmin
    ? `<option value="employee"   ${u.role==='employee'  ?'selected':''}>Employee</option>
       <option value="manager"    ${u.role==='manager'   ?'selected':''}>Manager</option>
       <option value="supervisor" ${u.role==='supervisor'?'selected':''}>Supervisor</option>
       <option value="accounting" ${u.role==='accounting'?'selected':''}>Accounting</option>
       <option value="admin"      ${u.role==='admin'     ?'selected':''}>Admin</option>`
    : `<option value="employee"   ${u.role==='employee'  ?'selected':''}>Employee</option>
       <option value="supervisor" ${u.role==='supervisor'?'selected':''}>Supervisor</option>`;

  // Hotel field — admin can move users between hotels; manager is pinned.
  const isGroupHotel = hotel?.isGroup === true;
  const myHotelForEdit = hotels.find(h => h.id === me.hotelId);
  const hotelField = isAdmin
    ? `<div class="form-group"><label>Hotel / Company</label>
        <select class="form-control" id="ee-hotel" onchange="updateSubUnits(this,'ee-subunit','ee-subunit-lbl')">
          <option value="">— No hotel —</option>
          ${hotels.map(h => `<option value="${h.id}" data-subunits='${JSON.stringify(h.subUnits || [])}' data-isgroup="${h.isGroup ? 'true' : 'false'}" ${h.id===u.hotelId?'selected':''}>${esc(h.name)}</option>`).join('')}
        </select></div>
       <div class="form-group"><label id="ee-subunit-lbl">${isGroupHotel ? 'Property *' : 'Sub-unit'}</label>
        <select class="form-control" id="ee-subunit">
          <option value="">— None —</option>
          ${subUnits.map(s => `<option value="${esc(s)}" ${s===u.subUnit?'selected':''}>${esc(s)}</option>`).join('')}
        </select></div>`
    : `<div class="form-group"><label>Hotel / Company</label>
        <input class="form-control" id="ee-hotel-display" value="${esc(hotel?.name || me.hotelName || '—')}" disabled>
        <input type="hidden" id="ee-hotel" value="${esc(me.hotelId || u.hotelId || '')}"></div>
       <div class="form-group"><label id="ee-subunit-lbl">${myHotelForEdit?.isGroup ? 'Property *' : 'Sub-unit'}</label>
        <select class="form-control" id="ee-subunit">
          <option value="">— None —</option>
          ${(subUnits.length ? subUnits : (myHotelForEdit?.subUnits || [])).map(s => `<option value="${esc(s)}" ${s===u.subUnit?'selected':''}>${esc(s)}</option>`).join('')}
        </select></div>`;

  showModal(`
    <div class="modal-head">
      <div class="modal-head-title">Edit — ${esc(u.name)}</div>
      <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group span2"><label>Full Name *</label>
          <input class="form-control" id="ee-name" value="${esc(u.name)}" autocomplete="off"></div>
        <div class="form-group span2"><label>Email Address * (real address — used for login)</label>
          <input class="form-control" type="email" id="ee-email" value="${esc(u.email)}" autocomplete="off"></div>
        <div class="form-group span2"><label>New Password <span style="font-weight:400;color:var(--gray-400)">(leave blank to keep current)</span></label>
          <input class="form-control" type="password" id="ee-pw" placeholder="Leave blank to keep current" autocomplete="new-password"></div>
        <div class="form-group"><label>Role *</label>
          <select class="form-control" id="ee-role" onchange="onRoleChange('ee')">
            ${roleOptions}
          </select></div>
        <div class="form-group"><label id="ee-position-lbl">${u.role==='employee'?'Position *':'Operational Position'}</label>
          <select class="form-control" id="ee-position">
            <option value="">— None —</option>
            ${positions.map(p => `<option value="${esc(p)}" ${p===u.position?'selected':''}>${esc(p)}</option>`).join('')}
          </select>
          <div id="ee-position-hint" class="text-muted text-sm" style="margin-top:4px;display:${(u.role==='manager'||u.role==='supervisor')?'':'none'}">
            If this person works on-site shifts, assign their operational position (e.g. Receptionist).
          </div></div>
        <div class="form-group"><label>Status</label>
          <select class="form-control" id="ee-active">
            <option value="true"  ${u.active !== false ? 'selected':''}>Active</option>
            <option value="false" ${u.active === false  ? 'selected':''}>Inactive</option>
          </select></div>
        ${hotelField}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditEmployee('${id}')">Save Changes</button>
    </div>`);
}

async function saveEditEmployee(id) {
  const name     = document.getElementById('ee-name').value.trim();
  const email    = document.getElementById('ee-email').value.trim();
  const pw       = document.getElementById('ee-pw').value;
  const role     = document.getElementById('ee-role').value;
  const position = document.getElementById('ee-position').value;
  const active   = document.getElementById('ee-active').value === 'true';
  const hotelId  = document.getElementById('ee-hotel').value;
  const subUnit  = document.getElementById('ee-subunit').value;
  // Check if selected hotel is a group (requires a specific property)
  const hotelSel = document.getElementById('ee-hotel');
  const selOpt   = hotelSel?.options?.[hotelSel.selectedIndex];
  const isGroupH = selOpt?.dataset?.isgroup === 'true';
  if (!name || !email) { toast('Name and email are required.', 'err'); return; }
  if (role === 'employee' && !position) { toast('Please pick a position for this employee.', 'err'); return; }
  if (isGroupH && !subUnit) { toast('Please select a Property within this company group.', 'err'); return; }
  try {
    const body = {
      name, email, role, active,
      position: position || null,
      hotelId: hotelId || null, subUnit: subUnit || null
    };
    if (pw) body.password = pw;
    await PUT(`/api/users/${id}`, body);
    // If deactivated via active field, also update deactivatedAt
    if (!active) await PUT(`/api/users/${id}/deactivate`, {});
    else         await PUT(`/api/users/${id}/activate`,   {});
    toast('Employee updated.', 'ok');
    closeModal();
    loadEmpTable(await GET('/api/hotels'));
  } catch (e) { toast(e.error || 'Error saving.', 'err'); }
}

async function deactivateUser(id, name) {
  if (!confirm(`Deactivate ${name}? They will lose access but their history is kept.`)) return;
  try {
    await PUT(`/api/users/${id}/deactivate`, {});
    toast('Employee deactivated.', 'ok');
    loadEmpTable(await GET('/api/hotels'));
  } catch { toast('Error.', 'err'); }
}

async function activateUser(id) {
  try {
    await PUT(`/api/users/${id}/activate`, {});
    toast('Employee reactivated.', 'ok');
    loadEmpTable(await GET('/api/hotels'));
  } catch { toast('Error.', 'err'); }
}

// ─── Positions admin (admin only) ───────────────────────────────────────────

async function openManagePositions() {
  await renderPositionsModal();
}

async function renderPositionsModal() {
  let detailed = [];
  try { detailed = (await GET('/api/positions')).detailed || []; } catch {}
  showModal(`
    <div class="modal-head">
      <div class="modal-head-title">Manage Positions</div>
      <button class="modal-close" onclick="closeModal()">&#10005;</button>
    </div>
    <div class="modal-body">
      <p class="text-muted text-sm mb12">
        Positions are job titles you can assign to employees (e.g. Receptionist, Cleaner).
        Payroll reports can be filtered by position.
      </p>

      <div class="form-grid mb16">
        <div class="form-group span2"><label>Add a new position</label>
          <div style="display:flex;gap:8px">
            <input class="form-control" id="np-name" placeholder="e.g. Front Desk" autocomplete="off">
            <button class="btn btn-primary" onclick="addPosition()">Add</button>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Position</th><th>In use by</th><th style="width:120px"></th></tr></thead>
          <tbody>
            ${detailed.length === 0
              ? '<tr><td colspan="3" class="empty-state text-muted">No positions yet.</td></tr>'
              : detailed.map(p => `
                <tr>
                  <td class="td-name">${esc(p.name)}</td>
                  <td>${p.inUse} employee${p.inUse === 1 ? '' : 's'}</td>
                  <td>${p.name === 'Unassigned'
                    ? '<span class="text-muted text-sm">System</span>'
                    : (p.inUse > 0
                      ? '<span class="text-muted text-sm">In use</span>'
                      : `<button class="btn btn-xs btn-danger" onclick="deletePosition('${esc(p.name).replace(/'/g, "\\'")}')">Remove</button>`)}
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Done</button>
    </div>`);
}

async function addPosition() {
  const name = document.getElementById('np-name').value.trim();
  if (!name) { toast('Enter a position name.', 'err'); return; }
  try {
    await POST('/api/positions', { name });
    toast(`Position "${name}" added.`, 'ok');
    await renderPositionsModal();
  } catch (e) { toast(e.error || 'Error adding position.', 'err'); }
}

async function deletePosition(name) {
  if (!confirm(`Remove the position "${name}"?`)) return;
  try {
    await DELETE(`/api/positions/${encodeURIComponent(name)}`);
    toast(`Position "${name}" removed.`, 'ok');
    await renderPositionsModal();
  } catch (e) { toast(e.error || 'Error removing position.', 'err'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNTING / PAYROLL
// ═══════════════════════════════════════════════════════════════════════════

let payrollData = null;
let payrollParams = {};

async function renderPayroll() {
  const body    = document.getElementById('page-body');
  const periodsRaw = await GET('/api/payroll/periods');
  // Normalise the period start/end to YYYY-MM-DD so they can populate
  // <input type="date"> directly. The API returns full ISO timestamps.
  const dateOnly = iso => (iso || '').slice(0, 10);
  const periods  = periodsRaw.map(p => ({
    ...p, start: dateOnly(p.start), end: dateOnly(p.end)
  }));
  const hotels  = await GET('/api/hotels');
  let positions = [];
  try { positions = (await GET('/api/positions')).positions || []; } catch {}
  const cur     = periods.find(p => p.isCurrent) || periods[0];

  // Identify which hotels are groups (have sub-units)
  const groupHotels = hotels.filter(h => h.isGroup && h.subUnits && h.subUnits.length > 0);

  body.innerHTML = `
    <div class="card mb12">
      <div class="card-body" style="padding:14px 18px">
        <div class="filters">
          <div class="date-range">
            <label class="text-muted text-sm" for="pr-from">From</label>
            <input type="date" class="form-control" id="pr-from" value="${cur ? cur.start : ''}">
            <label class="text-muted text-sm" for="pr-to">To</label>
            <input type="date" class="form-control" id="pr-to" value="${cur ? cur.end : ''}">
          </div>
          <select class="form-control" id="pr-preset" title="Quick presets">
            <option value="">Quick periods…</option>
            <optgroup label="Pay periods">
              ${periods.map(p => `<option value="${p.start}|${p.end}" ${p.isCurrent?'selected':''}>${esc(p.label)}${p.isCurrent?' (current)':''}</option>`).join('')}
            </optgroup>
            <optgroup label="Calendar">
              <option value="this-month">This month</option>
              <option value="last-month">Last month</option>
              <option value="ytd">Year to date</option>
              <option value="last-7">Last 7 days</option>
              <option value="last-30">Last 30 days</option>
            </optgroup>
          </select>
          <select class="form-control" id="pr-hotel" onchange="onPayrollHotelChange(${JSON.stringify(groupHotels)})">
            <option value="">— Choisir une propriété —</option>
            ${hotels.map(h => `<option value="${h.id}" data-isgroup="${h.isGroup ? 'true' : 'false'}">${esc(h.name)}</option>`).join('')}
          </select>
          <select class="form-control" id="pr-subunit" style="display:none">
            <option value="">All Properties</option>
          </select>
          <select class="form-control" id="pr-position">
            <option value="">All Positions</option>
            ${positions.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="pr-load">Generate Report</button>
          <button class="btn btn-secondary" id="pr-csv" style="display:none">Export CSV</button>
          <button class="btn btn-secondary" id="pr-xlsx" style="display:none">Export Excel</button>
        </div>
        <p class="text-muted text-sm mt12">Sélectionnez une propriété et une période · Uniquement les shifts validés par les managers · "Tout" = toutes les positions de la propriété choisie</p>
      </div>
    </div>
    <div id="pr-output"></div>`;

  document.getElementById('pr-load').addEventListener('click', loadPayroll);
  document.getElementById('pr-csv').addEventListener('click',  exportPayrollCSV);
  document.getElementById('pr-xlsx').addEventListener('click', exportPayrollXLSX);

  // Preset dropdown pre-fills the two date inputs.
  document.getElementById('pr-preset').addEventListener('change', e => {
    const v = e.target.value;
    if (!v) return;
    const r = computePayrollPreset(v);
    if (r) {
      document.getElementById('pr-from').value = r.from;
      document.getElementById('pr-to').value   = r.to;
    }
  });
  // If the user manually edits a date, drop the preset selection so the UI
  // doesn't pretend a preset is still active.
  ['pr-from', 'pr-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      document.getElementById('pr-preset').value = '';
    });
  });

  if (cur) loadPayroll();
}

// Format a Date as YYYY-MM-DD using LOCAL time (avoids the toISOString UTC shift).
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computePayrollPreset(v) {
  // Pay-period preset is encoded as "YYYY-MM-DD|YYYY-MM-DD".
  if (v.includes('|')) {
    const [from, to] = v.split('|');
    return { from, to };
  }
  const today = new Date();
  switch (v) {
    case 'this-month':
      return { from: ymdLocal(new Date(today.getFullYear(), today.getMonth(), 1)),
               to:   ymdLocal(today) };
    case 'last-month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: ymdLocal(first), to: ymdLocal(last) };
    }
    case 'ytd':
      return { from: ymdLocal(new Date(today.getFullYear(), 0, 1)),
               to:   ymdLocal(today) };
    case 'last-7': {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { from: ymdLocal(d), to: ymdLocal(today) };
    }
    case 'last-30': {
      const d = new Date(today); d.setDate(d.getDate() - 29);
      return { from: ymdLocal(d), to: ymdLocal(today) };
    }
  }
  return null;
}

function onPayrollHotelChange(groupHotels) {
  const sel     = document.getElementById('pr-hotel');
  const subSel  = document.getElementById('pr-subunit');
  const hotelId = sel.value;
  const group   = groupHotels.find(h => h.id === hotelId);
  if (group) {
    subSel.innerHTML = '<option value="">All Properties</option>' +
      group.subUnits.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    subSel.style.display = '';
  } else {
    subSel.innerHTML = '<option value="">All Properties</option>';
    subSel.style.display = 'none';
  }
}

async function loadPayroll() {
  const from = document.getElementById('pr-from').value;
  const to   = document.getElementById('pr-to').value;
  if (!from || !to) {
    toast('Veuillez sélectionner les dates de début et de fin.', 'err');
    return;
  }
  if (from > to) {
    toast('La date de début doit être avant la date de fin.', 'err');
    return;
  }
  const hotelId    = document.getElementById('pr-hotel').value;
  if (!hotelId) {
    toast('Sélectionnez une propriété pour générer le rapport de paie.', 'err');
    document.getElementById('pr-hotel').focus();
    return;
  }
  const subUnit    = (document.getElementById('pr-subunit')?.style.display !== 'none')
                      ? (document.getElementById('pr-subunit')?.value || '')
                      : '';
  const position   = document.getElementById('pr-position').value;

  payrollParams = { from, to, hotelId, subUnit, position };
  const el = document.getElementById('pr-output');
  el.innerHTML = '<div class="empty-state text-muted">Loading...</div>';

  const qs = new URLSearchParams({ from, to });
  if (hotelId)  qs.set('hotelId',  hotelId);
  if (subUnit)  qs.set('subUnit',  subUnit);
  if (position) qs.set('position', position);

  try {
    payrollData = await GET(`/api/payroll/summary?${qs.toString()}`);
    document.getElementById('pr-csv').style.display  = '';
    document.getElementById('pr-xlsx').style.display = '';

    // ── Build position blocks ──────────────────────────────────────────────────
    // Group employees by position (client-side — no extra server call)
    const posOrder = ['Receptionist', 'Cleaner', 'Handyman', 'Manager', 'Supervisor', 'Unassigned'];
    const posMap   = {};
    payrollData.byEmployee.forEach(e => {
      const pos = e.position || 'Unassigned';
      if (!posMap[pos]) posMap[pos] = { minutes: 0, shifts: 0, employees: [] };
      posMap[pos].minutes += e.minutes;
      posMap[pos].shifts  += e.shifts;
      posMap[pos].employees.push(e);
    });
    // Sort positions: known order first, then alphabetically for the rest
    const sortedPositions = Object.keys(posMap).sort((a, b) => {
      const ia = posOrder.indexOf(a), ib = posOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return  1;
      return a.localeCompare(b);
    });

    const maxMinsInBlock = minutes => {
      return Math.max(...Object.values(posMap).flatMap(p => p.employees.map(e => e.minutes)), 1);
    };
    const globalMax = maxMinsInBlock();

    const isGroup = payrollData.bySubUnit && Object.keys(payrollData.bySubUnit).length > 0;

    const blocksHTML = sortedPositions.map(pos => {
      const group = posMap[pos];
      // Sort employees within block by hotel then name
      const emps = [...group.employees].sort((a, b) =>
        (a.hotelName || '').localeCompare(b.hotelName || '') || a.name.localeCompare(b.name));

      // Sub-unit breakdown for this position (LCPP group)
      const subTotals = {};
      if (isGroup) {
        emps.forEach(e => {
          if (e.subUnit) {
            if (!subTotals[e.subUnit]) subTotals[e.subUnit] = { minutes: 0, shifts: 0 };
            subTotals[e.subUnit].minutes += e.minutes;
            subTotals[e.subUnit].shifts  += e.shifts;
          }
        });
      }

      return `
        <div class="pr-block">
          <div class="pr-block-head">
            <div class="pr-block-title">${esc(pos)}</div>
            <div class="pr-block-meta">${emps.length} employé${emps.length > 1 ? 's' : ''} · ${group.shifts} shift${group.shifts > 1 ? 's' : ''}</div>
            <div class="pr-block-total">${fmtDurH(group.minutes)}</div>
          </div>
          <table class="pr-block-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Propriété${isGroup ? ' / Unité' : ''}</th>
                <th style="text-align:right">Shifts</th>
                <th style="text-align:right">Heures</th>
                <th style="width:140px"></th>
              </tr>
            </thead>
            <tbody>
              ${emps.map(e => `
                <tr>
                  <td class="td-name">${esc(e.name)}</td>
                  <td>${esc(e.hotelName || '—')}${e.subUnit ? `<span class="pr-subunit-pill">${esc(e.subUnit)}</span>` : ''}</td>
                  <td style="text-align:right">${e.shifts}</td>
                  <td style="text-align:right" class="fw600">${fmtDurH(e.minutes)}</td>
                  <td><div class="bar-wrap"><div class="bar green" style="width:${Math.round(e.minutes/globalMax*100)}%"></div></div></td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="pr-block-foot-label">Total — ${esc(pos)}</td>
                <td style="text-align:right" class="pr-block-foot-total">${fmtDurH(group.minutes)}</td>
                <td></td>
              </tr>
              ${Object.keys(subTotals).length > 0 ? Object.entries(subTotals)
                .sort(([a],[b]) => a.localeCompare(b))
                .map(([su, d]) => `
                  <tr class="pr-subunit-row">
                    <td colspan="3" style="padding-left:24px;color:var(--gray-500);font-size:12px">↳ ${esc(su)}</td>
                    <td style="text-align:right;color:var(--gray-500);font-size:12px">${fmtDurH(d.minutes)}</td>
                    <td></td>
                  </tr>`).join('') : ''}
            </tfoot>
          </table>
        </div>`;
    }).join('');

    const periodLabel = `${from} — ${to}`;

    el.innerHTML = `
      <div class="pr-report-header">
        <div class="pr-report-period">${periodLabel}</div>
        ${position ? `<span class="badge badge-position">${esc(position)}</span>` : ''}
        ${hotelId ? `<span class="badge" style="background:var(--navy-100);color:var(--navy-800)">${esc(document.querySelector('#pr-hotel option:checked')?.textContent || '')}</span>` : ''}
      </div>

      <div class="stat-grid mb16" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card blue"><div class="stat-value">${payrollData.byEmployee.length}</div><div class="stat-label">Employés</div></div>
        <div class="stat-card green"><div class="stat-value">${payrollData.totalShifts}</div><div class="stat-label">Shifts validés</div></div>
        <div class="stat-card"><div class="stat-value">${fmtDurH(payrollData.totalMinutes)}</div><div class="stat-label">Total heures</div></div>
      </div>

      ${sortedPositions.length === 0
        ? `<div class="card"><div class="card-body empty-state text-muted">Aucun shift validé pour cette période.</div></div>`
        : blocksHTML}

      ${sortedPositions.length > 0 ? `
      <div class="pr-grand-total">
        <span class="pr-grand-total-label">TOTAL GÉNÉRAL</span>
        <span class="pr-grand-total-value">${fmtDurH(payrollData.totalMinutes)}</span>
      </div>` : ''}

      ${payrollData.byHotel && payrollData.byHotel.length > 1 ? `
      <details class="pr-details-section mt16">
        <summary>Détail par propriété</summary>
        <div class="table-wrap mt8">
          <table>
            <thead><tr><th>Propriété / Groupe</th><th>Shifts</th><th>Heures</th></tr></thead>
            <tbody>
              ${payrollData.byHotel.map(h => `
                <tr>
                  <td class="td-name">${esc(h.name)}</td>
                  <td>${h.shifts}</td>
                  <td class="fw600">${fmtDurH(h.minutes)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </details>` : ''}`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state text-muted">Erreur lors du chargement du rapport.</div>';
  }
}

function payrollExportQS() {
  const { from, to, hotelId, subUnit, position } = payrollParams;
  const qs = new URLSearchParams({ from, to });
  if (hotelId)  qs.set('hotelId',  hotelId);
  if (subUnit)  qs.set('subUnit',  subUnit);
  if (position) qs.set('position', position);
  return qs.toString();
}

function exportPayrollCSV() {
  window.open(`/api/payroll/export/csv?${payrollExportQS()}`);
}

function exportPayrollXLSX() {
  window.open(`/api/payroll/export/xlsx?${payrollExportQS()}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS — Historical view of validated hours by month
// ═══════════════════════════════════════════════════════════════════════════

async function renderAnalytics() {
  const body = document.getElementById('page-body');
  const hotels    = await GET('/api/hotels');
  let positions   = [];
  try { positions = (await GET('/api/positions')).positions || []; } catch {}
  const groupHotels = hotels.filter(h => h.isGroup && h.subUnits?.length > 0);
  const thisYear  = new Date().getFullYear();
  const years     = [thisYear, thisYear - 1, thisYear - 2];

  body.innerHTML = `
    <div class="card mb12">
      <div class="card-body" style="padding:14px 18px">
        <div class="filters">
          <select class="form-control" id="an-year">
            ${years.map(y => `<option value="${y}" ${y===thisYear?'selected':''}>${y}</option>`).join('')}
          </select>
          <select class="form-control" id="an-hotel" onchange="onAnalyticsHotelChange(${JSON.stringify(groupHotels)})">
            <option value="">Toutes les propriétés</option>
            ${hotels.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}
          </select>
          <select class="form-control" id="an-subunit" style="display:none">
            <option value="">Toutes les unités</option>
          </select>
          <select class="form-control" id="an-position">
            <option value="">Tous les postes</option>
            ${positions.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="an-load">Analyser</button>
        </div>
        <p class="text-muted text-sm mt12">Uniquement les shifts validés par les managers.</p>
      </div>
    </div>
    <div id="an-output"></div>`;

  document.getElementById('an-load').addEventListener('click', loadAnalytics);
  loadAnalytics();
}

function onAnalyticsHotelChange(groupHotels) {
  const sel     = document.getElementById('an-hotel');
  const subSel  = document.getElementById('an-subunit');
  const group   = groupHotels.find(h => h.id === sel.value);
  if (group) {
    subSel.innerHTML = '<option value="">Toutes les unités</option>' +
      group.subUnits.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    subSel.style.display = '';
  } else {
    subSel.innerHTML = '<option value="">Toutes les unités</option>';
    subSel.style.display = 'none';
  }
}

async function loadAnalytics() {
  const year     = document.getElementById('an-year').value;
  const hotelId  = document.getElementById('an-hotel').value;
  const position = document.getElementById('an-position').value;
  const el       = document.getElementById('an-output');
  el.innerHTML   = '<div class="empty-state text-muted">Chargement…</div>';

  const qs = new URLSearchParams({ year });
  if (hotelId)  qs.set('hotelId',  hotelId);
  if (position) qs.set('position', position);

  try {
    const data = await GET(`/api/analytics/summary?${qs.toString()}`);
    const { months, byPosition, total } = data;

    // Calculate max monthly minutes for bar scaling
    const maxMonthMins = Math.max(...months.map(m => m.minutes), 1);

    // Monthly bar chart
    const monthRowsHTML = months.map(m => {
      const pct  = Math.round(m.minutes / maxMonthMins * 100);
      const hasData = m.minutes > 0;
      return `
        <div class="an-month-row ${hasData ? '' : 'an-month-empty'}">
          <div class="an-month-label">${m.label.slice(0,3).toUpperCase()}</div>
          <div class="an-month-bar-wrap">
            <div class="an-month-bar" style="width:${pct}%"></div>
          </div>
          <div class="an-month-hours">${hasData ? fmtDurH(m.minutes) : '—'}</div>
          <div class="an-month-shifts">${hasData ? m.shifts + ' shift' + (m.shifts > 1 ? 's' : '') : ''}</div>
        </div>`;
    }).join('');

    // By-position breakdown
    const byPosHTML = byPosition.length === 0 ? '' : `
      <div class="card mt16">
        <div class="card-head">Par poste — ${year}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Poste</th>${months.filter(m=>m.minutes>0).slice(0,6).map(m=>`<th style="text-align:right">${m.label.slice(0,3)}</th>`).join('')}<th style="text-align:right">Total</th></tr></thead>
            <tbody>
              ${byPosition.map(p => {
                const posTotal = p.months.reduce((t, m) => t + m.minutes, 0);
                if (posTotal === 0) return '';
                const activeMths = months.filter(m => m.minutes > 0).slice(0, 6);
                return `<tr>
                  <td><span class="badge badge-position">${esc(p.position)}</span></td>
                  ${activeMths.map((m, i) => `<td style="text-align:right">${p.months[m.month-1].minutes > 0 ? fmtDurH(p.months[m.month-1].minutes) : '<span class="text-muted">—</span>'}</td>`).join('')}
                  <td style="text-align:right" class="fw600">${fmtDurH(posTotal)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    el.innerHTML = `
      <div class="stat-grid mb16" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card blue"><div class="stat-value">${total.employees}</div><div class="stat-label">Employés</div></div>
        <div class="stat-card green"><div class="stat-value">${total.shifts}</div><div class="stat-label">Shifts validés</div></div>
        <div class="stat-card"><div class="stat-value">${fmtDurH(total.minutes)}</div><div class="stat-label">Total heures ${year}</div></div>
      </div>

      <div class="card">
        <div class="card-head">
          <span>Vue mensuelle — ${year}</span>
          ${hotelId ? `<span class="text-muted text-sm">${esc(document.querySelector('#an-hotel option:checked')?.textContent || '')}</span>` : ''}
          ${position ? `<span class="badge badge-position">${esc(position)}</span>` : ''}
        </div>
        <div class="an-months-wrap">
          ${monthRowsHTML}
        </div>
      </div>

      ${byPosHTML}`;

  } catch (e) {
    el.innerHTML = '<div class="empty-state text-muted">Erreur lors du chargement des données.</div>';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MY ACCOUNT (all roles)
// ═══════════════════════════════════════════════════════════════════════════

async function renderAccount() {
  const body = document.getElementById('page-body');
  const user = getUser();

  body.innerHTML = `
    <div style="max-width:520px">

      <div class="card mb12">
        <div class="card-head">Account Information</div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
            <div><div class="text-muted text-sm">Name</div><div class="fw600">${esc(user.name)}</div></div>
            <div><div class="text-muted text-sm">Role</div><div>${roleBadge(user.role)}</div></div>
            <div><div class="text-muted text-sm">Email (login)</div><div class="fw600">${esc(user.email)}</div></div>
            ${user.hotelName ? `<div><div class="text-muted text-sm">Hotel</div><div class="fw600">${esc(user.hotelName)}${user.subUnit ? ' — ' + esc(user.subUnit) : ''}</div></div>` : ''}
          </div>
        </div>
      </div>

      <div class="card mb12">
        <div class="card-head">Change Email Address</div>
        <div class="card-body">
          <p class="text-muted text-sm mb12">Your email is used to sign in. Use a real address you have access to.</p>
          <div class="form-group mb12">
            <label>New Email Address</label>
            <input class="form-control" type="email" id="acc-email" value="${esc(user.email)}" autocomplete="email">
          </div>
          <button class="btn btn-primary" onclick="saveAccountEmail()">Update Email</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">Change Password</div>
        <div class="card-body">
          <div class="form-group mb12">
            <label>New Password</label>
            <input class="form-control" type="password" id="acc-pw" placeholder="At least 8 characters" autocomplete="new-password">
          </div>
          <div class="form-group mb12">
            <label>Confirm New Password</label>
            <input class="form-control" type="password" id="acc-pw2" placeholder="Repeat password" autocomplete="new-password">
          </div>
          <button class="btn btn-primary" onclick="saveAccountPassword()">Update Password</button>
        </div>
      </div>

    </div>`;
}

async function saveAccountEmail() {
  const email = document.getElementById('acc-email').value.trim();
  if (!email) { toast('Email is required.', 'err'); return; }
  try {
    const updated = await api('PUT', '/api/auth/profile', { email });
    // Refresh stored user
    const u = getUser();
    localStorage.setItem('htp_user', JSON.stringify({ ...u, email: updated.email }));
    toast('Email updated. Use the new address to sign in next time.', 'ok');
  } catch (e) { toast(e.error || 'Could not update email.', 'err'); }
}

async function saveAccountPassword() {
  const pw  = document.getElementById('acc-pw').value;
  const pw2 = document.getElementById('acc-pw2').value;
  if (!pw)       { toast('Please enter a new password.', 'err'); return; }
  if (pw.length < 8) { toast('Password must be at least 8 characters.', 'err'); return; }
  if (pw !== pw2) { toast('Passwords do not match.', 'err'); return; }
  try {
    await api('PUT', '/api/auth/profile', { password: pw });
    document.getElementById('acc-pw').value  = '';
    document.getElementById('acc-pw2').value = '';
    toast('Password updated.', 'ok');
  } catch (e) { toast(e.error || 'Could not update password.', 'err'); }
}

// ─── Misc utils ───────────────────────────────────────────────────────────────
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
