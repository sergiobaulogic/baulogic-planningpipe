/* =================================================================
   BAULOGIC PLANNING PORTAL
   v1.1 - Adds Companies House + dev status enrichment display
   ================================================================= */

const STATE = {
  data: null,
  filtered: [],
  filters: {
    search: '', tier: '', area: '', status: '',
    hideDead: false,
  },
  status: loadStatus(),
  notes:  loadNotes(),
};

const STATUS_OPTIONS = [
  { key: 'new',          label: 'New' },
  { key: 'contacted',    label: 'Contacted' },
  { key: 'conversation', label: 'In Conversation' },
  { key: 'scheme',       label: 'Scheme Logged' },
  { key: 'dead',         label: 'Dead' },
];

const SCHEMES_TARGET = 20;

function loadStatus() {
  try { return JSON.parse(localStorage.getItem('baulogic.status') || '{}'); }
  catch { return {}; }
}
function loadNotes() {
  try { return JSON.parse(localStorage.getItem('baulogic.notes') || '{}'); }
  catch { return {}; }
}
function saveStatus() { localStorage.setItem('baulogic.status', JSON.stringify(STATE.status)); }
function saveNotes()  { localStorage.setItem('baulogic.notes',  JSON.stringify(STATE.notes));  }

function getStatus(id) { return STATE.status[id] || 'new'; }
function setStatus(id, status) {
  if (status === 'new') delete STATE.status[id];
  else STATE.status[id] = status;
  saveStatus();
}
function getNotes(id) { return STATE.notes[id] || ''; }
function setNotes(id, value) {
  if (!value || !value.trim()) delete STATE.notes[id];
  else STATE.notes[id] = value;
  saveNotes();
}

function fmtMoney(low, high) {
  if (low == null && high == null) return '—';
  if (low === high || high == null) return `£${low}m`;
  return `£${low}–${high}m`;
}
function fmtUnits(n) { return n === 1 ? '1 unit' : `${n} units`; }
function tierShort(tier) {
  if (!tier) return '';
  if (tier.startsWith('Single')) return 'Single Premium';
  if (tier.startsWith('Boutique')) return 'Boutique';
  return 'Boutique Developer';
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Quality helpers ------------------------------------------------- */
function qualityScore(p) { return p.dataQuality?.score ?? null; }
function qualityBand(p) {
  const s = qualityScore(p);
  if (s == null) return 'unscored';
  if (s >= 70)   return 'good';
  if (s >= 40)   return 'mixed';
  return 'poor';
}
function qualityLabel(p) {
  const s = qualityScore(p);
  if (s == null) return 'Not checked';
  if (s >= 70)   return `Strong (${s})`;
  if (s >= 40)   return `Mixed (${s})`;
  return `Weak (${s})`;
}
function companyStatusLabel(p) {
  const ch = p.companyHouse;
  if (!ch || !ch.status) return null;
  return ch.status.charAt(0).toUpperCase() + ch.status.slice(1);
}
function isProblematicCompany(p) {
  const ch = p.companyHouse;
  if (!ch) return false;
  if (!ch.status) return false;
  return ch.status !== 'active';
}

/* Data load ------------------------------------------------------- */
async function loadData() {
  const r = await fetch('data.json');
  STATE.data = await r.json();
  populateFilters();
  applyFilters();
  renderHeader();
}

function renderHeader() {
  const m = STATE.data.meta;
  document.getElementById('totalCount').textContent = m.qualifiedProjects;
  document.getElementById('metaSource').textContent = m.sourceFiles;
  document.getElementById('metaRaw').textContent = m.rawProjects.toLocaleString();
  document.getElementById('metaDate').textContent = m.enrichmentDate || m.generated;
}

function populateFilters() {
  const tiers = [...new Set(STATE.data.projects.map(p => p.qualifyTier))];
  const tierSel = document.getElementById('filterTier');
  tiers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    tierSel.appendChild(opt);
  });
  const areas = [...new Set(STATE.data.projects.map(p => p.primeArea))].sort();
  const areaSel = document.getElementById('filterArea');
  areas.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    areaSel.appendChild(opt);
  });
}

function applyFilters() {
  const { search, tier, area, status, hideDead } = STATE.filters;
  const q = search.toLowerCase().trim();
  STATE.filtered = STATE.data.projects.filter(p => {
    if (tier && p.qualifyTier !== tier) return false;
    if (area && p.primeArea !== area) return false;
    if (status && getStatus(p.id) !== status) return false;
    if (hideDead) {
      const score = qualityScore(p);
      if (score != null && score < 40) return false;
      if (isProblematicCompany(p)) return false;
    }
    if (q) {
      const hay = [
        p.heading, p.proposal, p.siteAddress, p.authority,
        p.applicant?.name, p.applicant?.contact,
        p.agent?.name, p.agent?.contact, p.agent?.email,
        p.primeArea, p.sitePostcode, p.county, p.region,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  // Sort: quality score descending if enriched, otherwise tier+value
  STATE.filtered.sort((a, b) => {
    const sa = qualityScore(a);
    const sb = qualityScore(b);
    if (sa != null && sb != null) return sb - sa;
    return (b.buildValueLow || 0) - (a.buildValueLow || 0);
  });
  renderGrid();
  renderSchemes();
}

function projectCard(p) {
  const status = getStatus(p.id);
  const statusOpt = STATUS_OPTIONS.find(s => s.key === status);
  const band = qualityBand(p);
  const ch = p.companyHouse;
  const dev = p.developmentStatus;

  let badges = '';
  if (band !== 'unscored') {
    badges += `<span class="quality-badge quality-${band}">${escapeHtml(qualityLabel(p))}</span>`;
  }
  if (ch?.status && ch.status !== 'active') {
    badges += `<span class="company-badge company-bad">${escapeHtml(ch.status)}</span>`;
  }
  if (ch?.isSPV) {
    badges += `<span class="company-badge company-spv">SPV</span>`;
  }
  if (dev?.status === 'likely_complete') {
    badges += `<span class="company-badge company-bad">Likely complete</span>`;
  }

  return `
    <article class="card ${band === 'poor' ? 'card-dimmed' : ''}" data-id="${escapeHtml(p.id)}">
      <span class="card-status status-${status}">${statusOpt.label}</span>
      <p class="card-tier">${escapeHtml(tierShort(p.qualifyTier))} · ${escapeHtml(p.primeArea || '')}</p>
      <h3 class="card-headline">${escapeHtml(p.heading || 'Unnamed project')}</h3>
      <p class="card-applicant">${escapeHtml(p.applicant?.name || 'Unknown applicant')}</p>
      ${badges ? `<div class="card-badges">${badges}</div>` : ''}
      <div class="card-meta">
        <span><span class="card-meta-value">${fmtUnits(p.units)}</span></span>
        <span><span class="card-meta-value">${fmtMoney(p.buildValueLow, p.buildValueHigh)}</span> build cost</span>
        ${p.agent?.email ? `<span style="margin-left:auto;color:var(--ember);">✉</span>` : ''}
      </div>
    </article>
  `;
}

function renderGrid() {
  const grid = document.getElementById('projectGrid');
  document.getElementById('resultCount').textContent = `${STATE.filtered.length} of ${STATE.data.projects.length}`;
  if (STATE.filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1;">
        <p class="empty-icon">◌</p>
        <p class="empty-title">No matches</p>
        <p class="empty-body">Try resetting the filters.</p>
      </div>`;
    return;
  }
  grid.innerHTML = STATE.filtered.map(projectCard).join('');
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function renderSchemes() {
  const tracked = STATE.data.projects.filter(p => getStatus(p.id) !== 'new');
  const schemeCount = tracked.filter(p => getStatus(p.id) === 'scheme').length;
  document.getElementById('schemesCount').textContent = schemeCount;
  document.getElementById('schemesProgress').textContent = schemeCount;

  const countsEl = document.getElementById('schemesCounts');
  const counts = {}; STATUS_OPTIONS.forEach(o => counts[o.key] = 0);
  tracked.forEach(p => counts[getStatus(p.id)]++);
  const colors = {
    contacted: 'var(--status-contacted)',
    conversation: 'var(--status-conversation)',
    scheme: 'var(--status-scheme)',
    dead: 'var(--status-dead)',
  };
  countsEl.innerHTML = STATUS_OPTIONS.filter(o => o.key !== 'new').map(o => `
    <span class="scheme-count-pill">
      <span class="scheme-count-dot" style="background:${colors[o.key]}"></span>
      ${counts[o.key]} ${escapeHtml(o.label)}
    </span>`).join('');

  drawProgressRing(schemeCount, SCHEMES_TARGET);

  const grid = document.getElementById('schemesGrid');
  const empty = document.getElementById('schemesEmpty');
  if (tracked.length === 0) {
    grid.innerHTML = ''; grid.style.display = 'none'; empty.style.display = 'block'; return;
  }
  empty.style.display = 'none'; grid.style.display = 'grid';
  const order = { scheme: 1, conversation: 2, contacted: 3, dead: 4 };
  tracked.sort((a, b) => order[getStatus(a.id)] - order[getStatus(b.id)]);
  grid.innerHTML = tracked.map(projectCard).join('');
  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function drawProgressRing(value, max) {
  const ring = document.getElementById('progressRing');
  const pct = Math.min(value / max, 1);
  const size = 180, stroke = 8, radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  ring.innerHTML = `
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="var(--ink-line)" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="var(--ember)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset 0.8s var(--ease)"/>
    </svg>
    <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column;">
      <span style="font-family:var(--display); font-size:48px; line-height:1; font-weight:400;">${value}</span>
      <span style="font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:0.18em; color:var(--bone-faded); margin-top:6px;">of ${max}</span>
    </div>`;
}

function openModal(id) {
  const p = STATE.data.projects.find(x => x.id === id);
  if (!p) return;
  const status = getStatus(p.id);
  const notes = getNotes(p.id);
  const body = document.getElementById('modalBody');

  const detail = (label, value) => `
    <div class="detail-row">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div class="detail-value">${value || '<span class="muted">Not in data</span>'}</div>
    </div>`;

  // Build the data quality section if enriched
  let qualitySection = '';
  if (p.dataQuality) {
    const flags = (p.dataQuality.flags || []).map(f => `<li>${escapeHtml(f)}</li>`).join('');
    qualitySection = `
      <div class="modal-section">
        <p class="modal-section-title">Data Quality</p>
        <div class="quality-summary">
          <span class="quality-badge quality-${qualityBand(p)} quality-large">${escapeHtml(qualityLabel(p))}</span>
        </div>
        ${flags ? `<ul class="quality-flags">${flags}</ul>` : '<p class="muted" style="margin-top:8px;">No issues flagged</p>'}
        ${p.companyHouse && p.companyHouse.status ? `
          <div class="detail-row" style="margin-top:16px;">
            <div class="detail-label">Companies House</div>
            <div class="detail-value">
              ${escapeHtml(p.companyHouse.name)}<br>
              <span class="muted">Status: ${escapeHtml(p.companyHouse.status)}${p.companyHouse.isSPV ? ' · Single-purpose vehicle' : ''}</span>
              ${p.companyHouse.number ? `<br><a href="https://find-and-update.company-information.service.gov.uk/company/${escapeHtml(p.companyHouse.number)}" target="_blank" rel="noopener">View on Companies House →</a>` : ''}
            </div>
          </div>` : ''}
        ${p.developmentStatus && p.developmentStatus.status !== 'unknown' ? `
          <div class="detail-row">
            <div class="detail-label">Dev status</div>
            <div class="detail-value">
              ${escapeHtml(p.developmentStatus.status.replace('_', ' '))}
              <span class="muted">(${escapeHtml(p.developmentStatus.confidence)} confidence)</span>
            </div>
          </div>` : ''}
      </div>`;
  }

  body.innerHTML = `
    <p class="modal-tier">${escapeHtml(p.qualifyTier)} · ${escapeHtml(p.primeArea || '')}</p>
    <h2 class="modal-title">${escapeHtml(p.heading || 'Unnamed project')}</h2>
    <p class="modal-applicant">${escapeHtml(p.applicant?.name || 'Unknown applicant')}</p>

    <div class="modal-section">
      <p class="modal-section-title">Status</p>
      <div class="modal-status-row">
        ${STATUS_OPTIONS.map(o => `
          <button class="status-btn ${o.key === status ? 'is-selected' : ''}" data-status="${o.key}">${escapeHtml(o.label)}</button>
        `).join('')}
      </div>
    </div>

    <div class="modal-section">
      <p class="modal-section-title">Notes</p>
      <textarea class="notes-area" id="notesArea" placeholder="Call notes, contact attempts, follow-ups…">${escapeHtml(notes)}</textarea>
    </div>

    ${qualitySection}

    <div class="modal-section">
      <p class="modal-section-title">Project</p>
      ${detail('Heading', escapeHtml(p.heading))}
      ${detail('Units', fmtUnits(p.units))}
      ${detail('Build value', fmtMoney(p.buildValueLow, p.buildValueHigh))}
      ${detail('Stage', escapeHtml(p.stage))}
      ${detail('Date', escapeHtml(p.date))}
      ${detail('Category', escapeHtml(p.category))}
      ${p.proposal ? detail('Proposal', escapeHtml(p.proposal)) : ''}
    </div>

    <div class="modal-section">
      <p class="modal-section-title">Site</p>
      ${detail('Address', escapeHtml(p.siteAddress))}
      ${detail('Postcode', escapeHtml(p.sitePostcode))}
      ${detail('Region', escapeHtml(p.region))}
      ${detail('County', escapeHtml(p.county))}
      ${detail('Authority', escapeHtml(p.authority))}
      ${detail('Planning ref', escapeHtml(p.planningRef))}
      ${detail('Planning portal', p.planningUrl ? `<a href="${escapeHtml(p.planningUrl)}" target="_blank" rel="noopener">Open application →</a>` : null)}
    </div>

    <div class="modal-section">
      <p class="modal-section-title">Applicant</p>
      ${detail('Company', escapeHtml(p.applicant?.name))}
      ${detail('Contact', escapeHtml(p.applicant?.contact))}
      ${detail('Phone', p.applicant?.phone ? `<a href="tel:${escapeHtml(p.applicant.phone)}">${escapeHtml(p.applicant.phone)}</a>` : null)}
    </div>

    <div class="modal-section">
      <p class="modal-section-title">Agent / Architect</p>
      ${detail('Company', escapeHtml(p.agent?.name))}
      ${detail('Contact', escapeHtml(p.agent?.contact))}
      ${detail('Phone', p.agent?.phone ? `<a href="tel:${escapeHtml(p.agent.phone)}">${escapeHtml(p.agent.phone)}</a>` : null)}
      ${detail('Email', p.agent?.email ? `<a href="mailto:${escapeHtml(p.agent.email)}">${escapeHtml(p.agent.email)}</a>` : null)}
    </div>
  `;

  body.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setStatus(p.id, btn.dataset.status);
      body.querySelectorAll('.status-btn').forEach(b => b.classList.toggle('is-selected', b === btn));
      renderGrid(); renderSchemes();
    });
  });

  const notesArea = body.querySelector('#notesArea');
  let notesTimer = null;
  notesArea.addEventListener('input', e => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => setNotes(p.id, e.target.value), 300);
  });

  document.getElementById('modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('tab-active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('panel-active', p.id === `tab-${name}`));
}

function wire() {
  document.querySelectorAll('.tab').forEach(t => {
    if (t.disabled) return;
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  document.getElementById('search').addEventListener('input', e => {
    STATE.filters.search = e.target.value; applyFilters();
  });
  document.getElementById('filterTier').addEventListener('change', e => {
    STATE.filters.tier = e.target.value; applyFilters();
  });
  document.getElementById('filterArea').addEventListener('change', e => {
    STATE.filters.area = e.target.value; applyFilters();
  });
  document.getElementById('filterStatus').addEventListener('change', e => {
    STATE.filters.status = e.target.value; applyFilters();
  });
  const hideDeadToggle = document.getElementById('hideDeadToggle');
  if (hideDeadToggle) {
    hideDeadToggle.addEventListener('change', e => {
      STATE.filters.hideDead = e.target.checked; applyFilters();
    });
  }
  document.getElementById('clearFilters').addEventListener('click', () => {
    STATE.filters = { search: '', tier: '', area: '', status: '', hideDead: false };
    document.getElementById('search').value = '';
    document.getElementById('filterTier').value = '';
    document.getElementById('filterArea').value = '';
    document.getElementById('filterStatus').value = '';
    if (hideDeadToggle) hideDeadToggle.checked = false;
    applyFilters();
  });
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

document.addEventListener('DOMContentLoaded', () => {
  wire();
  loadData().catch(err => {
    document.body.innerHTML = `<pre style="color:#fff; padding: 40px;">Error: ${err.message}</pre>`;
  });
});
