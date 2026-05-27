// Ancora Wine Map — main app.
// Loads window.WINES, window.MEMBERS; renders Leaflet map, sidebar filters,
// top search, mock login, member view.

const TYPE_COLOR = { Red: '#b8324a', White: '#e8d27a', 'Rosé': '#e08aa3', Sparkling: '#6fb3c9', Sweet: '#c794d6', Orange: '#d68a3a' };
const STORAGE_KEY = 'ancora-map-member';

// Wine-producing countries — used to color country polygons gold.
// Keys match the "name" property in the Natural Earth countries GeoJSON.
const WINE_COUNTRIES = new Set([
  'Italy', 'France', 'Spain', 'Portugal', 'Germany', 'Austria', 'Greece',
  'Hungary', 'United States of America', 'Argentina', 'Uruguay', 'Mexico',
  'South Africa', 'New Zealand', 'Australia', 'United Kingdom', 'Lebanon',
  'Armenia', 'Bosnia and Herz.', 'Bosnia and Herzegovina', 'Croatia',
  'Georgia', 'Cyprus', 'Chile', 'Slovenia', 'Switzerland', 'Romania',
  'Bulgaria', 'Moldova', 'Turkey', 'Czechia', 'Israel',
]);
// Our catalog labels USA wines as "California" / "Oregon" etc with country "California"/"Oregon"/"New York"/"Washington" — normalize for country polygon match.
const COUNTRY_TO_POLYGON = {
  California: 'United States of America',
  Oregon: 'United States of America',
  Washington: 'United States of America',
  'New York': 'United States of America',
  England: 'United Kingdom',
  'Bosnia & Herzegovina': 'Bosnia and Herz.',
  Cypru: 'Cyprus',
};

const state = {
  wines: [],
  filters: { type: new Set(), country: new Set(), region: new Set(), grape: new Set(), producer: new Set(), vintage: new Set(), body: new Set() },
  availability: { available: true, preorder: true, sold: false },
  maxPrice: 600,
  groupSearch: { region: '', grape: '', producer: '' },
  markers: [],
  regionLabels: [],
  member: null, // { email, name, purchases: [...] }
  memberView: 'all', // 'all' | 'mine'
  highlightWineKey: null, // when search picks one, draw extra ring
};

// ---------- Init ----------
const map = L.map('map', { worldCopyJump: true, minZoom: 2, zoomControl: true })
  .setView([35, 5], 3);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);
// Custom pane for region labels — sits above country polygons but below the dots.
map.createPane('regionLabels');
map.getPane('regionLabels').style.zIndex = 450;
map.getPane('regionLabels').style.pointerEvents = 'none';

(function init() {
  state.wines = (window.WINES || []).filter(w => w.lat != null && w.lng != null);
  document.getElementById('totalCount').textContent = state.wines.length;
  buildFilters();
  loadMemberFromStorage();
  loadCountryLayer();
  wireSearch();
  wireLogin();
  wireChat();
  renderMemberCtl();
  render(true);
  map.on('zoomend', updateRegionLabels);
})();

// ---------- Country polygon coloring ----------
function loadCountryLayer() {
  // World countries GeoJSON — Natural Earth 110m (~200KB, fast to load)
  fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
    .then(r => r.json())
    .then(geo => {
      L.geoJSON(geo, {
        style: feature => {
          const p = feature.properties || {};
          const name = p.ADMIN || p.NAME || p.name;
          const isWine = WINE_COUNTRIES.has(name);
          return {
            fillColor: isWine ? '#5a3a2f' : '#0c0709',
            weight: 0.4,
            color: isWine ? '#7a5544' : '#1f1418',
            fillOpacity: isWine ? 0.55 : 0.25,
          };
        },
        interactive: false,
      }).addTo(map);
    })
    .catch(err => console.warn('Country layer failed to load:', err));
}

// ---------- Filters ----------
function buildFilters() {
  renderFilterGroup('filter-type', 'type', countBy(state.wines, w => [w.type]));
  renderFilterGroup('filter-country', 'country', countBy(state.wines, w => [w.country]));
  renderFilterGroup('filter-region', 'region', countBy(state.wines, w => [w.region]), state.groupSearch.region);
  renderFilterGroup('filter-grape', 'grape', countBy(state.wines, w => w.grapes.length ? w.grapes : []), state.groupSearch.grape);
  renderFilterGroup('filter-producer', 'producer', countBy(state.wines, w => w.producer ? [w.producer] : []), state.groupSearch.producer);
  const vintageEntries = countBy(state.wines, w => w.vintage != null ? [String(w.vintage)] : [])
    .sort((a, b) => {
      const an = parseInt(a[0], 10), bn = parseInt(b[0], 10);
      if (isNaN(an) && isNaN(bn)) return 0;
      if (isNaN(an)) return 1;
      if (isNaN(bn)) return -1;
      return bn - an;
    });
  renderFilterGroup('filter-vintage', 'vintage', vintageEntries);
  renderFilterGroup('filter-body', 'body', countBy(state.wines, w => [w.body]));

  document.querySelectorAll('.clear-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      state.filters[btn.dataset.clear].clear();
      buildFilters();
      render();
    });
  });

  document.querySelectorAll('.toggle-btn[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle;
      state.availability[key] = !state.availability[key];
      btn.classList.toggle('on', state.availability[key]);
      render();
    });
  });

  for (const key of ['region', 'grape', 'producer']) {
    const input = document.getElementById(key + 'Search');
    if (!input) continue;
    input.addEventListener('input', () => {
      state.groupSearch[key] = input.value.trim().toLowerCase();
      const entries = key === 'region'
        ? countBy(state.wines, w => [w.region])
        : key === 'grape'
          ? countBy(state.wines, w => w.grapes.length ? w.grapes : [])
          : countBy(state.wines, w => w.producer ? [w.producer] : []);
      renderFilterGroup('filter-' + key, key, entries, state.groupSearch[key]);
    });
  }

  const priceRange = document.getElementById('priceRange');
  const priceLabel = document.getElementById('priceLabel');
  const updatePrice = () => {
    state.maxPrice = +priceRange.value;
    priceLabel.textContent = state.maxPrice >= 600 ? 'any' : `≤ $${state.maxPrice}`;
    render();
  };
  priceRange.addEventListener('input', updatePrice);
  updatePrice();
}

function countBy(arr, keyFn) {
  const counts = new Map();
  for (const item of arr) for (const k of keyFn(item)) counts.set(k, (counts.get(k) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function renderFilterGroup(containerId, key, entries, search) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const q = (search || '').toLowerCase();
  let shown = 0;
  for (const [value, count] of entries) {
    if (q && !String(value).toLowerCase().includes(q)) continue;
    const row = document.createElement('label');
    row.className = 'filter-row';
    const isChecked = state.filters[key].has(value);
    row.innerHTML = `<input type="checkbox" value="${escapeAttr(value)}"${isChecked ? ' checked' : ''}><span>${escapeHtml(value)}</span><span class="count">${count}</span>`;
    row.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) state.filters[key].add(value);
      else state.filters[key].delete(value);
      render();
    });
    container.appendChild(row);
    shown++;
  }
  if (q && shown === 0) {
    container.innerHTML = '<div style="color:var(--muted); font-size:11px; padding:6px;">No matches</div>';
  }
}

function passesFilters(w) {
  const f = state.filters;
  if (f.type.size && !f.type.has(w.type)) return false;
  if (f.country.size && !f.country.has(w.country)) return false;
  if (f.region.size && !f.region.has(w.region)) return false;
  if (f.body.size && !f.body.has(w.body)) return false;
  if (f.grape.size && !w.grapes.some(g => f.grape.has(g))) return false;
  if (f.producer.size && !f.producer.has(w.producer)) return false;
  if (f.vintage.size && !f.vintage.has(String(w.vintage))) return false;
  if (w.priceUSD > state.maxPrice) return false;
  const status = (w.status || '').toUpperCase();
  if (status === 'SOLD OUT' && !state.availability.sold) return false;
  if (status === 'PRE-ORDER' && !state.availability.preorder) return false;
  if (!status && !state.availability.available) return false;
  if (status === 'ON SALE' && !state.availability.available) return false;
  return true;
}

// ---------- Render markers ----------
function render(fitBounds) {
  state.markers.forEach(m => map.removeLayer(m));
  state.markers = [];
  state.regionLabels.forEach(t => map.removeLayer(t));
  state.regionLabels = [];

  // Choose which set of wines to draw
  let visibleWines;
  if (state.member && state.memberView === 'mine') {
    visibleWines = state.member.purchases.filter(w => w.lat != null && w.lng != null);
    document.getElementById('visibleCount').textContent = `${visibleWines.length} of your purchased wines`;
  } else {
    visibleWines = state.wines.filter(passesFilters);
    document.getElementById('visibleCount').textContent = visibleWines.length;
  }

  // Cluster by lat/lng (regions share coords)
  const byLocation = new Map();
  for (const w of visibleWines) {
    const key = `${w.lat.toFixed(3)},${w.lng.toFixed(3)}`;
    if (!byLocation.has(key)) byLocation.set(key, { lat: w.lat, lng: w.lng, region: w.region, country: w.country, wines: [] });
    byLocation.get(key).wines.push(w);
  }

  // Also overlay purchased wines as ghost dots if logged in + viewing all
  const purchasedKeys = new Set();
  if (state.member && state.memberView === 'all') {
    for (const w of state.member.purchases) {
      if (w.lat == null) continue;
      purchasedKeys.add(`${w.lat.toFixed(3)},${w.lng.toFixed(3)}`);
    }
  }

  const bounds = [];
  for (const cluster of byLocation.values()) {
    const dominantType = mostFrequent(cluster.wines.map(w => w.type));
    const color = TYPE_COLOR[dominantType] || '#b8324a';
    const radius = Math.min(28, 5 + Math.sqrt(cluster.wines.length) * 3);
    const isPurchased = purchasedKeys.has(`${cluster.lat.toFixed(3)},${cluster.lng.toFixed(3)}`);
    const marker = L.circleMarker([cluster.lat, cluster.lng], {
      radius,
      fillColor: color,
      color: isPurchased ? '#fff7c2' : '#fff',
      weight: isPurchased ? 3 : 1.5,
      opacity: 0.92,
      fillOpacity: 0.78,
    }).addTo(map);
    marker.bindPopup(() => buildPopup(cluster), { maxWidth: 360, maxHeight: 380 });
    state.markers.push(marker);
    bounds.push([cluster.lat, cluster.lng]);
  }

  // Region labels
  updateRegionLabels();

  if (fitBounds && bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
  }
}

function updateRegionLabels() {
  state.regionLabels.forEach(t => map.removeLayer(t));
  state.regionLabels = [];
  // Show every visible region — overlap is fine, this is background text.
  const visibleWines = (state.member && state.memberView === 'mine')
    ? state.member.purchases.filter(w => w.lat != null)
    : state.wines.filter(passesFilters);
  const byLocation = new Map();
  for (const w of visibleWines) {
    const key = `${w.lat.toFixed(3)},${w.lng.toFixed(3)}`;
    if (!byLocation.has(key)) byLocation.set(key, { lat: w.lat, lng: w.lng, region: w.region, count: 0 });
    byLocation.get(key).count++;
  }
  for (const c of byLocation.values()) {
    const t = L.marker([c.lat, c.lng], {
      icon: L.divIcon({ className: 'region-label', html: escapeHtml(c.region), iconSize: null, iconAnchor: [0, -10] }),
      interactive: false,
      keyboard: false,
      pane: 'regionLabels',
    }).addTo(map);
    state.regionLabels.push(t);
  }
}

// ---------- Popup ----------
function buildPopup(cluster) {
  // Sort: in-stock first, purchased highlighted, then by price
  const purchaseKeys = state.member ? new Set(state.member.purchases.map(w => normalizeName(w.name))) : new Set();
  const sorted = [...cluster.wines].sort((a, b) => {
    const aSold = (a.status || '').toUpperCase() === 'SOLD OUT' ? 1 : 0;
    const bSold = (b.status || '').toUpperCase() === 'SOLD OUT' ? 1 : 0;
    if (aSold !== bSold) return aSold - bSold;
    return a.priceUSD - b.priceUSD;
  });
  const winesHtml = sorted.map(w => {
    const statusBadge = statusToBadge(w.status);
    const memberBadge = purchaseKeys.has(normalizeName(w.name)) ? ' <span class="popup-status member">YOURS</span>' : '';
    const grapeStr = w.grapes && w.grapes.length ? w.grapes.join(', ') : '—';
    const url = w.shopUrl || ('https://ancoravino.wine/products/search?keyword=' + encodeURIComponent(w.name));
    return `
      <a class="popup-wine" href="${escapeAttr(url)}" target="_blank" rel="noopener">
        <div class="popup-name">${w.vintage ? w.vintage + ' ' : ''}${escapeHtml(w.name)}${statusBadge}${memberBadge}</div>
        <div class="popup-meta">${escapeHtml(grapeStr)} &middot; ${escapeHtml(w.type)}, ${escapeHtml(w.body || '')} &middot; <span class="popup-price">$${w.priceUSD}</span></div>
        <div class="popup-link">View on Ancora Vino →</div>
      </a>
    `;
  }).join('');
  return `
    <div class="popup-region">${escapeHtml(cluster.region)} &middot; ${escapeHtml(cluster.country)} &middot; ${cluster.wines.length} wine${cluster.wines.length === 1 ? '' : 's'}</div>
    ${winesHtml}
  `;
}

function statusToBadge(status) {
  const s = (status || '').toUpperCase();
  if (s === 'SOLD OUT') return ' <span class="popup-status sold">SOLD OUT</span>';
  if (s === 'PRE-ORDER') return ' <span class="popup-status pre">PRE-ORDER</span>';
  if (s === 'ON SALE') return ' <span class="popup-status sale">SALE</span>';
  return '';
}

function mostFrequent(arr) {
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ---------- Smart search (top bar) ----------
function wireSearch() {
  const input = document.getElementById('topSearchInput');
  const results = document.getElementById('topSearchResults');
  const wrap = document.getElementById('topSearch');
  let activeIndex = -1;
  let currentMatches = [];

  function close() { wrap.classList.remove('open'); activeIndex = -1; }
  function open() { wrap.classList.add('open'); }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { close(); return; }
    currentMatches = searchWines(q).slice(0, 12);
    results.innerHTML = '';
    activeIndex = -1;
    if (!currentMatches.length) {
      results.innerHTML = '<div class="result" style="color:var(--muted); cursor:default;">No matches</div>';
    } else {
      currentMatches.forEach((w, i) => {
        const el = document.createElement('div');
        el.className = 'result';
        el.innerHTML = `<div>${w.vintage ? w.vintage + ' ' : ''}${escapeHtml(w.name)}</div>
                        <div class="result-meta">${escapeHtml(w.region)}, ${escapeHtml(w.country)} &middot; ${escapeHtml(w.type)} &middot; $${w.priceUSD}</div>`;
        el.addEventListener('click', () => { selectMatch(w); input.value = ''; close(); });
        results.appendChild(el);
      });
    }
    open();
  });
  input.addEventListener('focus', () => { if (input.value.trim()) open(); });
  input.addEventListener('blur', () => setTimeout(close, 200));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, currentMatches.length - 1); highlightResult(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); highlightResult(); }
    else if (e.key === 'Enter' && currentMatches[activeIndex]) { selectMatch(currentMatches[activeIndex]); input.value = ''; close(); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  function highlightResult() {
    [...results.children].forEach((el, i) => el.classList.toggle('active', i === activeIndex));
  }
}

function searchWines(q) {
  // Rank by relevance: name match > producer > region > grape
  const scored = [];
  for (const w of state.wines) {
    const name = (w.vintage ? w.vintage + ' ' : '') + w.name;
    const nameL = name.toLowerCase();
    const producerL = (w.producer || '').toLowerCase();
    const regionL = (w.region || '').toLowerCase();
    const countryL = (w.country || '').toLowerCase();
    const grapeL = (w.grapes || []).join(' ').toLowerCase();
    let score = 0;
    if (nameL.includes(q)) score += 100 - nameL.indexOf(q); // earlier match scores higher
    if (producerL.includes(q)) score += 60;
    if (regionL.includes(q)) score += 40;
    if (countryL.includes(q)) score += 30;
    if (grapeL.includes(q)) score += 25;
    if (score > 0) scored.push([score, w]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map(s => s[1]);
}

function selectMatch(w) {
  state.highlightWineKey = `${w.lat.toFixed(3)},${w.lng.toFixed(3)}`;
  map.flyTo([w.lat, w.lng], 7, { duration: 0.8 });
  // Find the marker for this cluster and open it
  setTimeout(() => {
    for (const m of state.markers) {
      const ll = m.getLatLng();
      if (Math.abs(ll.lat - w.lat) < 0.01 && Math.abs(ll.lng - w.lng) < 0.01) {
        m.openPopup();
        break;
      }
    }
  }, 900);
}

// ---------- Login + member view ----------
function wireLogin() {
  const modal = document.getElementById('loginModal');
  const close = document.getElementById('loginClose');
  const cont = document.getElementById('loginContinue');
  const email = document.getElementById('loginEmail');
  close.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  cont.addEventListener('click', tryLogin);
  email.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

  function tryLogin() {
    const e = email.value.trim().toLowerCase();
    const acct = window.MEMBERS && window.MEMBERS[e];
    if (!acct) {
      // Demo: any unknown email creates an empty guest member, but flag it
      alert('Demo: that email isn\'t in the demo accounts. Try jessicadougherty4321@gmail.com or demo@ancoravino.wine');
      return;
    }
    state.member = { email: e, ...acct };
    state.memberView = 'mine';
    try { localStorage.setItem(STORAGE_KEY, e); } catch (_) {}
    modal.classList.remove('open');
    renderMemberCtl();
    showToast(`Welcome, ${acct.name}!`, 'You have signed in and can now see your purchased wines highlighted on the map.');
    render(true);
  }
}

function loadMemberFromStorage() {
  try {
    const e = localStorage.getItem(STORAGE_KEY);
    if (e && window.MEMBERS && window.MEMBERS[e]) {
      state.member = { email: e, ...window.MEMBERS[e] };
      state.memberView = 'mine';
    }
  } catch (_) {}
}

function renderMemberCtl() {
  const ctl = document.getElementById('memberCtl');
  if (!state.member) {
    ctl.innerHTML = '<button id="memberBtn">Member Log In</button>';
    document.getElementById('memberBtn').addEventListener('click', () => document.getElementById('loginModal').classList.add('open'));
  } else {
    const purchaseCount = state.member.purchases.filter(w => w.lat != null).length;
    ctl.innerHTML = `
      <div class="member-toggle">
        <button data-view="mine" class="${state.memberView === 'mine' ? 'on' : ''}">My wines (${purchaseCount})</button>
        <button data-view="all" class="${state.memberView === 'all' ? 'on' : ''}">All wines</button>
      </div>
      <div class="member-name"><b>${escapeHtml(state.member.name)}</b> · <a href="#" id="logoutLink" style="color:var(--muted); text-decoration: underline;">Sign out</a></div>
    `;
    ctl.querySelectorAll('.member-toggle button').forEach(b => {
      b.addEventListener('click', () => { state.memberView = b.dataset.view; renderMemberCtl(); render(true); });
    });
    document.getElementById('logoutLink').addEventListener('click', e => {
      e.preventDefault();
      state.member = null;
      state.memberView = 'all';
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      renderMemberCtl();
      render(true);
    });
  }
}

function showToast(title, body) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="icon">i</div><div><b>${escapeHtml(title)}</b><small>${escapeHtml(body)}</small></div>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 5000);
}

// ---------- Chatbot ----------
function wireChat() {
  const fab = document.getElementById('chatFab');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const body = document.getElementById('chatBody');
  const input = document.getElementById('chatInput');
  const send = document.getElementById('chatSend');
  let opened = false;

  fab.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !opened) {
      opened = true;
      botSay(`Hi — I can find any of Ancora Vino's 441 wines for you. Try a name like <i>"Brunello"</i>, a region like <i>"Sicily"</i>, a grape like <i>"Pinot Noir"</i>, or a request like <i>"Italian red under $40"</i>.`,
        ['Brunello', 'Champagne', 'Pinot Noir under $50', 'Sparkling rosé', 'Show me Sicily']);
    }
    setTimeout(() => input.focus(), 50);
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  const submit = () => {
    const q = input.value.trim();
    if (!q) return;
    userSay(q);
    input.value = '';
    setTimeout(() => answer(q), 250);
  };
  send.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  function userSay(text) {
    const m = document.createElement('div');
    m.className = 'chat-msg user';
    m.textContent = text;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  }
  function botSay(html, chips, wines) {
    const m = document.createElement('div');
    m.className = 'chat-msg bot';
    m.innerHTML = html;
    if (wines && wines.length) {
      const wrap = document.createElement('div');
      wrap.className = 'chat-wines';
      for (const w of wines) {
        const c = document.createElement('div');
        c.className = 'chat-wine-card';
        c.innerHTML = `<span class="p">$${w.priceUSD}</span><div class="n">${w.vintage ? w.vintage + ' ' : ''}${escapeHtml(w.name)}</div><div class="m">${escapeHtml(w.region)}, ${escapeHtml(w.country)} · ${escapeHtml(w.type)}${w.grapes && w.grapes.length ? ' · ' + escapeHtml(w.grapes.join(', ')) : ''}</div>`;
        c.addEventListener('click', () => selectMatch(w));
        wrap.appendChild(c);
      }
      m.appendChild(wrap);
    }
    if (chips && chips.length) {
      const wrap = document.createElement('div');
      wrap.className = 'chat-suggestions';
      for (const ch of chips) {
        const b = document.createElement('button');
        b.className = 'chat-chip';
        b.textContent = ch;
        b.addEventListener('click', () => { input.value = ch; submit(); });
        wrap.appendChild(b);
      }
      m.appendChild(wrap);
    }
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  }

  // Intent parsing — extracts type, country, region, grape, max price from natural-language query
  function answer(rawQuery) {
    const q = rawQuery.toLowerCase();
    const criteria = {};

    // type
    if (/\b(red|reds|rouge|rosso)\b/.test(q)) criteria.type = 'Red';
    else if (/\b(white|whites|blanc|bianco)\b/.test(q)) criteria.type = 'White';
    else if (/\b(sparkling|champagne|prosecco|cava|brut|crémant|cremant)\b/.test(q)) criteria.type = 'Sparkling';
    else if (/\b(rosé|rose|rosato)\b/.test(q)) criteria.type = 'Rosé';
    else if (/\b(sweet|dessert|port|sauternes|tokaji)\b/.test(q)) criteria.type = 'Sweet';
    else if (/\b(orange|skin contact|macerated)\b/.test(q)) criteria.type = 'Orange';

    // price ceiling — "under $40", "less than 30", "below 25"
    const priceMatch = /(?:under|below|less than|<|≤|max(?:imum)?)\s*\$?\s*(\d+)/.exec(q);
    if (priceMatch) criteria.maxPrice = parseInt(priceMatch[1], 10);

    // vintage
    const vintageMatch = /\b(19|20)\d{2}\b/.exec(q);
    if (vintageMatch) criteria.vintage = vintageMatch[0];

    // country
    for (const w of state.wines) {
      if (q.includes(w.country.toLowerCase()) && w.country.length > 3) {
        criteria.country = w.country;
        break;
      }
    }

    // Score every wine against the query — combine criteria filtering with smart text match
    const scored = [];
    for (const w of state.wines) {
      if (criteria.type && w.type !== criteria.type) continue;
      if (criteria.maxPrice && w.priceUSD > criteria.maxPrice) continue;
      if (criteria.vintage && String(w.vintage) !== criteria.vintage) continue;
      if (criteria.country && w.country !== criteria.country) continue;
      // Text relevance
      const nameL = (w.name + ' ' + (w.vintage || '')).toLowerCase();
      const producerL = (w.producer || '').toLowerCase();
      const regionL = (w.region || '').toLowerCase();
      const grapeL = (w.grapes || []).join(' ').toLowerCase();
      let score = 0;
      // pull out keywords from the query that aren't already used as criteria
      const tokens = q.split(/\s+/).filter(t => t.length > 2 && !['the','and','for','with','wine','wines','that','this','show','find','give','about','from','any','some','what','under','over','below','less','than','more','max','min'].includes(t));
      for (const tok of tokens) {
        if (nameL.includes(tok)) score += 30;
        if (producerL.includes(tok)) score += 25;
        if (regionL.includes(tok)) score += 20;
        if (grapeL.includes(tok)) score += 18;
      }
      // If no text criteria and there are filter criteria, score by having any criterion match
      if (score === 0 && (criteria.type || criteria.country || criteria.maxPrice)) score = 1;
      if (score > 0) scored.push([score, w]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const top = scored.slice(0, 5).map(s => s[1]);

    if (!top.length) {
      botSay(`I couldn't find any wines matching "${escapeHtml(rawQuery)}". Try a producer name, a region, a grape, or a wine style.`,
        ['Brunello', 'Pinot Noir', 'Sicily', 'Champagne']);
      return;
    }

    // Build narrative response
    const parts = [];
    if (criteria.type) parts.push(criteria.type.toLowerCase() + ' wines');
    else parts.push('matches');
    if (criteria.country) parts.push('from ' + criteria.country);
    if (criteria.vintage) parts.push('from ' + criteria.vintage);
    if (criteria.maxPrice) parts.push('under $' + criteria.maxPrice);
    const totalMatching = scored.length;
    const intro = `Found <b>${totalMatching}</b> ${parts.join(' ')}. Top ${top.length}:`;
    botSay(intro, null, top);

    // Auto-fly to the top match
    if (top[0]) selectMatch(top[0]);
  }
}

// ---------- Utils ----------
function normalizeName(s) { return String(s).toLowerCase().replace(/[‘’'"„«»“”]/g, '').replace(/\s+/g, ' ').trim(); }
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }
