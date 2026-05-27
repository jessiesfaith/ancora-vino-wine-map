// Demo member accounts — keyed by email (lowercased).
// In production this would be replaced by a real Ecwid/Lightspeed OAuth callback.
window.MEMBERS = {
  'jessicadougherty4321@gmail.com': {
    name: 'Jessica Dougherty',
    membership: 'ELS WC Member',
    discount: '15% WC Member Discount',
    purchases: (typeof window.JESSICA_WINES !== 'undefined') ? window.JESSICA_WINES : [],
  },
  'demo@ancoravino.wine': {
    name: 'Demo Customer',
    membership: 'Trial Member',
    discount: null,
    purchases: [], // populated at init below — picks a sample
  },
};

// Sample demo purchases — first wine per Italian region for variety
(function fillDemo() {
  const all = (typeof window.WINES !== 'undefined') ? window.WINES : [];
  const seenRegions = new Set();
  const sample = [];
  for (const w of all) {
    if (w.country !== 'Italy') continue;
    if (seenRegions.has(w.region)) continue;
    seenRegions.add(w.region);
    sample.push({ ...w, orderedDate: 'Sample order' });
    if (sample.length >= 6) break;
  }
  window.MEMBERS['demo@ancoravino.wine'].purchases = sample;
})();
