# Ancora Vino Wine Map

Interactive world map of Ancora Vino's 441-wine catalog, with filters,
search, a chatbot, and member purchase highlights.

**Live demo:** _set after first Vercel deploy_

## What's in the demo

- World map (Leaflet + CARTO dark tiles) with wine-producing countries highlighted
- 441 wines geocoded across ~30 regions worldwide, scraped from the Ancora Vino shop
- Filter sidebar matching the shop's filter set: type, country, region, grape, producer, vintage, body, price, availability
- Top search bar: type a name, producer, region, or grape — fuzzy match + auto-fly
- "Ask Ancora" chatbot (floating wine glass button) — natural-language queries like *"Italian red under $40"*
- Mock member login styled like ancoravino.wine — demo accounts:
  - `jessicadougherty4321@gmail.com` — loads Jessica's real 33-order purchase history (48 unique wines highlighted on the map)
  - `demo@ancoravino.wine` — sample 6-wine member account
- Clicking a wine opens its search page on ancoravino.wine in a new tab

## Local development

Static HTML + JS, no build step. Just open `index.html` in a browser, or:

```
python -m http.server 8000
```

## Re-scraping the catalog

When the shop catalog changes:

1. Re-run the Chrome-MCP scrape into `raw-catalog.json`
2. Refresh `jessica-orders.json` from the account page (if member view needs updating)
3. `node transform.js` rebuilds `wines.json`, `wines.data.js`, `jessica.data.js`

## Files

- `index.html` — markup, layout, login modal, chatbot panel
- `app.js` — map, filters, search, login, chatbot logic
- `wines.data.js` — embedded catalog (built from `wines.json`)
- `jessica.data.js` — Jessica's member purchase data
- `member-accounts.js` — demo accounts
- `transform.js` — Node script that turns the raw scrape into structured `wines.json`
- `raw-catalog.json`, `jessica-orders.json` — raw inputs to the transform

## Not yet real

- **Authentication** is mock — anyone can sign in as the demo emails. Real Ecwid/Lightspeed OAuth requires owner credentials.
- **Wine pages** link to a search on the shop, not direct product pages — direct URLs require productIDs from a full re-scrape.
- **Chatbot** is rule-based (keyword + filter matching), not an LLM. Swapping in Claude is a small change once an API key is set.
