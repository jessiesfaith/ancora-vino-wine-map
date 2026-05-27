// Transforms raw-catalog.json (array of arrays scraped from ancoravino.wine)
// into wines.json (structured records with lat/lng, type, grape).
// Run: node transform.js

const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw-catalog.json'), 'utf8'));

// region/country -> [lat, lng]. Keyed by "Region, Country" exactly as it appears on the site.
// Coordinates are approximate centroids for the wine area, not the political capital.
const GEO = {
  // Italy
  'Sicily, Italy': [37.6, 14.0],
  'Piedmont, Italy': [44.7, 8.0],
  'Veneto, Italy': [45.55, 11.5],
  'Tuscany, Italy': [43.3, 11.3],
  'Romagna, Italy': [44.25, 12.0],
  'Emilia-Romagna, Italy': [44.65, 10.9],
  'Marches, Italy': [43.5, 13.2],
  'Le Marche, Italy': [43.5, 13.2],
  'Lombardy, Italy': [45.6, 9.8],
  'Liguria, Italy': [44.3, 9.3],
  'Trento, Italy': [46.07, 11.12],
  'Trentino, Italy': [46.07, 11.12],
  'Friuli, Italy': [45.95, 13.55],
  'Friuli-Venezia Giulia, Italy': [45.95, 13.55],
  'Umbria, Italy': [42.9, 12.5],
  'Campania, Italy': [40.85, 14.65],
  'Abruzzo, Italy': [42.35, 13.8],
  'Lazio, Italy': [41.9, 12.7],
  'Calabria, Italy': [38.9, 16.5],
  'Puglia, Italy': [40.7, 17.2],
  'Alto Adige, Italy': [46.5, 11.35],
  'Colli di Luni, Italy': [44.1, 9.95],
  'Colli di Luni, Liguria, Italy': [44.1, 9.95],
  'Sardinia, Italy': [40.1, 9.3],
  'Lipari, Italy': [38.47, 14.95],
  // France
  'Champagne, France': [49.05, 4.0],
  'Loire Valley, France': [47.4, 0.7],
  'Languedoc, France': [43.6, 3.2],
  'Rhône, France': [44.5, 4.85],
  'Bordeaux, France': [44.84, -0.58],
  'Burgundy, France': [47.05, 4.85],
  'Provence, France': [43.55, 6.0],
  'Chablis, France': [47.81, 3.8],
  'Bergerac, France': [44.85, 0.48],
  'Cahors, France': [44.45, 1.44],
  'Alsace, France': [48.25, 7.45],
  'Beaujolais, France': [46.15, 4.7],
  'Savoie, France': [45.57, 6.0],
  'Jura, France': [46.75, 5.6],
  'Corsica, France': [42.0, 9.05],
  'Faugères, France': [43.55, 3.18],
  'Gaillac, France': [43.9, 1.9],
  'Haute-Alps, France': [44.7, 6.3],
  // Spain
  'Rías Baixas, Spain': [42.4, -8.75],
  'Rìas Baixas, Spain': [42.4, -8.75],
  'Terra Alta, Spain': [41.0, 0.5],
  'Rioja, Spain': [42.45, -2.45],
  'Penedès, Spain': [41.4, 1.7],
  'Castile-La Mancha, Spain': [39.5, -3.0],
  'Ribera del Duero, Spain': [41.7, -3.7],
  'Bierzo, Spain': [42.55, -6.6],
  'Galicia, Spain': [42.75, -8.0],
  'Valencia, Spain': [39.5, -0.5],
  'Ribeira Sacra, Spain': [42.4, -7.5],
  // Portugal
  'Vinho Verde, Portugal': [41.7, -8.4],
  'Douro, Portugal': [41.15, -7.55],
  'Lisboa, Portugal': [39.0, -9.1],
  'Alentejo, Portugal': [38.5, -7.9],
  'Dão, Portugal': [40.5, -7.85],
  // Greece
  'Crete, Greece': [35.25, 24.85],
  'Attica, Greece': [38.0, 23.7],
  'Epirus, Greece': [39.7, 20.85],
  'Amyndeon, Greece': [40.69, 21.7],
  // Other Europe
  'Tokaj, Hungary': [48.12, 21.41],
  'Rheinhessen, Germany': [49.85, 8.1],
  'Rheingau, Germany': [50.0, 8.0],
  'Nahe, Germany': [49.85, 7.85],
  'Mosel, Germany': [49.95, 6.95],
  'Pfalz, Germany': [49.4, 8.15],
  'Baden, Germany': [48.5, 8.0],
  'Niederösterreich, Austria': [48.45, 15.8],
  'Wachau, Austria': [48.36, 15.43],
  'Kremstal, Austria': [48.42, 15.6],
  'Carnuntum, Austria': [48.1, 16.85],
  'Kent, England': [51.2, 0.7],
  'Mostar, Bosnia & Herzegovina': [43.34, 17.81],
  'Kakheti, Georgia': [41.9, 45.7],
  'Dalmatia, Croatia': [43.5, 16.4],
  'Limassol, Cypru': [34.7, 33.05],
  // Americas
  'Mendoza, Argentina': [-33.0, -68.85],
  'Canelones, Uruguay': [-34.5, -56.3],
  'Valle de Guadalupe, Mexico': [32.1, -116.6],
  // Africa, Oceania, Middle East
  'Western Cape, South Africa': [-33.4, 19.0],
  'Cape Coast, South Africa': [-34.0, 18.85],
  'Stellensbosch, South Africa': [-33.93, 18.86],
  'Marlborough, New Zealand': [-41.5, 173.95],
  'Victoria, Australia': [-37.0, 145.0],
  'McLaren Vale, Australia': [-35.22, 138.55],
  'Beqaa Valley, Lebanon': [33.85, 35.9],
  'Vayots Dzor, Armenia': [39.75, 45.35],
  // USA — California
  'Napa Valley, California': [38.5, -122.3],
  'Sonoma County, California': [38.5, -122.95],
  'Sonoma Coast, California': [38.4, -123.05],
  'Russian River Valley, California': [38.5, -122.85],
  'Anderson Valley, California': [39.0, -123.4],
  'Mendocino County, California': [39.3, -123.4],
  'Mendocino Coast Ridge, California': [39.0, -123.6],
  'Santa Cruz Mountains, California': [37.15, -122.05],
  'Santa Cruz Mountain, California': [37.15, -122.05],
  'Santa Cruz Mountains': [37.15, -122.05],
  'Santa Barbara County, California': [34.6, -120.0],
  'Santa Maria Valley, California': [34.95, -120.4],
  'Santa Ynez Valley, California': [34.6, -120.1],
  'Santa Lucia Highlands, California': [36.45, -121.4],
  'Santa Clara Valley, California': [37.25, -121.8],
  'Sta. Rita Hills, California': [34.6, -120.3],
  'Paso Robles, California': [35.63, -120.7],
  'Lodi, California': [38.13, -121.27],
  'Contra Costa County, California': [37.92, -121.95],
  'Amador County, California': [38.45, -120.65],
  'El Dorado, California': [38.7, -120.7],
  'El Dorado Hills, California': [38.7, -121.07],
  'Carmel Valley, California': [36.48, -121.73],
  'Carneros, California': [38.25, -122.35],
  'Edna Valley, California': [35.18, -120.6],
  'Monterey County, California': [36.24, -121.32],
  'San Benito County, California': [36.6, -121.07],
  'San Luis Obispo County, California': [35.28, -120.66],
  'Cienega Valley, California': [36.78, -121.4],
  'Alexander Valley, California': [38.78, -122.92],
  'Napa-Sonoma Valley, California': [38.4, -122.5],
  'North Coast, California': [38.8, -123.3],
  'Clarksburg, California': [38.42, -121.53],
  'California': [37.0, -120.0],
  'California, California': [37.0, -120.0],
  // USA — other
  'Willamette Valley, Oregon': [45.0, -123.05],
  'Eola-Amity HIlls, Oregon': [44.95, -123.13],
  'Columbia Valley, Oregon': [45.7, -120.4],
  'Columbia Gorge, Oregon': [45.7, -121.4],
  'Columbia Valley, Washington': [46.6, -119.4],
  'Yakima Valley, Washington': [46.4, -120.1],
  'Finger Lakes, New York': [42.7, -76.95],
};

// Wine type inference from product name and region keywords.
const TYPE_RULES = [
  { type: 'Sparkling', tests: [/champagne/i, /\bbrut\b/i, /\bcava\b/i, /\bprosecco\b/i, /\bsekt\b/i, /\bcrémant\b/i, /\bcremant\b/i, /\bfranciacorta\b/i, /\bmétodo classico\b/i, /\bmetodo classico\b/i, /\bméthode trad/i, /\bmethode trad/i, /\bpét.nat\b/i, /\bpet nat\b/i, /\bpet-nat\b/i, /\bfrizzante\b/i, /\bnouveau nouveau\b/i, /\bspumante\b/i, /\bmoscato d.?asti\b/i, /\bblanc de blancs\b/i, /\bblanc de noirs\b/i, /\bbrachetto d.?acqui\b/i, /\bextra brut\b/i, /\bdosage zéro\b/i, /\bnon dosato\b/i, /\bgrand cuvée\b/i, /\bgrande cuvée\b/i] },
  { type: 'Rosé', tests: [/(?:^|\W)rosé(?:$|\W)/i, /\brose\b(?!water)/i, /(?:^|\W)rosato(?:$|\W)/i, /(?:^|\W)rosado(?:$|\W)/i, /(?:^|\W)cerasuolo(?:$|\W)/i] },
  { type: 'Orange', tests: [/\borange\b/i, /\bskin contact\b/i, /\bmacerated\b/i, /\bmacération\b/i, /\bamber\b/i] },
  { type: 'Sweet', tests: [/\bsauternes\b/i, /\btokaji\b/i, /\bport\b/i, /\bmoelleux\b/i, /\bvendange tardive\b/i, /\bmarsala\b/i, /\bvin de liqueur\b/i, /\bvisciola\b/i] },
  { type: 'White', tests: [
    /\bblanc\b/i, /\bbianco\b/i, /\bblanco\b/i, /\bbranco\b/i, /\bwhite\b/i,
    /\bchardonnay\b/i, /\briesling\b/i, /\bsauvignon blanc\b/i, /\bpinot grigio\b/i, /\bpinot gris\b/i, /\bpinot blanc\b/i, /\bgewürztraminer\b/i, /\bgrüner veltliner\b/i, /\bgruner veltliner\b/i,
    /\bvermentino\b/i, /\bverdicchio\b/i, /\bfriulano\b/i, /\bsoave\b/i, /\bgavi\b/i, /\bgreco\b/i, /\bfalanghina\b/i, /\bfiano\b/i, /\bgarganega\b/i,
    /\balbariño\b/i, /\balbarino\b/i, /\bgodello\b/i, /\bmencía blanco\b/i, /\bvouvray\b/i, /\bchenin\b/i, /\bsancerre blanc\b/i, /\bsancerre\b/i, /\bpouilly-fum/i, /\bpouilly-fuiss/i, /\bmâcon/i, /\bmacon/i, /\bchablis\b/i, /\bpicpoul\b/i, /\bviognier\b/i, /\bmuscat\b/i,
    /\bencruzado\b/i, /\bxinomavro blanc\b/i, /\bassyrtiko\b/i, /\bsavatiano\b/i, /\bvidiano\b/i, /\bpromara\b/i, /\bcatarratto\b/i, /\bcortese\b/i, /\bgrechetto\b/i, /\barneis\b/i, /\bcortese\b/i, /\bvinho verde\b/i, /\bvermentino nero\b/i, /\bcarricante\b/i, /\bzilavka\b/i, /\bvoskehat\b/i, /\bsavatiano\b/i, /\bormosso\b/i, /\bsylvaner\b/i, /\bmuscadet\b/i, /\bpinot bianco\b/i, /\bdry white\b/i, /\bpaleokerisia\b/i, /\bpinot meunier blanc\b/i, /\btrebbiano\b/i, /\bortrugo\b/i,
  ] },
];

// Appellation/keyword in the wine NAME → implied grape(s).
// Used only when GRAPE_PATTERNS didn't find anything.
const APPELLATION_GRAPES = [
  [/champagne|coquillette|gonet|fluteau|gaston chiquet|veuve fourny|r\.h\. coutier|lassalle|bara |brocard|paul bara|tellier|lancelot|moussé|christophe mignon|emile paris|de bligny|coutier/i, ['Pinot Noir', 'Chardonnay']],
  [/blanc de blancs/i, ['Chardonnay']],
  [/blanc de noirs/i, ['Pinot Noir']],
  [/chablis|pouilly-fuissé|mâcon|saint-veran|st\.?-veran|saint-bris|mâcon|pouilly-fuiss|pouilly-vinz|montrachet|meursault/i, ['Chardonnay']],
  [/sancerre|pouilly[- ]?fumé|menetou-salon|touraine sauvignon|saint-bris/i, ['Sauvignon Blanc']],
  [/sauternes|barsac/i, ['Sémillon']],
  [/vouvray|montlouis|savennières/i, ['Chenin Blanc']],
  [/saint-julien|saint-émilion|pomerol|lalande de pomerol|pauillac|margaux|saint-estèphe|haut-médoc|graves rouge|listrac|moulis|fronsac|côtes de bordeaux/i, ['Cabernet Sauvignon', 'Merlot']],
  [/bordeaux blanc|graves blanc/i, ['Sauvignon Blanc', 'Sémillon']],
  [/cahors/i, ['Malbec']],
  [/bandol/i, ['Mourvèdre']],
  [/cairanne|gigondas|vacqueyras|châteauneuf-du-pape|côtes du rhône|cotes du rhone|côtes-du-rhône|cotes-du-rhone|côte rotie|côte-rôtie|cornas|vinsobres|rasteau|lirac|ventoux|costières/i, ['Grenache', 'Syrah']],
  [/crozes-hermitage blanc|condrieu/i, ['Viognier']],
  [/beaujolais|brouilly|fleurie|morgon|moulin-à-vent|chenas|chiroubles|juliénas|régnié|saint-amour|côte de brouilly/i, ['Gamay']],
  [/bourgogne (rouge|pinot noir)|pommard|volnay|gevrey|nuits-saint-georges|chambertin|santenay|mercurey|givry|côte de nuits|côte de beaune|coteaux bourguignons|chassagne-montrachet rouge|aloxe-corton/i, ['Pinot Noir']],
  [/bourgogne blanc|bourgogne chardonnay|aligoté|saint-aubin blanc|chassagne-montrachet blanc/i, ['Chardonnay']],
  [/chinon|bourgueil|saumur-champigny|anjou rouge/i, ['Cabernet Franc']],
  [/anjou blanc|saumur blanc/i, ['Chenin Blanc']],
  [/picpoul|picpoul de pinet/i, ['Picpoul']],
  [/minervois|corbières|languedoc rouge|faugères/i, ['Syrah', 'Grenache']],
  [/saint-chinian|languedoc blanc/i, ['Roussanne', 'Marsanne']],
  [/brunello|rosso di montalcino/i, ['Sangiovese']],
  [/vino nobile/i, ['Sangiovese']],
  [/chianti|carmignano|morellino|orcia|rosso di montepulciano|toscano (rosso|bianco)|toscana rosso/i, ['Sangiovese']],
  [/super[- ]tuscan|bolgheri rosso/i, ['Cabernet Sauvignon', 'Merlot']],
  [/bolgheri bianco|vermentino toscano/i, ['Vermentino']],
  [/barolo|barbaresco|langhe nebbiolo|roero|gattinara|ghemme|carema/i, ['Nebbiolo']],
  [/dolcetto/i, ['Dolcetto']],
  [/barbera/i, ['Barbera']],
  [/amarone|valpolicella|ripasso|recioto|bardolino/i, ['Corvina']],
  [/soave/i, ['Garganega']],
  [/prosecco|valdobbiadene|conegliano/i, ['Glera']],
  [/franciacorta/i, ['Chardonnay', 'Pinot Noir']],
  [/lugana/i, ['Trebbiano di Lugana']],
  [/oltrepò pavese pinot noir/i, ['Pinot Noir']],
  [/oltrepò pavese|valtellina|sforzato|inferno|sassella|grumello|valgella/i, ['Nebbiolo']],
  [/lambrusco/i, ['Lambrusco']],
  [/sangiovese di romagna|romagna sangiovese/i, ['Sangiovese']],
  [/albana/i, ['Albana']],
  [/verdicchio/i, ['Verdicchio']],
  [/montepulciano d.?abruzzo|cerasuolo d.?abruzzo|terre di chieti.*montepulciano/i, ['Montepulciano']],
  [/trebbiano d.?abruzzo|trebbiano /i, ['Trebbiano']],
  [/pecorino/i, ['Pecorino']],
  [/falanghina|lacryma christi/i, ['Falanghina']],
  [/greco di tufo|greco bianco/i, ['Greco']],
  [/fiano|fiano di avellino/i, ['Fiano']],
  [/aglianico|taurasi/i, ['Aglianico']],
  [/primitivo di manduria|primitivo|salice salentino/i, ['Primitivo']],
  [/nero d.?avola|nero di lupo/i, ["Nero d'Avola"]],
  [/etna rosso|nerello mascalese/i, ['Nerello Mascalese']],
  [/etna bianco|carricante/i, ['Carricante']],
  [/frappato/i, ['Frappato']],
  [/vermentino di sardegna|vermentino di gallura|vermentino/i, ['Vermentino']],
  [/cannonau/i, ['Grenache']],
  [/marsala/i, ['Grillo', 'Inzolia']],
  [/moscato d.?asti|moscato di /i, ['Moscato']],
  [/brachetto/i, ['Brachetto']],
  [/grignolino/i, ['Grignolino']],
  [/ruché|ruche/i, ['Ruché']],
  [/refosco/i, ['Refosco']],
  [/friulano|tocai/i, ['Friulano']],
  [/schioppettino/i, ['Schioppettino']],
  [/lagrein/i, ['Lagrein']],
  [/gewürztraminer|gewurztraminer/i, ['Gewürztraminer']],
  [/grüner veltliner|gruner veltliner/i, ['Grüner Veltliner']],
  [/zweigelt/i, ['Zweigelt']],
  [/blaufränkisch|blaufrankisch|lemberger/i, ['Blaufränkisch']],
  [/st\.? laurent|st\.? laurent/i, ['St. Laurent']],
  [/riesling|mosel|rheingau|nahe|pfalz|rheinhessen/i, ['Riesling']],
  [/spätburgunder|spatburgunder|pinot noir/i, ['Pinot Noir']],
  [/rioja blanco/i, ['Viura']],
  [/rioja|tempranillo|ribera del duero|reserva tinto|gran reserva/i, ['Tempranillo']],
  [/albariño|albarino|rías baixas|rìas baixas/i, ['Albariño']],
  [/mencía|mencia|bierzo|ribeira sacra/i, ['Mencía']],
  [/godello|valdeorras/i, ['Godello']],
  [/verdejo|rueda/i, ['Verdejo']],
  [/cava|raventós/i, ['Macabeo', 'Xarel·lo', 'Parellada']],
  [/garnacha|grenache|granache/i, ['Grenache']],
  [/monastrell/i, ['Mourvèdre']],
  [/xinomavro/i, ['Xinomavro']],
  [/assyrtiko/i, ['Assyrtiko']],
  [/vidiano/i, ['Vidiano']],
  [/savatiano/i, ['Savatiano']],
  [/promara/i, ['Promara']],
  [/vinho verde/i, ['Alvarinho', 'Loureiro']],
  [/tawny port|ruby port|vintage port|lbv port|colheita|port\b/i, ['Touriga Nacional', 'Tinta Roriz']],
  [/dão|douro tinto|alentejo tinto/i, ['Touriga Nacional']],
  [/encruzado/i, ['Encruzado']],
  [/furmint|tokaji/i, ['Furmint']],
  [/malbec|catalpa/i, ['Malbec']],
  [/carménère/i, ['Carménère']],
  [/pinotage/i, ['Pinotage']],
  [/sauvignon blanc/i, ['Sauvignon Blanc']],
  [/chenin blanc/i, ['Chenin Blanc']],
  [/chardonnay/i, ['Chardonnay']],
  [/pinot grigio|pinot gris/i, ['Pinot Gris']],
  [/pinot blanc|pinot bianco|weissburgunder|weißburgunder/i, ['Pinot Blanc']],
  [/cabernet sauvignon/i, ['Cabernet Sauvignon']],
  [/cabernet franc/i, ['Cabernet Franc']],
  [/merlot/i, ['Merlot']],
  [/syrah|shiraz/i, ['Syrah']],
  [/zinfandel/i, ['Zinfandel']],
  [/côtes de provence|coteaux varois en provence|provence rosé|provence/i, ['Grenache', 'Cinsault', 'Syrah']],
  [/tavel/i, ['Grenache']],
  [/bordeaux supérieur|bordeaux superieur|bordeaux rouge|bordeaux\b/i, ['Cabernet Sauvignon', 'Merlot']],
  [/méthode traditionnelle|methode traditionnelle|méthode trad|methode trad/i, ['Chenin Blanc']],
  [/pet.?nat|pétillant naturel|petillant naturel/i, ['Pét-Nat Blend']],
  [/vermouth/i, ['Trebbiano']],
  [/zilavka/i, ['Žilavka']],
  [/trousseau gris/i, ['Trousseau Gris']],
  [/braucol|fer servadou/i, ['Fer Servadou']],
  [/verdelho/i, ['Verdelho']],
  [/rossese/i, ['Rossese']],
  [/ortrugo/i, ['Ortrugo']],
  [/criolla/i, ['Criolla']],
  [/paleokerisia/i, ['Debina']],
  [/tinto|rosso|vino rosso/i, ['Red Blend']],
  [/bianco|blanco|branco|blanc\b|white blend/i, ['White Blend']],
  [/red blend|rouge\b/i, ['Red Blend']],
];

const GRAPE_PATTERNS = [
  ['Nebbiolo', /nebbiolo|barolo|barbaresco|langhe nebbiolo|roero/i],
  ['Sangiovese', /sangiovese|chianti|brunello|montalcino|montepulciano d.?abruzzo|rosso di montalcino|carmignano|morellino/i],
  ['Barbera', /barbera/i],
  ['Dolcetto', /dolcetto/i],
  ['Aglianico', /aglianico|taurasi/i],
  ['Primitivo', /primitivo|zinfandel/i],
  ['Montepulciano', /montepulciano d.?abruzzo|abbondanza montepulciano/i],
  ['Corvina', /amarone|valpolicella|ripasso/i],
  ['Frappato', /frappato/i],
  ['Nero d\'Avola', /nero d.?avola|nero di lupo|nivuru/i],
  ['Nerello Mascalese', /etna rosso|nerello/i],
  ['Lambrusco', /lambrusco/i],
  ['Pinot Noir', /pinot noir|spätburgunder|spatburgunder|borgo.*pinot/i],
  ['Chardonnay', /chardonnay/i],
  ['Sauvignon Blanc', /sauvignon blanc|sancerre|pouilly[- ]?fumé/i],
  ['Cabernet Sauvignon', /cabernet sauvignon/i],
  ['Cabernet Franc', /cabernet franc/i],
  ['Merlot', /merlot|pomerol/i],
  ['Syrah', /syrah|shiraz|côte.?rôtie|cote.?rotie|cornas|hermitage|crozes/i],
  ['Grenache', /grenache|garnacha|grenacha|côte.?du.?rhône blend/i],
  ['Mourvèdre', /mourvèdre|mataro|monastrell|bandol/i],
  ['Carignan', /carignan|carignane/i],
  ['Cinsault', /cinsault|cinsaut/i],
  ['Riesling', /riesling/i],
  ['Pinot Gris', /pinot gris|pinot grigio/i],
  ['Pinot Blanc', /pinot blanc|pinot bianco|weissburgunder|weißburgunder/i],
  ['Gewürztraminer', /gewürztraminer|gewurztraminer/i],
  ['Grüner Veltliner', /grüner veltliner|gruner veltliner|grüner vetliner/i],
  ['Chenin Blanc', /chenin|vouvray|savennières|saumur blanc/i],
  ['Viognier', /viognier|condrieu/i],
  ['Albariño', /albariño|albarino/i],
  ['Verdicchio', /verdicchio/i],
  ['Vermentino', /vermentino|rolle/i],
  ['Friulano', /friulano|tocai friulano/i],
  ['Garganega', /soave|garganega/i],
  ['Cortese', /gavi|cortese/i],
  ['Greco', /greco di tufo|greco bianco|greco /i],
  ['Falanghina', /falanghina/i],
  ['Fiano', /fiano/i],
  ['Glera', /prosecco|glera/i],
  ['Furmint', /furmint|tokaji/i],
  ['Assyrtiko', /assyrtiko/i],
  ['Xinomavro', /xinomavro/i],
  ['Savatiano', /savatiano/i],
  ['Vidiano', /vidiano/i],
  ['Tempranillo', /tempranillo|rioja(?!.*blanco)|ribera del duero|tinto fino/i],
  ['Mencía', /mencía|mencia|bierzo|ribeira sacra/i],
  ['Touriga Nacional', /touriga|douro tinto|dão tinto/i],
  ['Malbec', /malbec|cahors/i],
  ['Gamay', /gamay|beaujolais/i],
  ['Trebbiano', /trebbiano/i],
  ['Catarratto', /catarratto|cataratto/i],
  ['Picpoul', /picpoul/i],
  ['Brachetto', /brachetto/i],
  ['Moscato', /moscato|muscat/i],
  ['Zweigelt', /zweigelt/i],
  ['Blaufränkisch', /blaufränkisch|blaufrankisch/i],
  ['St. Laurent', /st\.? laurent/i],
  ['Pinot Meunier', /meunier|adn meunier/i],
  ['Refosco', /refosco/i],
  ['Schioppettino', /schioppettino/i],
  ['Lagrein', /lagrein/i],
  ['Bombino Nero', /bombino/i],
  ['Centesimino', /centesimino/i],
  ['Carricante', /carricante/i],
  ['Inzolia', /inzolia/i],
  ['Pecorino', /pecorino/i],
  ['Cortese', /cortese|gavi/i],
  ['Verdejo', /verdejo|rueda/i],
  ['Godello', /godello/i],
  ['Encruzado', /encruzado/i],
  ['Grechetto', /grechetto/i],
  ['Vermentino Nero', /vermentino nero/i],
  ['Ruché', /ruché|ruche/i],
  ['Roussanne', /roussanne/i],
  ['Marsanne', /marsanne/i],
  ['Touraine', /touraine/i],
];

const STATUS_LINES = new Set(['SOLD OUT', 'PRE-ORDER', 'ON SALE']);

// Patterns that match keywords in a wine NAME → [region, country].
// Used as a fallback when the row had no region info (e.g. legacy wines from order history).
// Region must already exist as a key (or via region-only fallback) in the GEO table.
const REGION_FROM_NAME = [
  // Italy
  [/chianti|brunello|montalcino|vino nobile|carmignano|morellino|toscana|tuscany|orcia|bolgheri/i, 'Tuscany', 'Italy'],
  [/barolo|barbaresco|langhe|roero|nebbiolo d.?alba|barbera d.?alba|dolcetto d.?alba|brachetto|gavi|moscato d.?asti|piemonte|piedmont/i, 'Piedmont', 'Italy'],
  [/amarone|valpolicella|ripasso|soave|bardolino|lugana|lessini|prosecco|valdobbiadene|conegliano|veneto/i, 'Veneto', 'Italy'],
  [/lipari|sicilia|sicily|etna|nero d.?avola|nerello|frappato|marsala|cerasuolo di vittoria|catarratto|grillo|insolia|carricante|malvasia delle lipari/i, 'Sicily', 'Italy'],
  [/sardegna|sardinia|cannonau|vermentino di sardegna|carignano del sulcis/i, 'Sardinia', 'Italy'],
  [/franciacorta|valtellina|sforzato|lombardia|lombardy|oltrepò pavese|garda/i, 'Lombardy', 'Italy'],
  [/friuli|collio|colli orientali|isonzo/i, 'Friuli', 'Italy'],
  [/trento|trentodoc|trentino|alto adige|südtirol|sudtirol/i, 'Trento', 'Italy'],
  [/lambrusco|sangiovese di romagna|romagna|emilia|colli piacentini|gutturnio|ortrugo/i, 'Emilia-Romagna', 'Italy'],
  [/verdicchio|castelli di jesi|matelica|conero|marche|le marche|marches/i, 'Marches', 'Italy'],
  [/abruzzo|cerasuolo d.?abruzzo|trebbiano d.?abruzzo|montepulciano d.?abruzzo|pecorino|cirelli/i, 'Abruzzo', 'Italy'],
  [/aglianico|taurasi|fiano|greco di tufo|falanghina|lacryma christi|campania|coda di volpe/i, 'Campania', 'Italy'],
  [/primitivo|salice salentino|negroamaro|fiano di puglia|locorotondo|puglia|apulia/i, 'Puglia', 'Italy'],
  [/cirò|gaglioppo|calabria|greco bianco/i, 'Calabria', 'Italy'],
  [/frascati|cesanese|lazio/i, 'Lazio', 'Italy'],
  [/sagrantino|montefalco|orvieto|umbria|grechetto|trebbiano spoletino/i, 'Umbria', 'Italy'],
  [/liguria|cinque terre|rossese|pigato|colli di luni/i, 'Liguria', 'Italy'],
  // France
  [/champagne|brut nature|extra brut|blanc de blancs|blanc de noirs|grande cuvée|cuvée tradition|brut millésimé|épernay/i, 'Champagne', 'France'],
  [/chablis|petit chablis/i, 'Chablis', 'France'],
  [/sancerre|pouilly[- ]?fumé|menetou-salon|touraine|vouvray|chinon|bourgueil|saumur|anjou|muscadet|montlouis|jasnières|coteaux du loir|loire/i, 'Loire Valley', 'France'],
  [/saint-julien|saint-émilion|saint-emilion|pomerol|lalande de pomerol|pauillac|margaux|saint-estèphe|haut-médoc|graves|sauternes|barsac|listrac|moulis|fronsac|côtes de bordeaux|cadillac|loupiac|entre-deux-mers|bordeaux/i, 'Bordeaux', 'France'],
  [/cahors/i, 'Cahors', 'France'],
  [/bandol/i, 'Provence', 'France'],
  [/tavel/i, 'Rhône', 'France'],
  [/côtes du rhône|cotes du rhone|côtes-du-rhône|cotes-du-rhone|cairanne|gigondas|vacqueyras|châteauneuf-du-pape|cornas|hermitage|crozes-hermitage|côte rotie|côte-rôtie|vinsobres|rasteau|lirac|ventoux|costières|saint-joseph|condrieu|rhône|rhone/i, 'Rhône', 'France'],
  [/beaujolais|brouilly|fleurie|morgon|moulin-à-vent|chenas|chiroubles|juliénas|régnié|saint-amour|côte de brouilly/i, 'Beaujolais', 'France'],
  [/burgundy|bourgogne|pommard|volnay|gevrey|nuits-saint-georges|chambertin|santenay|mercurey|givry|côte de nuits|côte de beaune|coteaux bourguignons|chassagne-montrachet|aloxe-corton|meursault|montrachet|pouilly-fuissé|mâcon|macon|saint-veran|st\.?-?véran|saint-bris|saint-aubin|aligoté|chablis/i, 'Burgundy', 'France'],
  [/picpoul|minervois|corbières|languedoc|faugères|faugeres|fitou|saint-chinian|pic saint-loup|côtes du roussillon|maury|banyuls|collioure/i, 'Languedoc', 'France'],
  [/alsace|gewürztraminer.*alsace|cremant d.?alsace/i, 'Alsace', 'France'],
  [/jura|côtes du jura|arbois|château-chalon/i, 'Jura', 'France'],
  [/savoie/i, 'Savoie', 'France'],
  [/corsica|patrimonio|ajaccio|figari|sartène/i, 'Corsica', 'France'],
  [/coteaux varois|côtes de provence|provence rosé|provence/i, 'Provence', 'France'],
  [/bergerac|monbazillac|pécharmant|côtes de bergerac/i, 'Bergerac', 'France'],
  [/gaillac/i, 'Gaillac', 'France'],
  // Spain
  [/rioja/i, 'Rioja', 'Spain'],
  [/ribera del duero/i, 'Ribera del Duero', 'Spain'],
  [/rías baixas|rias baixas|albariño|albarino/i, 'Rías Baixas', 'Spain'],
  [/bierzo|mencía|mencia/i, 'Bierzo', 'Spain'],
  [/penedès|penedes|cava/i, 'Penedès', 'Spain'],
  [/priorat|montsant/i, 'Penedès', 'Spain'],
  [/rueda|verdejo/i, 'Castile-La Mancha', 'Spain'],
  [/valdeorras|godello/i, 'Galicia', 'Spain'],
  [/ribeira sacra/i, 'Ribeira Sacra', 'Spain'],
  [/jumilla|monastrell/i, 'Valencia', 'Spain'],
  [/terra alta/i, 'Terra Alta', 'Spain'],
  [/castile-la mancha|castilla.la mancha/i, 'Castile-La Mancha', 'Spain'],
  // Portugal
  [/vinho verde|alvarinho|arca nova/i, 'Vinho Verde', 'Portugal'],
  [/douro|tawny port|ruby port|vintage port|lbv port|niepoort|quinta do crasto|quinta do noval/i, 'Douro', 'Portugal'],
  [/alentejo|coelheiros|herdade|mouchão|herdade do mouchão/i, 'Alentejo', 'Portugal'],
  [/dão|encruzado/i, 'Dão', 'Portugal'],
  [/lisboa|alenquer|palmela|setúbal|setubal|colares|casal da azenha|pegos claros/i, 'Lisboa', 'Portugal'],
  [/bairrada|baga/i, 'Lisboa', 'Portugal'],
  // Germany
  [/mosel|saar|ruwer|riesling kabinett|riesling spätlese|riesling auslese/i, 'Mosel', 'Germany'],
  [/rheingau|leitz|johannisberg|rüdesheim|spreitzer/i, 'Rheingau', 'Germany'],
  [/nahe/i, 'Nahe', 'Germany'],
  [/pfalz|messmer|spätburgunder/i, 'Pfalz', 'Germany'],
  [/rheinhessen/i, 'Rheinhessen', 'Germany'],
  [/baden|markgräflerland/i, 'Baden', 'Germany'],
  [/franken|silvaner/i, 'Pfalz', 'Germany'],
  // Austria
  [/wachau/i, 'Wachau', 'Austria'],
  [/kremstal/i, 'Kremstal', 'Austria'],
  [/carnuntum/i, 'Carnuntum', 'Austria'],
  [/niederösterreich|burgenland|kamptal|weinviertel|grüner veltliner|zweigelt|blaufränkisch|st\.? laurent|austria/i, 'Niederösterreich', 'Austria'],
  // Greece
  [/santorini|assyrtiko/i, 'Attica', 'Greece'],
  [/nemea|agiorgitiko/i, 'Attica', 'Greece'],
  [/naoussa|xinomavro/i, 'Amyndeon', 'Greece'],
  [/crete|moinoterra|moschato spinas|vidiano/i, 'Crete', 'Greece'],
  [/epirus|debina/i, 'Epirus', 'Greece'],
  [/attica|savatiano/i, 'Attica', 'Greece'],
  // Other Europe
  [/tokaj|furmint/i, 'Tokaj', 'Hungary'],
  [/kakheti|saperavi|rkatsiteli|georgia/i, 'Kakheti', 'Georgia'],
  [/dalmatia|plavac mali|croatia/i, 'Dalmatia', 'Croatia'],
  [/mostar|žilavka|zilavka|herzegovina/i, 'Mostar', 'Bosnia & Herzegovina'],
  [/cyprus|limassol|promara|xynisteri/i, 'Limassol, Cypru', 'Cypru'],
  [/vayots dzor|armenia|voskehat|areni/i, 'Vayots Dzor', 'Armenia'],
  [/beqaa|lebanon|massaya/i, 'Beqaa Valley', 'Lebanon'],
  // Americas
  [/mendoza|malbec|catalpa|finca sophenia|altosur|catena|finca dos carlos/i, 'Mendoza', 'Argentina'],
  [/uco valley|salta|cafayate|patagonia/i, 'Mendoza', 'Argentina'],
  [/canelones|tannat|uruguay/i, 'Canelones', 'Uruguay'],
  [/valle de guadalupe|mexico|baja/i, 'Valle de Guadalupe', 'Mexico'],
  // South Africa & Oceania
  [/stellenbosch|stellensbosch|swartland|paarl|elgin|hemel-en-aarde|robertson|cape coast/i, 'Western Cape', 'South Africa'],
  [/western cape|south africa/i, 'Western Cape', 'South Africa'],
  [/marlborough/i, 'Marlborough', 'New Zealand'],
  [/central otago|hawke.?s bay|martinborough/i, 'Marlborough', 'New Zealand'],
  [/victoria.*australia|yarra|mornington|heathcote|king valley/i, 'Victoria', 'Australia'],
  [/mclaren vale|barossa|clare valley|coonawarra|adelaide hills|eden valley/i, 'McLaren Vale', 'Australia'],
  [/kent|england|chapel down|gusbourne|nyetimber/i, 'Kent', 'England'],
  // USA — California (search before generic USA)
  [/napa|oakville|rutherford|st\.? helena|spring mountain|howell mountain|atlas peak|stags leap|yountville|coombsville/i, 'Napa Valley', 'California'],
  [/sonoma county|sonoma valley|alexander valley|knights valley|chalk hill|bennett valley|moon mountain/i, 'Sonoma County', 'California'],
  [/sonoma coast|fort ross-seaview|petaluma gap/i, 'Sonoma Coast', 'California'],
  [/russian river/i, 'Russian River Valley', 'California'],
  [/anderson valley/i, 'Anderson Valley', 'California'],
  [/mendocino/i, 'Mendocino County', 'California'],
  [/santa cruz mountain/i, 'Santa Cruz Mountains', 'California'],
  [/santa barbara|santa ynez|santa maria|sta\.? rita|happy canyon|los olivos|ballard canyon|ballard|santa rita hills/i, 'Santa Barbara County', 'California'],
  [/santa lucia highlands|salinas|monterey/i, 'Monterey County', 'California'],
  [/santa clara/i, 'Santa Clara Valley', 'California'],
  [/paso robles|adelaida|templeton|york mountain/i, 'Paso Robles', 'California'],
  [/edna valley|arroyo grande|san luis obispo/i, 'San Luis Obispo County', 'California'],
  [/lodi/i, 'Lodi', 'California'],
  [/contra costa|evangelho|oakley|antioch/i, 'Contra Costa County', 'California'],
  [/amador|shake ridge|fiddletown/i, 'Amador County', 'California'],
  [/el dorado/i, 'El Dorado', 'California'],
  [/carmel valley/i, 'Carmel Valley', 'California'],
  [/carneros/i, 'Carneros', 'California'],
  [/clarksburg/i, 'Clarksburg', 'California'],
  [/san benito|cienega valley/i, 'San Benito County', 'California'],
  [/north coast/i, 'North Coast', 'California'],
  [/california/i, 'California', 'California'],
  // USA — other
  [/willamette|eola-amity|chehalem|dundee|ribbon ridge|yamhill|mcminnville/i, 'Willamette Valley', 'Oregon'],
  [/columbia gorge|columbia valley.*oregon/i, 'Columbia Gorge', 'Oregon'],
  [/columbia valley/i, 'Columbia Valley', 'Washington'],
  [/yakima|red mountain|walla walla|horse heaven hills|rattlesnake hills/i, 'Yakima Valley', 'Washington'],
  [/finger lakes|seneca lake|cayuga lake/i, 'Finger Lakes', 'New York'],
  // Producer-based fallbacks for legacy/order-history wines
  [/annesanti/i, 'Umbria', 'Italy'],
  [/cardedu/i, 'Sardinia', 'Italy'],
  [/il folicello|folicello/i, 'Emilia-Romagna', 'Italy'],
  [/dominique piron|robert perroud/i, 'Beaujolais', 'France'],
  [/divai|herdade penedo gordo|coelheiros|herdade do mouchão/i, 'Alentejo', 'Portugal'],
  [/casal da azenha|pegos claros/i, 'Lisboa', 'Portugal'],
  [/arca nova|quinta da lixa|quinto da lixa|niepoort vinho verde/i, 'Vinho Verde', 'Portugal'],
  [/source \+ sink|union sacré|sans liege|crystallum/i, 'California', 'California'],
  [/château grand marchand|château de cugat|château haut[- ]mayne|château ducasse|château la fleur|château respide|château haut-monplaisir|château haut selve|château sainte-marie/i, 'Bordeaux', 'France'],
  [/leitz|spreitzer|von winning|johanneshof|burg ravensburg|messmer|ziereisen|loimer/i, 'Rheingau', 'Germany'],
  [/moinoterra|mylonas|paterianakis|alexakis|tsiakkas|glinavos/i, 'Crete', 'Greece'],
  [/fattoria dianella|sasso di luna|ferretti roberto|tolaini|terenzuola|fibbiano|tenuta valgiano|villa papiano|emidio pepe|de fermo|terraviva|abbondanza|lunaria/i, 'Tuscany', 'Italy'],
  [/poggio della dogana|tre monti|cantine bonelli|emilio lambrusco|medici ermete|cleto chiarli/i, 'Emilia-Romagna', 'Italy'],
  [/conti zecca|gianfranco fino|rivera bombino|lucchetti/i, 'Puglia', 'Italy'],
  [/cantina del taburno|mastroberardino|benito ferrara|vadiaperta|fonzone|cantina morone|agnanum|de falco|tenuta bellafonte|tenuta bellefonte/i, 'Campania', 'Italy'],
  [/bodegas tierra agrícola|bodegas federico|alegre valgañón|ondarre|mariano j\.? lacort|teófilo reyes|rubiejo|bodegas albamar|carballal|lagar da condesa|xavier clua|raventós i blanc|sumarrocca|joan colet|nivarius|bodegas estefania|clos d.?audhuy|castro candaz|brincadeiro|rafael cambra|bodegas venta la vega|bodegas atamisque|bodega pablo fallabrino/i, 'Rioja', 'Spain'],
];

function inferRegionAndCountry(name) {
  for (const [re, region, country] of REGION_FROM_NAME) {
    if (re.test(name)) return { region, country };
  }
  return null;
}

// Tokens that signal "the producer name has ended" — the wine name proper starts here.
const PRODUCER_STOP_RE = new RegExp([
  // grapes & varietal references
  'pinot', 'cabernet', 'chardonnay', 'sauvignon', 'merlot', 'syrah', 'shiraz',
  'zinfandel', 'nebbiolo', 'sangiovese', 'barbera', 'dolcetto', 'aglianico',
  'primitivo', 'montepulciano', 'verdicchio', 'vermentino', 'friulano',
  'riesling', 'gewürztraminer', 'gewurztraminer', 'gruner', 'grüner',
  'tempranillo', 'mencía', 'mencia', 'albariño', 'albarino', 'godello',
  'malbec', 'gamay', 'corvina', 'falanghina', 'fiano', 'greco', 'garganega',
  'chenin', 'viognier', 'roussanne', 'marsanne', 'glera', 'furmint',
  'assyrtiko', 'xinomavro', 'savatiano', 'vidiano', 'verdejo', 'macabeo',
  'trebbiano', 'pecorino', 'cortese', 'grechetto', 'ortrugo', 'frappato',
  'nero', 'nerello', 'lambrusco', 'refosco', 'lagrein', 'schioppettino',
  'mourvèdre', 'mourvedre', 'monastrell', 'carignan', 'cinsault', 'grenache',
  'garnacha', 'blaufränkisch', 'blaufrankisch', 'zweigelt', 'spätburgunder',
  'spatburgunder', 'verdelho', 'criolla', 'rossese', 'braucol', 'zilavka',
  'voskehat', 'tannat', 'carménère', 'carmenere', 'mataro', 'meunier',
  'centesimino', 'carricante', 'inzolia', 'grillo',
  // styles / types
  'rosso', 'rossa', 'bianco', 'bianca', 'blanco', 'blanca', 'branco',
  'blanc', 'white', 'rouge', 'red', 'rosé', 'rose', 'rosato', 'rosado',
  'tinto', 'tinta', 'brut', 'extra', 'sec', 'doux', 'demi', 'frizzante',
  'spumante', 'champagne', 'prosecco', 'cava', 'sekt', 'crémant', 'cremant',
  'orange', 'amber', 'pet', 'pét', 'pétillant', 'metodo', 'méthode',
  'methode', 'classico', 'reserva', 'reserve', 'riserva', 'crianza',
  'gran', 'superiore', 'kabinett', 'spätlese', 'spatlese', 'auslese',
  'trockenbeerenauslese', 'grosses', 'erste', 'lage', 'lagen', 'troken',
  'sweet', 'dessert', 'port', 'sauternes', 'amarone', 'ripasso', 'vendange',
  'tardive', 'colheita', 'tawny', 'ruby', 'vintage', 'late', 'harvest',
  'sparkling', 'fortified', 'vermouth', 'pet-nat', 'pétnat', 'petnat',
  // appellations / regions (small set — the bigger ones)
  'barolo', 'barbaresco', 'chianti', 'brunello', 'soave', 'valpolicella',
  'chablis', 'bordeaux', 'burgundy', 'beaujolais', 'champagne', 'sancerre',
  'vouvray', 'rioja', 'ribera', 'priorat', 'toro', 'douro', 'porto',
  'tokaji', 'mosel', 'rheingau', 'côte', 'cote', 'côtes', 'cotes',
  'menetou', 'pouilly', 'mâcon', 'macon', 'cairanne', 'gigondas',
  'cornas', 'hermitage', 'gevrey', 'meursault', 'pommard', 'volnay',
  'rhône', 'rhone', 'alsace', 'jura', 'savoie', 'corsica', 'provence',
  'minervois', 'languedoc', 'cahors', 'bandol', 'tavel', 'pomerol',
  'saint-julien', 'pauillac', 'margaux', 'graves', 'sauternes', 'barsac',
  'rías', 'rias', 'baixas', 'valdeorras', 'somontano', 'bierzo',
  'penedès', 'penedes', 'menorca', 'mallorca', 'marlborough', 'mendoza',
  'napa', 'sonoma', 'mendocino', 'monterey', 'paso', 'lodi', 'edna',
  'willamette', 'columbia', 'yakima', 'finger', 'rheinhessen', 'pfalz',
  'wachau', 'kremstal', 'carnuntum', 'kakheti', 'beqaa',
  'vinho', 'verde', 'langhe', 'roero', 'gattinara', 'gavi', 'asti',
  'orcia', 'maremma', 'bolgheri', 'morellino', 'frascati', 'taurasi',
  'campania', 'sicilia', 'sicily', 'puglia', 'umbria', 'tuscany',
  'piemonte', 'piedmont', 'veneto', 'friuli', 'liguria', 'lombardy',
  'romagna', 'abruzzo', 'lazio', 'calabria', 'sardegna', 'sardinia',
  'trentino', 'alto', 'adige', 'marche', 'marches',
  // pure numbers (375mL, 1.5L)
  '375ml', '500ml', '750ml', '1-liter', '1.5l', 'magnum', 'jeroboam',
  // single-quoted nicknames start with quote characters (handled separately)
  // Common modifiers
  'estate', 'old', 'vine', 'vines',
].map(w => `\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`).join('|'), 'i');

const QUOTE_RE = /[‘'’"„«]/;

function extractProducer(name) {
  // Strip trailing parentheticals / size annotations from the working copy
  const tokens = name.split(/(\s+)/); // keep whitespace
  let words = [];
  let textSoFar = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const stripped = tok.trim();
    if (!stripped) { words.push(tok); textSoFar += tok; continue; }
    // Quoted nickname → stop before it
    if (QUOTE_RE.test(stripped[0])) break;
    // Wine-descriptor token → stop
    if (PRODUCER_STOP_RE.test(stripped) && words.length > 0) break;
    words.push(tok);
    textSoFar += tok;
    // Cap at 5 words to avoid runaway
    if (words.filter(w => w.trim()).length >= 5) break;
  }
  let producer = words.join('').trim();
  // Trim trailing punctuation
  producer = producer.replace(/[,;:.\-–—]+$/, '').trim();
  // Trim trailing connectives (of, di, da, de, des, du, dei, del, della, delle, e)
  producer = producer.replace(/\s+(of|di|da|de|des|du|dei|del|della|delle|e|y|&|and)$/i, '').trim();
  if (!producer) producer = name.split(' ').slice(0, 2).join(' ');
  return producer;
}

function parsePrice(str) {
  const m = /\$([\d.,]+)/.exec(str);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
}

function inferType(name) {
  for (const rule of TYPE_RULES) {
    if (rule.tests.some(re => re.test(name))) return rule.type;
  }
  return 'Red'; // default fallback (catalog is ~45% red)
}

function inferGrapes(name, region, country) {
  const hits = [];
  for (const [grape, re] of GRAPE_PATTERNS) {
    if (re.test(name) && !hits.includes(grape)) hits.push(grape);
  }
  if (hits.length) return hits;
  // Fallback: match name/region against appellation map
  const haystack = `${name} ${region} ${country}`;
  for (const [re, grapes] of APPELLATION_GRAPES) {
    if (re.test(haystack)) return [...grapes];
  }
  return [];
}

function inferBody(type, name) {
  if (type === 'Sparkling' || type === 'Rosé') return 'Light';
  if (type === 'White') {
    if (/chardonnay|viognier|roussanne|marsanne/i.test(name)) return 'Medium';
    return 'Light';
  }
  if (type === 'Sweet') return 'Full';
  if (type === 'Orange') return 'Medium';
  // Red
  if (/nebbiolo|barolo|barbaresco|amarone|brunello|cabernet|syrah|shiraz|aglianico|primitivo|zinfandel|petite sirah|tannat|mourvèdre|monastrell|sagrantino|bordeaux/i.test(name)) return 'Full';
  if (/pinot noir|gamay|beaujolais|frappato|cinsault|grignolino|trousseau|schiava/i.test(name)) return 'Light';
  return 'Medium';
}

function parseEntry(entry) {
  // Filter out non-wine rows
  if (entry.length < 2) return null;
  const lines = [...entry];
  let status = null;
  if (lines[0] && STATUS_LINES.has(lines[0])) {
    status = lines.shift();
  }
  // Drop "was $X Save Y%" line — keep the final $ as effective price
  const filtered = lines.filter(l => !/^was \$/i.test(l));

  if (filtered.length < 2) return null;

  // last line is price
  const priceStr = filtered[filtered.length - 1];
  const price = parsePrice(priceStr);
  if (price == null) return null;

  // First line is name (may include vintage prefix); region is line before price
  const nameRaw = filtered[0];
  const regionRaw = filtered.length >= 3 ? filtered[filtered.length - 2] : null;

  // Skip non-product rows
  if (!regionRaw || regionRaw === nameRaw || !regionRaw.includes(',')) return null;
  if (/gift card|extravaganza|tasting|event/i.test(nameRaw)) return null;

  // Vintage: 4-digit year prefix or "NV"
  let vintage = null;
  let producerAndName = nameRaw;
  const vm = /^(\d{4})\s+(.+)$/.exec(nameRaw);
  const nvm = /^(NV)\s+(.+)$/i.exec(nameRaw);
  if (vm) { vintage = parseInt(vm[1], 10); producerAndName = vm[2]; }
  else if (nvm) { vintage = 'NV'; producerAndName = nvm[2]; }

  // Region + country
  const parts = regionRaw.split(',').map(s => s.trim());
  const country = parts[parts.length - 1];
  const region = parts.slice(0, -1).join(', ');

  // Lat/lng — try exact key first, then with simple country normalization
  let coords = GEO[regionRaw];
  if (!coords && regionRaw === 'Limassol, Cypru') coords = GEO['Limassol, Cypru'];
  if (!coords) {
    // try region only as fallback
    for (const k of Object.keys(GEO)) {
      if (k.startsWith(region + ',')) { coords = GEO[k]; break; }
    }
  }
  if (!coords) coords = [null, null];

  const type = inferType(producerAndName);
  const grapes = inferGrapes(producerAndName, region, country);
  const body = inferBody(type, producerAndName);

  const producer = extractProducer(producerAndName);

  return {
    name: producerAndName,
    producer,
    vintage,
    region,
    country,
    lat: coords[0],
    lng: coords[1],
    type,
    body,
    grapes,
    priceUSD: price,
    status,
  };
}

const wines = [];
const skipped = [];
const missingGeo = new Set();

for (const entry of raw) {
  const parsed = parseEntry(entry);
  if (!parsed) { skipped.push(entry); continue; }
  if (parsed.lat == null) missingGeo.add(`${parsed.region}, ${parsed.country}`);
  wines.push(parsed);
}

// Add a search URL for each wine — ancoravino.wine search page accepts a keyword query.
function buildSearchUrl(name) {
  // Strip quotes and vintage punctuation, encode for URL
  const cleaned = name.replace(/[‘’'"„«»“”]/g, '').replace(/\s+/g, ' ').trim();
  return 'https://ancoravino.wine/products/search?keyword=' + encodeURIComponent(cleaned);
}
wines.forEach(w => { w.shopUrl = buildSearchUrl((w.vintage ? w.vintage + ' ' : '') + w.name); });

fs.writeFileSync(path.join(__dirname, 'wines.json'), JSON.stringify(wines, null, 2));
fs.writeFileSync(
  path.join(__dirname, 'wines.data.js'),
  'window.WINES = ' + JSON.stringify(wines) + ';\n'
);

// ---- Jessica's order history ----
// Each ordered item is parsed through the same pipeline so it has lat/lng/type/grape.
const ordersPath = path.join(__dirname, 'jessica-orders.json');
if (fs.existsSync(ordersPath)) {
  const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
  // Index catalog by normalized name for matching
  const norm = s => s.toLowerCase().replace(/[‘’'"„«»“”]/g, '').replace(/\s+/g, ' ').trim();
  const catalog = new Map();
  for (const w of wines) {
    catalog.set(norm((w.vintage ? w.vintage + ' ' : '') + w.name), w);
  }

  const memberWines = [];
  const seen = new Set();
  let matchedCount = 0, unmatchedCount = 0;

  for (const order of orders) {
    for (const item of order.items) {
      if (!item.name) continue;
      const key = norm(item.name);
      if (seen.has(key)) continue;
      seen.add(key);
      const match = catalog.get(key);
      if (match) {
        memberWines.push({ ...match, orderedQty: item.qty, orderedDate: order.date });
        matchedCount++;
      } else {
        // Fallback: infer region from the wine name, then parse as if scraped
        const inferred = inferRegionAndCountry(item.name);
        const regionLine = inferred
          ? `${inferred.region}, ${inferred.country}`
          : 'Unknown, Unknown';
        const fake = parseEntry([item.name, regionLine, '$' + item.price]);
        if (fake) {
          fake.shopUrl = buildSearchUrl(item.name);
          fake.orderedQty = item.qty;
          fake.orderedDate = order.date;
          fake.fromOrderOnly = true;
          memberWines.push(fake);
        }
        unmatchedCount++;
      }
    }
  }
  console.log(`\nJessica: ${memberWines.length} unique wines (${matchedCount} matched catalog, ${unmatchedCount} legacy/sold-out).`);
  fs.writeFileSync(path.join(__dirname, 'jessica.data.js'),
    'window.JESSICA_WINES = ' + JSON.stringify(memberWines) + ';\n');
}

console.log(`Parsed ${wines.length} wines.`);
console.log(`Skipped ${skipped.length} rows (non-products).`);
if (missingGeo.size) {
  console.log(`\nRegions without coordinates (${missingGeo.size}):`);
  for (const r of missingGeo) console.log(`  - ${r}`);
}
const typeCounts = {};
for (const w of wines) typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
console.log('\nBy type:', typeCounts);
const noGrape = wines.filter(w => w.grapes.length === 0).length;
console.log(`No grape inferred: ${noGrape}`);
