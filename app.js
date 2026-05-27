// Ancora Wine Map — main app.
// Loads window.WINES, window.MEMBERS; renders Leaflet map, sidebar filters,
// top search, mock login, member view.

const TYPE_COLOR = { Red: '#b8324a', White: '#e8d27a', 'Rosé': '#e08aa3', Sparkling: '#6fb3c9', Sweet: '#c794d6', Orange: '#d68a3a' };
const STORAGE_KEY = 'ancora-map-member';
const CART_KEY = 'ancora-map-cart';
const DEFAULT_VIEW = { center: [35, 5], zoom: 3 };

// Small distinct palette — greedy graph coloring picks one of these per region
// such that no two regions within NEIGHBOR_KM of each other share a color.
const REGION_PALETTE = ['#a8463a', '#3d6a5e', '#a8763d', '#4a5e7a', '#7e3e5a', '#5a6a3e', '#8e5a4a', '#3e7a6b'];
const NEIGHBOR_KM = 350; // regions closer than this count as neighbors for coloring purposes

// Map admin-1 polygon names (as they appear in Natural Earth) → wine region in our data.
// This lets us color the Tuscany polygon when our wine says region="Tuscany",
// the Nouvelle-Aquitaine polygon for "Bordeaux", etc.
const ADMIN1_TO_WINE_REGION = {
  // Italy (20 regions)
  'Toscana': 'Tuscany', 'Tuscany': 'Tuscany',
  'Piemonte': 'Piedmont', 'Piedmont': 'Piedmont',
  'Sicilia': 'Sicily', 'Sicily': 'Sicily',
  'Sardegna': 'Sardinia', 'Sardinia': 'Sardinia',
  'Lombardia': 'Lombardy', 'Lombardy': 'Lombardy',
  'Puglia': 'Puglia', 'Apulia': 'Puglia',
  'Marche': 'Marches', 'Marches': 'Marches',
  'Emilia-Romagna': 'Emilia-Romagna',
  'Veneto': 'Veneto',
  'Friuli-Venezia Giulia': 'Friuli', 'Friuli Venezia Giulia': 'Friuli',
  'Liguria': 'Liguria',
  'Umbria': 'Umbria',
  'Lazio': 'Lazio',
  'Campania': 'Campania',
  'Calabria': 'Calabria',
  'Abruzzo': 'Abruzzo', 'Abruzzi': 'Abruzzo',
  'Molise': 'Molise',
  'Basilicata': 'Basilicata',
  'Trentino-Alto Adige': 'Trento', 'Trentino-Alto Adige/Sudtirol': 'Trento',
  "Valle d'Aosta": 'Aosta Valley', "Vallée d'Aoste": 'Aosta Valley',
  // France — both old (22) and new (13) regions
  'Aquitaine': 'Bordeaux', 'Nouvelle-Aquitaine': 'Bordeaux',
  'Bourgogne': 'Burgundy', 'Bourgogne-Franche-Comté': 'Burgundy',
  'Champagne-Ardenne': 'Champagne', 'Grand Est': 'Champagne',
  'Alsace': 'Alsace',
  'Auvergne-Rhône-Alpes': 'Rhône', 'Rhône-Alpes': 'Rhône', 'Rhone-Alpes': 'Rhône',
  "Provence-Alpes-Côte d'Azur": 'Provence', 'Provence-Alpes-Cote-d\'Azur': 'Provence', "Provence-Alpes-Côte-d'Azur": 'Provence',
  'Languedoc-Roussillon': 'Languedoc', 'Occitanie': 'Languedoc',
  'Midi-Pyrénées': 'Cahors', 'Midi-Pyrenees': 'Cahors',
  'Pays de la Loire': 'Loire Valley', 'Centre': 'Loire Valley', 'Centre-Val de Loire': 'Loire Valley',
  'Corse': 'Corsica', 'Corsica': 'Corsica',
  'Franche-Comté': 'Jura', 'Franche-Comte': 'Jura',
  // Spain (autonomous communities)
  'La Rioja': 'Rioja',
  'Galicia': 'Rías Baixas',
  'Cataluña': 'Penedès', 'Catalunya': 'Penedès', 'Catalonia': 'Penedès',
  'Castilla-La Mancha': 'Castile-La Mancha',
  'Castilla y León': 'Ribera del Duero', 'Castile and León': 'Ribera del Duero',
  'Comunidad Valenciana': 'Valencia',
  // Portugal
  'Norte': 'Douro',
  'Alentejo': 'Alentejo',
  'Lisboa': 'Lisboa', 'Lisbon': 'Lisboa',
  'Centro': 'Dão',
  // Germany
  'Rheinland-Pfalz': 'Mosel', 'Rhineland-Palatinate': 'Mosel',
  'Hessen': 'Rheingau', 'Hesse': 'Rheingau',
  'Baden-Württemberg': 'Baden', 'Baden-Wurttemberg': 'Baden',
  // Austria
  'Niederösterreich': 'Niederösterreich', 'Lower Austria': 'Niederösterreich',
  // USA states
  'California': 'California',
  'Oregon': 'Willamette Valley',
  'Washington': 'Columbia Valley',
  'New York': 'Finger Lakes',
  // South Africa
  'Western Cape': 'Western Cape',
  // Argentina
  'Mendoza': 'Mendoza',
  // Australia states
  'Victoria': 'Victoria',
  'South Australia': 'McLaren Vale',
  // New Zealand regions
  'Marlborough': 'Marlborough',
  // Hungary
  'Borsod-Abaúj-Zemplén': 'Tokaj',
  // Greece
  'Attiki': 'Attica', 'Attica': 'Attica',
  'Crete': 'Crete', 'Kriti': 'Crete',
  // UK
  'Kent': 'Kent',
};

function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Computes a stable color per region using greedy coloring on the proximity graph.
// Returns a Map<region, color>.
function computeRegionColors(regionCenters) {
  const regions = [...regionCenters.entries()]
    .map(([key, c]) => ({ key, ...c }))
    // Process by latitude (north→south) for a deterministic order
    .sort((a, b) => b.lat - a.lat || a.lng - b.lng);
  const colorMap = new Map();
  for (const r of regions) {
    const used = new Set();
    for (const [otherKey, otherColor] of colorMap.entries()) {
      const other = regionCenters.get(otherKey);
      if (kmBetween(r.lat, r.lng, other.lat, other.lng) < NEIGHBOR_KM) used.add(otherColor);
    }
    const color = REGION_PALETTE.find(c => !used.has(c)) || REGION_PALETTE[regions.indexOf(r) % REGION_PALETTE.length];
    colorMap.set(r.key, color);
  }
  return colorMap;
}
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
  cart: [], // demo cart: [{ name, vintage, priceUSD, qty }]
  hasUserPannedOrZoomed: false,
  regionFillLayers: [],
};

// ---------- Init ----------
const map = L.map('map', { worldCopyJump: true, minZoom: 2, zoomControl: true })
  .setView([35, 5], 3);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);
// Custom panes — z-index order: regionFills (350) < labels (450) < dots (550)
map.createPane('regionFills');
map.getPane('regionFills').style.zIndex = 350;
map.getPane('regionFills').style.pointerEvents = 'none';
map.createPane('regionLabels');
map.getPane('regionLabels').style.zIndex = 450;
map.getPane('regionLabels').style.pointerEvents = 'none';
map.createPane('wineDots');
map.getPane('wineDots').style.zIndex = 550;

(function init() {
  state.wines = (window.WINES || []).filter(w => w.lat != null && w.lng != null);
  document.getElementById('totalCount').textContent = state.wines.length;
  loadCart();
  buildFilters();
  loadMemberFromStorage();
  loadCountryLayer();
  wireSearch();
  wireLogin();
  wireChat();
  wireWineModal();
  wireResetZoom();
  wireResetFilters();
  renderMemberCtl();
  render(true);
  map.on('zoomend', updateRegionLabels);
  // Track user interaction so we know not to auto-fit after the first render
  map.on('zoomstart movestart', () => {
    if (state.markers.length) state.hasUserPannedOrZoomed = true;
  });
})();

// ---------- Region coloring (semi-transparent circles per wine region) ----------
function loadCountryLayer() {
  const wineRegionsInUse = new Set(state.wines.map(w => w.region));

  // Sources: Italy + France region polygons (country-specific datasets are far smaller
  // than Natural Earth 10m). Each property name differs — we normalize via nameExtractor.
  // renderAll=true: render every polygon in this source (so the country looks whole).
  // renderAll=false: only render polygons that map to a wine region we have wines from.
  const sources = [
    {
      url: 'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_regions.geojson',
      nameExtractor: p => p.den_reg || p.reg_name,
      renderAll: true,
    },
    {
      url: 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions-avant-redecoupage-2015.geojson',
      nameExtractor: p => p.nom,
      renderAll: true,
    },
    {
      // Natural Earth 50m — USA states + Australia/Brazil/etc. (just render wine ones)
      url: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson',
      nameExtractor: p => p.name || p.name_en,
      renderAll: false,
    },
  ];

  // Render circles for everything first (covers any region whose polygon won't load)
  renderRegionCircles();

  Promise.all(sources.map(s =>
    fetch(s.url).then(r => r.json()).then(geo => ({ geo, ext: s.nameExtractor, renderAll: s.renderAll })).catch(() => null)
  )).then(results => {
    const allMatched = [];
    for (const r of results) {
      if (!r) continue;
      for (const f of r.geo.features) {
        const name = r.ext(f.properties || {});
        const mapped = ADMIN1_TO_WINE_REGION[name];
        const isWine = mapped && wineRegionsInUse.has(mapped);
        if (r.renderAll || isWine) {
          allMatched.push({ feature: f, name, wineRegion: isWine ? mapped : null });
        }
      }
    }
    renderRegionPolygonsFromMatched(allMatched);
  });
}

function renderRegionPolygonsFromMatched(matched) {
  // Compute centroid for each
  for (const m of matched) {
    const layer = L.geoJSON(m.feature);
    const b = layer.getBounds();
    m.center = b.getCenter();
    m.span = Math.max(
      kmBetween(b.getNorth(), m.center.lng, b.getSouth(), m.center.lng),
      kmBetween(m.center.lat, b.getWest(), m.center.lat, b.getEast())
    );
  }
  // Sort north→south for deterministic graph coloring order
  matched.sort((a, b) => b.center.lat - a.center.lat || a.center.lng - b.center.lng);
  const colorFor = new Map();
  for (const m of matched) {
    const used = new Set();
    for (const other of matched) {
      if (other === m || !colorFor.has(other)) continue;
      if (kmBetween(m.center.lat, m.center.lng, other.center.lat, other.center.lng) < 350) {
        used.add(colorFor.get(other));
      }
    }
    const color = REGION_PALETTE.find(c => !used.has(c)) || REGION_PALETTE[matched.indexOf(m) % REGION_PALETTE.length];
    colorFor.set(m, color);
  }

  // Clear circle fallbacks (admin-1 polygons replace them) and draw polygons
  state.regionFillLayers.forEach(l => map.removeLayer(l));
  state.regionFillLayers = [];
  state.regionLabels.forEach(l => map.removeLayer(l));
  state.regionLabels = [];

  for (const m of matched) {
    const color = colorFor.get(m);
    const layer = L.geoJSON(m.feature, {
      style: { fillColor: color, color: '#2a1d1f', weight: 0.7, fillOpacity: 0.62 },
      pane: 'regionFills',
      interactive: false,
    }).addTo(map);
    layer._labelCenter = m.center;
    layer._labelName = m.wineRegion;
    layer._labelSpan = m.span;
    state.regionFillLayers.push(layer);
  }
  updateRegionLabels();
}

function renderRegionPolygons(geo, wineRegionsInUse) {
  // Keep only features whose admin-1 name maps to a wine region we have wines from
  const features = geo.features.filter(f => {
    const p = f.properties || {};
    const name = p.name || p.NAME || p.name_en || p.NAME_EN;
    const mapped = ADMIN1_TO_WINE_REGION[name];
    return mapped && wineRegionsInUse.has(mapped);
  });

  // Compute a color per feature so neighbors differ (greedy graph coloring by centroid distance)
  const centers = features.map(f => {
    const layer = L.geoJSON(f);
    const c = layer.getBounds().getCenter();
    return { feature: f, lat: c.lat, lng: c.lng };
  });
  // Sort by latitude (north→south) for a deterministic order
  centers.sort((a, b) => b.lat - a.lat || a.lng - b.lng);
  const colorForFeature = new Map();
  for (const c of centers) {
    const used = new Set();
    for (const [otherFeature, otherColor] of colorForFeature.entries()) {
      const other = centers.find(x => x.feature === otherFeature);
      if (!other) continue;
      if (kmBetween(c.lat, c.lng, other.lat, other.lng) < 600) used.add(otherColor);
    }
    const color = REGION_PALETTE.find(p => !used.has(p)) || REGION_PALETTE[centers.indexOf(c) % REGION_PALETTE.length];
    colorForFeature.set(c.feature, color);
  }

  // Clear existing layers
  state.regionFillLayers.forEach(l => map.removeLayer(l));
  state.regionFillLayers = [];
  state.regionLabels.forEach(l => map.removeLayer(l));
  state.regionLabels = [];

  // Draw polygons
  for (const f of features) {
    const p = f.properties || {};
    const name = p.name || p.NAME || p.name_en || p.NAME_EN;
    const wineRegion = ADMIN1_TO_WINE_REGION[name];
    const color = colorForFeature.get(f);
    const layer = L.geoJSON(f, {
      style: {
        fillColor: color,
        color: '#2a1d1f',
        weight: 0.7,
        fillOpacity: 0.62,
      },
      pane: 'regionFills',
      interactive: false,
    }).addTo(map);
    state.regionFillLayers.push(layer);
    // Stash for label rendering
    const bounds = layer.getBounds();
    const c = bounds.getCenter();
    layer._labelCenter = c;
    layer._labelName = wineRegion;
    layer._labelSpan = Math.max(
      kmBetween(bounds.getNorth(), c.lng, bounds.getSouth(), c.lng),
      kmBetween(c.lat, bounds.getWest(), c.lat, bounds.getEast())
    );
  }
  updateRegionLabels();
}

// Fallback: old circles approach (used if GeoJSON fetch fails)
function renderRegionCircles() {
  const regionCenters = new Map();
  for (const w of state.wines) {
    if (w.lat == null) continue;
    const key = `${w.region}|${w.country}`;
    if (!regionCenters.has(key)) regionCenters.set(key, { lat: w.lat, lng: w.lng, region: w.region, country: w.country });
  }
  const colorMap = computeRegionColors(regionCenters);
  state.regionFillLayers.forEach(l => map.removeLayer(l));
  state.regionFillLayers = [];
  for (const [key, r] of regionCenters.entries()) {
    const c = L.circle([r.lat, r.lng], {
      radius: 120000, fillColor: colorMap.get(key), color: colorMap.get(key),
      weight: 0, fillOpacity: 0.55, pane: 'regionFills', interactive: false,
    }).addTo(map);
    state.regionFillLayers.push(c);
  }
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

  // Choose which set of wines to draw — filters apply in both views
  let visibleWines;
  if (state.member && state.memberView === 'mine') {
    const placed = state.member.purchases.filter(w => w.lat != null && w.lng != null);
    visibleWines = placed.filter(passesFilters);
    document.getElementById('visibleCount').textContent = `${visibleWines.length} of your ${placed.length} purchased wines`;
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
      opacity: 0.95,
      fillOpacity: 0.92,
      pane: 'wineDots',
    }).addTo(map);
    marker._cluster = cluster;
    marker.bindPopup(() => buildPopup(cluster), { maxWidth: 360, maxHeight: 380 });
    state.markers.push(marker);
    bounds.push([cluster.lat, cluster.lng]);
  }

  // Region labels
  updateRegionLabels();

  // Only auto-fit on the very first render. After the user has moved/zoomed,
  // we never change their view — they have a Reset Zoom button for that.
  if (fitBounds && bounds.length && !state.hasUserPannedOrZoomed) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
  }
}

function updateRegionLabels() {
  state.regionLabels.forEach(t => map.removeLayer(t));
  state.regionLabels = [];
  const zoom = map.getZoom();
  // Below zoom 4 nothing; above, bigger regions appear sooner than smaller ones
  if (zoom < 4) return;

  // If we have polygons, label them by their centroid.
  // A region shows up when (zoom + log2(km_span/100)) >= 6 — smaller regions need more zoom.
  if (state.regionFillLayers.length && state.regionFillLayers[0]._labelCenter) {
    const fontSize = Math.min(14, 9 + (zoom - 4));
    for (const layer of state.regionFillLayers) {
      if (!layer._labelCenter || !layer._labelName) continue; // skip un-named (non-wine) regions
      const span = layer._labelSpan || 150;
      const visibilityScore = zoom + Math.log2(span / 100);
      if (visibilityScore < 5.0) continue; // too small at this zoom
      const t = L.marker(layer._labelCenter, {
        icon: L.divIcon({
          className: 'region-label',
          html: `<span style="font-size:${fontSize}px">${escapeHtml(layer._labelName)}</span>`,
          iconSize: null,
          iconAnchor: [0, 0],
        }),
        interactive: false,
        keyboard: false,
        pane: 'regionLabels',
      }).addTo(map);
      state.regionLabels.push(t);
    }
    return;
  }

  // Fallback: label by wine dot clusters (when polygons unavailable)
  if (zoom < 5) return;
  const visibleWines = (state.member && state.memberView === 'mine')
    ? state.member.purchases.filter(w => w.lat != null).filter(passesFilters)
    : state.wines.filter(passesFilters);
  const byLocation = new Map();
  for (const w of visibleWines) {
    const key = `${w.lat.toFixed(3)},${w.lng.toFixed(3)}`;
    if (!byLocation.has(key)) byLocation.set(key, { lat: w.lat, lng: w.lng, region: w.region, count: 0 });
    byLocation.get(key).count++;
  }
  const limit = zoom <= 5 ? 12 : zoom <= 6 ? 28 : zoom <= 7 ? 60 : 200;
  const clusters = [...byLocation.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  const fontSize = Math.min(13, 9 + (zoom - 5));
  for (const c of clusters) {
    const t = L.marker([c.lat, c.lng], {
      icon: L.divIcon({ className: 'region-label', html: `<span style="font-size:${fontSize}px">${escapeHtml(c.region)}</span>`, iconSize: null, iconAnchor: [0, -8] }),
      interactive: false, keyboard: false, pane: 'regionLabels',
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
    const lookupKey = w.productId || normalizeName((w.vintage ? w.vintage + ' ' : '') + w.name);
    return `
      <div class="popup-wine" data-wine-key="${escapeAttr(lookupKey)}">
        <div class="popup-name">${w.vintage ? w.vintage + ' ' : ''}${escapeHtml(w.name)}${statusBadge}${memberBadge}</div>
        <div class="popup-meta">${escapeHtml(grapeStr)} &middot; ${escapeHtml(w.type)}, ${escapeHtml(w.body || '')} &middot; <span class="popup-price">$${w.priceUSD}</span></div>
        <div class="popup-link">View this wine →</div>
      </div>
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
    // Allow auto-fit on initial sign-in (counts as initial render of member view)
    state.hasUserPannedOrZoomed = false;
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
  const cartQty = state.cart.reduce((s, c) => s + c.qty, 0);
  const cartHtml = cartQty > 0
    ? `<span class="cart-badge" id="cartBadge" title="Demo cart">🛒 <span class="n">${cartQty}</span></span>`
    : '';
  if (!state.member) {
    ctl.innerHTML = cartHtml + '<button id="memberBtn">Member Log In</button>';
    document.getElementById('memberBtn').addEventListener('click', () => document.getElementById('loginModal').classList.add('open'));
  } else {
    const purchaseCount = state.member.purchases.filter(w => w.lat != null).length;
    const initials = state.member.name.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
    ctl.innerHTML = `
      ${cartHtml}
      <div class="member-toggle">
        <button data-view="mine" class="${state.memberView === 'mine' ? 'on' : ''}">My wines (${purchaseCount})</button>
        <button data-view="all" class="${state.memberView === 'all' ? 'on' : ''}">All wines</button>
      </div>
      <div class="member-name"><span class="avatar" title="${escapeAttr(state.member.email)}">${escapeHtml(initials)}</span><b>${escapeHtml(state.member.name)}</b></div>
      <button class="sign-out-btn" id="logoutBtn">Sign out</button>
    `;
    ctl.querySelectorAll('.member-toggle button').forEach(b => {
      b.addEventListener('click', () => {
        state.memberView = b.dataset.view;
        renderMemberCtl();
        render(false); // preserve current zoom
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      state.member = null;
      state.memberView = 'all';
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      renderMemberCtl();
      render(false);
    });
  }
  const cartEl = document.getElementById('cartBadge');
  if (cartEl) cartEl.addEventListener('click', showCartSummary);
}

function showCartSummary() {
  if (!state.cart.length) return;
  const total = state.cart.reduce((s, c) => s + c.priceUSD * c.qty, 0);
  const lines = state.cart.map(c => `${c.qty}× ${c.vintage ? c.vintage + ' ' : ''}${c.name} — $${(c.priceUSD * c.qty).toFixed(2)}`).join('\n');
  alert(`Cart (demo — checkout is not wired):\n\n${lines}\n\nTotal: $${total.toFixed(2)}`);
}

function showToast(title, body) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="icon">i</div><div><b>${escapeHtml(title)}</b><small>${escapeHtml(body)}</small></div>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 5000);
}

// ---------- Wine detail modal + cart ----------
function wireWineModal() {
  const modal = document.getElementById('wineModal');
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const anyOpen = modal.classList.contains('open')
      || document.getElementById('chatPanel').classList.contains('open')
      || document.getElementById('loginModal').classList.contains('open');
    if (anyOpen) {
      modal.classList.remove('open');
      document.getElementById('chatPanel').classList.remove('open');
      document.getElementById('loginModal').classList.remove('open');
    } else {
      // No modal — reset the map zoom
      resetZoom();
    }
  });
  // Use event delegation on document — survives popup re-renders, no stale references
  document.body.addEventListener('click', e => {
    const el = e.target.closest('.popup-wine[data-wine-key]');
    if (!el) return;
    const key = el.dataset.wineKey;
    // Try productId first (numeric), then normalized name
    let wine = state.wines.find(w => String(w.productId) === key);
    if (!wine && state.member) {
      wine = state.member.purchases.find(w => {
        const k = w.productId ? String(w.productId) : normalizeName((w.vintage ? w.vintage + ' ' : '') + w.name);
        return k === key;
      });
    }
    if (!wine) {
      wine = state.wines.find(w => normalizeName((w.vintage ? w.vintage + ' ' : '') + w.name) === key);
    }
    if (wine) showWineCard(wine);
  });
}

function showWineCard(w) {
  const modal = document.getElementById('wineModal');
  const card = document.getElementById('wineCard');
  const status = (w.status || '').toUpperCase();
  const isSold = status === 'SOLD OUT';
  const isPre = status === 'PRE-ORDER';
  const grapeStr = w.grapes && w.grapes.length ? w.grapes.join(', ') : '—';
  const purchaseKeys = state.member ? new Set(state.member.purchases.map(p => normalizeName(p.name))) : new Set();
  const isYours = purchaseKeys.has(normalizeName(w.name));
  const shopUrl = w.shopUrl || ('https://ancoravino.wine/products/search?keyword=' + encodeURIComponent(w.name));
  const stockText = isSold ? 'Sold out at Ancora Vino' : isPre ? 'Pre-order — shipping soon' : 'In stock at Ancora Vino';
  const stockCls = isSold ? 'sold' : isPre ? 'pre' : '';
  card.innerHTML = `
    <button class="close" id="wineCardClose">×</button>
    <div class="wc-region">${escapeHtml(w.region)} &middot; ${escapeHtml(w.country)}${isYours ? ' &middot; <span style="color:var(--gold)">YOURS</span>' : ''}</div>
    <div class="wc-name">${escapeHtml(w.name)}</div>
    <div class="wc-vintage">${w.vintage ? 'Vintage ' + w.vintage : 'Non-vintage'}${w.producer ? ' &middot; ' + escapeHtml(w.producer) : ''}</div>
    <div class="wc-divider"></div>
    <div class="wc-detail-row"><span class="k">Type</span><span class="v">${escapeHtml(w.type)}</span></div>
    <div class="wc-detail-row"><span class="k">Body</span><span class="v">${escapeHtml(w.body || '—')}</span></div>
    <div class="wc-detail-row"><span class="k">Grape</span><span class="v">${escapeHtml(grapeStr)}</span></div>
    ${w.orderedDate ? `<div class="wc-detail-row"><span class="k">You bought</span><span class="v">${escapeHtml(w.orderedDate)}</span></div>` : ''}
    <div class="wc-price">$${w.priceUSD}</div>
    <div class="wc-stock ${stockCls}">${stockText}</div>
    <div class="wc-actions">
      <button class="wc-btn primary" id="wcAddBtn"${isSold ? ' disabled' : ''}>${isSold ? 'Sold out' : 'Add to cart'}</button>
      <a class="wc-btn secondary" href="${escapeAttr(w.cartUrl || shopUrl)}" target="_blank" rel="noopener">${w.cartUrl && !isSold ? 'Buy on Ancora Vino' : 'View on Ancora Vino'} →</a>
    </div>
  `;
  modal.classList.add('open');
  document.getElementById('wineCardClose').addEventListener('click', () => modal.classList.remove('open'));
  const addBtn = document.getElementById('wcAddBtn');
  if (addBtn && !isSold) {
    addBtn.addEventListener('click', () => addToCart(w));
  }
}

// ---------- Cart (demo only — stored in localStorage) ----------
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) state.cart = JSON.parse(raw) || [];
  } catch (_) { state.cart = []; }
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (_) {}
}
function addToCart(w) {
  const key = normalizeName((w.vintage ? w.vintage + ' ' : '') + w.name);
  const existing = state.cart.find(c => c.key === key);
  if (existing) existing.qty += 1;
  else state.cart.push({ key, name: w.name, vintage: w.vintage, priceUSD: w.priceUSD, qty: 1 });
  saveCart();
  renderCartBadge();
  showToast('Added to cart', `${w.vintage ? w.vintage + ' ' : ''}${w.name} · $${w.priceUSD}`);
}
function renderCartBadge() {
  const ctl = document.getElementById('memberCtl');
  if (!ctl) return;
  // Re-render member control which also renders the cart badge inline
  renderMemberCtl();
}

// ---------- Reset zoom — go all the way out ----------
function resetZoom() {
  map.flyTo([20, 0], 2, { duration: 0.6 });
}
function wireResetZoom() {
  document.getElementById('resetZoom').addEventListener('click', resetZoom);
}

// ---------- Reset filters ----------
function wireResetFilters() {
  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    // Clear every selected filter
    for (const k of Object.keys(state.filters)) state.filters[k].clear();
    // Reset group searches
    for (const k of Object.keys(state.groupSearch)) state.groupSearch[k] = '';
    // Reset availability toggles to defaults
    state.availability = { available: true, preorder: true, sold: false };
    // Reset price slider
    state.maxPrice = 600;
    const priceRange = document.getElementById('priceRange');
    if (priceRange) priceRange.value = 600;
    const priceLabel = document.getElementById('priceLabel');
    if (priceLabel) priceLabel.textContent = 'any';
    // Reset all per-group search inputs in the DOM
    ['regionSearch', 'grapeSearch', 'producerSearch'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    // Re-render filter groups (just the inner content — don't re-attach static listeners)
    renderFilterGroup('filter-type', 'type', countBy(state.wines, w => [w.type]));
    renderFilterGroup('filter-country', 'country', countBy(state.wines, w => [w.country]));
    renderFilterGroup('filter-region', 'region', countBy(state.wines, w => [w.region]));
    renderFilterGroup('filter-grape', 'grape', countBy(state.wines, w => w.grapes.length ? w.grapes : []));
    renderFilterGroup('filter-producer', 'producer', countBy(state.wines, w => w.producer ? [w.producer] : []));
    renderFilterGroup('filter-body', 'body', countBy(state.wines, w => [w.body]));
    const vintageEntries = countBy(state.wines, w => w.vintage != null ? [String(w.vintage)] : [])
      .sort((a, b) => { const an = parseInt(a[0], 10), bn = parseInt(b[0], 10); if (isNaN(an) && isNaN(bn)) return 0; if (isNaN(an)) return 1; if (isNaN(bn)) return -1; return bn - an; });
    renderFilterGroup('filter-vintage', 'vintage', vintageEntries);
    // Sync availability button visual state
    document.querySelectorAll('.toggle-btn[data-toggle]').forEach(btn => {
      btn.classList.toggle('on', state.availability[btn.dataset.toggle]);
    });
    render(false);
  });
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
      botSay(`Hi — I can find any of Ancora Vino's 441 wines for you. Try a name like <i>"Sancerre"</i>, a region like <i>"Sicily"</i>, a grape like <i>"Pinot Noir"</i>, or a request like <i>"Italian red under $40"</i>.`,
        ['Sancerre', 'Pinot Noir', 'Brunello', 'Italian red under $40', 'Champagne']);
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

  // Appellation synonyms — when user says "Brunello" we also search "Montalcino" + "Sangiovese"
  const SYNONYMS = {
    brunello: ['montalcino', 'sangiovese'],
    'vino nobile': ['montepulciano', 'sangiovese'],
    barolo: ['nebbiolo', 'piedmont', 'piemonte'],
    barbaresco: ['nebbiolo', 'piedmont', 'piemonte'],
    chianti: ['tuscany', 'sangiovese'],
    'super tuscan': ['tuscany', 'cabernet', 'sangiovese'],
    amarone: ['valpolicella', 'corvina'],
    ripasso: ['valpolicella', 'corvina'],
    soave: ['garganega', 'veneto'],
    prosecco: ['glera', 'veneto'],
    franciacorta: ['chardonnay', 'lombardy'],
    sancerre: ['sauvignon blanc', 'loire'],
    'pouilly-fumé': ['sauvignon blanc', 'loire'],
    'pouilly-fume': ['sauvignon blanc', 'loire'],
    'pouilly-fuissé': ['chardonnay', 'burgundy', 'mâcon'],
    chablis: ['chardonnay', 'burgundy'],
    bourgogne: ['burgundy', 'pinot noir', 'chardonnay'],
    sauternes: ['bordeaux', 'sémillon', 'sweet'],
    'st-émilion': ['bordeaux', 'merlot'],
    'saint-émilion': ['bordeaux', 'merlot'],
    pomerol: ['bordeaux', 'merlot'],
    médoc: ['bordeaux', 'cabernet'],
    pauillac: ['bordeaux', 'cabernet'],
    margaux: ['bordeaux', 'cabernet'],
    'côtes du rhône': ['rhône', 'grenache', 'syrah'],
    'cotes du rhone': ['rhône', 'grenache', 'syrah'],
    'châteauneuf': ['rhône', 'grenache'],
    'côte rôtie': ['rhône', 'syrah'],
    hermitage: ['rhône', 'syrah'],
    bandol: ['provence', 'mourvèdre'],
    beaujolais: ['gamay'],
    brouilly: ['beaujolais', 'gamay'],
    fleurie: ['beaujolais', 'gamay'],
    morgon: ['beaujolais', 'gamay'],
    vouvray: ['loire', 'chenin blanc'],
    muscadet: ['loire', 'melon de bourgogne'],
    cahors: ['malbec'],
    champagne: ['pinot noir', 'chardonnay', 'pinot meunier'],
    rioja: ['tempranillo', 'spain'],
    'ribera del duero': ['tempranillo', 'spain'],
    priorat: ['garnacha', 'spain'],
    albariño: ['rías baixas', 'spain'],
    albarino: ['rías baixas', 'spain'],
    cava: ['spain', 'sparkling'],
    porto: ['douro', 'port', 'portugal'],
    port: ['douro', 'portugal'],
    'vinho verde': ['portugal', 'alvarinho'],
    tokaji: ['hungary', 'furmint', 'sweet'],
    mosel: ['germany', 'riesling'],
    rheingau: ['germany', 'riesling'],
    napa: ['california', 'cabernet sauvignon'],
    sonoma: ['california', 'pinot noir', 'chardonnay'],
    willamette: ['oregon', 'pinot noir'],
    'finger lakes': ['new york', 'riesling'],
    barossa: ['australia', 'shiraz'],
    marlborough: ['new zealand', 'sauvignon blanc'],
    'central otago': ['new zealand', 'pinot noir'],
    mendoza: ['argentina', 'malbec'],
  };

  function expandQuery(q) {
    const tokens = new Set([q]);
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (q.includes(key)) for (const s of syns) tokens.add(s);
    }
    return [...tokens];
  }

  // Intent parsing — extracts type, country, region, grape, max price from natural-language query
  function answer(rawQuery) {
    const q = rawQuery.toLowerCase();
    const criteria = {};
    const synonymsHit = [];
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (q.includes(key)) synonymsHit.push(...syns);
    }

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

    // Build search tokens: real query tokens + synonym expansions
    const STOPWORDS = new Set(['the','and','for','with','wine','wines','that','this','show','find','give','about','from','any','some','what','under','over','below','less','than','more','max','min','red','white','sparkling','rose','rosé','sweet','orange','italian','french','spanish','german','american','please','have','want','like','one','tell','recommend','suggest','need','looking','search','map']);
    const queryTokens = q.split(/[\s,]+/).filter(t => t.length > 2 && !STOPWORDS.has(t));
    const searchTokens = [...new Set([...queryTokens, ...synonymsHit])];

    const scored = [];
    for (const w of state.wines) {
      if (criteria.type && w.type !== criteria.type) continue;
      if (criteria.maxPrice && w.priceUSD > criteria.maxPrice) continue;
      if (criteria.vintage && String(w.vintage) !== criteria.vintage) continue;
      if (criteria.country && w.country !== criteria.country) continue;
      const nameL = ((w.vintage ? w.vintage + ' ' : '') + w.name).toLowerCase();
      const producerL = (w.producer || '').toLowerCase();
      const regionL = (w.region || '').toLowerCase();
      const countryL = (w.country || '').toLowerCase();
      const grapeL = (w.grapes || []).join(' ').toLowerCase();
      let score = 0;
      for (const tok of searchTokens) {
        if (nameL.includes(tok)) score += 50;
        if (producerL.includes(tok)) score += 35;
        if (regionL.includes(tok)) score += 30;
        if (grapeL.includes(tok)) score += 25;
        if (countryL.includes(tok)) score += 15;
      }
      // If no text match but filter criteria are set, still include
      if (score === 0 && (criteria.type || criteria.country || criteria.maxPrice || criteria.vintage)) score = 1;
      if (score > 0) scored.push([score, w]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const top = scored.slice(0, 5).map(s => s[1]);

    if (!top.length) {
      botSay(`No wines match <i>"${escapeHtml(rawQuery)}"</i>. The catalog has 441 wines — try a famous region or grape.`,
        ['Sancerre', 'Pinot Noir', 'Sicily', 'Tuscany', 'Champagne', 'Albariño']);
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
