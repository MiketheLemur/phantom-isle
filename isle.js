/* Phantom Isle — generation engine. DOM-free: runs in the browser and under node.
 * Seeded: the same seed always surveys the same island. */
(function (global) {
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function smooth(t) { t = Math.min(Math.max(t, 0), 1); return t * t * (3 - 2 * t); }
function smoothstep(a, b, x) { return smooth((x - a) / (b - a)); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---- value noise + fbm ---- */
function makeNoise(rng, size) {
  var grid = [], y, x;
  for (y = 0; y <= size; y++) { grid[y] = []; for (x = 0; x <= size; x++) grid[y][x] = rng(); }
  return function (x, y) {
    var gx = x * size, gy = y * size;
    var x0 = Math.floor(gx), y0 = Math.floor(gy);
    var x1 = Math.min(x0 + 1, size), y1 = Math.min(y0 + 1, size);
    var fx = smooth(gx - x0), fy = smooth(gy - y0);
    var a = grid[y0][x0], b = grid[y0][x1], c = grid[y1][x0], d = grid[y1][x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function makeFbm(rng, octaves, size) {
  var layers = [], i, total = 0, amp = 1;
  for (i = 0; i < octaves; i++) { layers.push(makeNoise(rng, size * Math.pow(2, i))); total += amp; amp *= 0.5; }
  return function (x, y) {
    var s = 0, a = 1, i;
    for (i = 0; i < layers.length; i++) { s += layers[i](x, y) * a; a *= 0.5; }
    return s / total;
  };
}

/* ---- naming ---- */
var NAME_A = ["Vel","Bran","Ant","Fris","Thul","Mor","Sel","Cal","Dun","Mal","Sor","Tir","Aval","Lem","Maur","Corv","Bel","Roc","Iber","Ost","Ves","Gal","Azor","Mer","Sol"];
var NAME_B = ["ad","ar","on","il","er","an","os","ul","eth","in","or","el","av","ur"];
var NAME_C = ["ia","dor","ara","andia","ey","onne","ica","elle","une","osa","eria"];

function islandName(rng) {
  var r = rng(), core;
  if (r < 0.45) core = pick(rng, NAME_A) + pick(rng, NAME_C);
  else if (r < 0.75) core = pick(rng, NAME_A) + pick(rng, NAME_B) + pick(rng, NAME_C);
  else core = pick(rng, NAME_A) + pick(rng, NAME_B) + "ia";
  core = cap(core.toLowerCase().replace(/aa+/g, "a"));
  if (rng() < 0.18) return "Isle of " + core;
  if (rng() < 0.12) return "St. " + cap(pick(rng, NAME_A).toLowerCase()) + "'s Isle";
  return core;
}

var REGIONS = [
  { name: "the Mozambique Channel", lat: [-22, -12], lon: [38, 46] },
  { name: "west of the Azores", lat: [36, 42], lon: [-38, -30] },
  { name: "the Mascarene basin", lat: [-22, -14], lon: [52, 60] },
  { name: "the South Atlantic gyre", lat: [-38, -28], lon: [-18, -8] },
  { name: "east of the Comoros", lat: [-14, -8], lon: [46, 54] },
  { name: "the Agulhas bank", lat: [-40, -32], lon: [16, 26] }
];

function fmtLat(lat) {
  var d = Math.floor(Math.abs(lat)), m = Math.floor((Math.abs(lat) - d) * 60);
  return d + "\u00B0" + m + "\u2032" + (lat < 0 ? "S" : "N");
}
function fmtLon(lon) {
  var d = Math.floor(Math.abs(lon)), m = Math.floor((Math.abs(lon) - d) * 60);
  return d + "\u00B0" + m + "\u2032" + (lon < 0 ? "W" : "E");
}

/* ---- island generation ---- */
var N = 110; // heightfield resolution

function generateIsland(seed) {
  var rng = mulberry32(seed >>> 0);
  var atoll = rng() < 0.18;
  var r0 = atoll ? 0.32 + rng() * 0.07 : 0.24 + rng() * 0.13;
  var cx = 0.5 + (rng() - 0.5) * 0.08, cy = 0.5 + (rng() - 0.5) * 0.08;
  var harm = [];
  for (var i = 0; i < 3; i++) harm.push({ k: randInt(rng, 2, 5), a: 0.04 + rng() * 0.09, p: rng() * Math.PI * 2 });

  var relief = makeFbm(rng, 3, 7);
  var moist = makeFbm(rng, 3, 7);
  var reefN = makeNoise(rng, 9);

  var region = pick(rng, REGIONS);
  var lat = region.lat[0] + rng() * (region.lat[1] - region.lat[0]);
  var lon = region.lon[0] + rng() * (region.lon[1] - region.lon[0]);
  var widthKm = Math.round(6 + rng() * 90);
  var name = islandName(rng);

  var cells = [], landCells = [], maxH = 0, maxCell = null;
  var y, x;
  for (y = 0; y < N; y++) {
    cells[y] = [];
    for (x = 0; x < N; x++) {
      var nx = x / (N - 1), ny = y / (N - 1);
      var dx = nx - cx, dy = ny - cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx);
      var rmod = 1, j;
      for (j = 0; j < harm.length; j++) rmod += harm[j].a * Math.cos(harm[j].k * ang + harm[j].p);

      var landness, base;
      if (atoll) {
        landness = 1 - smoothstep(0, 0.085, Math.abs(d - r0 * rmod));
        if (d > r0 * 1.3) landness = 0;
        base = 0.34 + 0.62 * relief(nx, ny);
      } else {
        landness = 1 - smoothstep(r0 * rmod * 0.60, r0 * rmod * 1.22, d);
        base = 0.26 + 1.02 * relief(nx, ny);
      }
      var h = landness * base;
      var m = moist(nx, ny);
      var reef = reefN(nx, ny);
      var land = h > 0.5;
      var biome = null, hh = 0;
      if (land) {
        hh = (h - 0.5) / 0.5;
        if (hh > 0.74) biome = "peak";
        else if (m > 0.62 && hh > 0.34) biome = "cloudforest";
        else if (hh > 0.34) biome = "highland";
        else if (hh < 0.10 && m > 0.55) biome = "mangrove";
        else if (m < 0.36) biome = "thicket";
        else if (hh < 0.18) biome = "littoral";
        else biome = "forest";
      }
      cells[y][x] = { h: h, m: m, reef: reef, land: land, biome: biome, hh: hh, d: d };
      if (land) {
        landCells.push({ x: x, y: y, h: h });
        if (h > maxH) { maxH = h; maxCell = { x: x, y: y }; }
      }
    }
  }

  var landFrac = landCells.length / (N * N);
  var areaKm2 = Math.max(1, Math.round(landFrac * widthKm * widthKm * 2.4));
  var elevM = landCells.length ? Math.round(((maxH - 0.5) / 0.5) * 900) : 0;

  /* rivers: walk downhill from the summit. Atolls get none — a ring of sand
     has no watershed, which is why nobody stays. */
  var rivers = [];
  function downhill(px, py) {
    var path = [{ x: px, y: py }], seen = {}, guard = 0, climb = 0;
    while (guard++ < 900) {
      seen[px + "," + py] = true;
      if (!cells[py][px].land) break;
      var best = null, bh = cells[py][px].h, dx, dy;
      for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var qx = px + dx, qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= N || qy >= N) continue;
        if (seen[qx + "," + qy]) continue;
        if (best === null || cells[qy][qx].h < bh) { bh = cells[qy][qx].h; best = { x: qx, y: qy }; }
      }
      if (best === null) break;
      if (bh >= cells[py][px].h && ++climb > 40) break; // shallow pits: spill over, but not forever
      px = best.x; py = best.y; path.push({ x: px, y: py });
    }
    return path.length > 4 ? path : null;
  }
  function mouthType(path) {
    var e = path[path.length - 1];
    return cells[e.y][e.x].land ? "lake" : "sea";
  }
  if (!atoll && maxCell) {
    var r1 = downhill(maxCell.x, maxCell.y);
    if (r1) rivers.push({ path: r1, mouth: mouthType(r1) });
    if (landCells.length > 40 && rng() < 0.8) {
      var c2 = pick(rng, landCells.filter(function (c) { return c.h > 0.62; }));
      if (c2) { var r2 = downhill(c2.x, c2.y); if (r2) rivers.push({ path: r2, mouth: mouthType(r2) }); }
    }
  }

  var lastCharted = randInt(rng, 1820, 1962);
  var status = pick(rng, ["Charted", "Charted", "Doubtful", "VD (existence doubtful)", "Expunged " + randInt(rng, 1830, 1910)]);

  return {
    seed: seed >>> 0, name: name, atoll: atoll,
    region: region.name, lat: lat, lon: lon,
    latStr: fmtLat(lat), lonStr: fmtLon(lon),
    widthKm: widthKm, areaKm2: areaKm2, elevM: elevM,
    lastCharted: lastCharted, status: status,
    cells: cells, landCells: landCells, rivers: rivers, maxCell: maxCell
  };
}

/* ---- fauna ---- */
var FAUNA_KINDS = [
  { kind: "giant lemur", sci: "Megaladapis", note: "Nocturnal. Moves through the canopy in troops of {n}. The {feat} is exaggerated past anything on the mainland — insular gigantism with no predators left to argue with." },
  { kind: "dwarf lemur", sci: "Cheirogaleus", note: "Fattens its tail for the dry season and sleeps through it. Trapped once in {yr} by {who}; the trap was empty by morning and the bait was gone." },
  { kind: "tenrec", sci: "Echinops", note: "A hedgehog that is not a hedgehog. Forages the leaf litter at dusk, quills first. Its {feat} suggests a lineage the mainland lost." },
  { kind: "chameleon", sci: "Brookesia", note: "Leaf-litter small, the size of a thumbnail. Changes color with a slowness that suggests it is thinking about it. {n} recorded, all within ten paces of each other." },
  { kind: "leaf-tailed gecko", sci: "Uroplatus", note: "Indistinguishable from bark until it blinks. The survey party walked past the type specimen three times. The type specimen watched." },
  { kind: "tomato frog", sci: "Dyscophus", note: "Breeds in the crater pools after rain. Bright enough to be a warning, common enough not to be. Calls like a squeezed hinge." },
  { kind: "tortoise", sci: "Astrochelys", note: "Radiated shell, unhurried gait. One individual was marked in {yr} and re-found in {yr2} eleven meters away, facing the other direction." },
  { kind: "ibis", sci: "Lophotibis", note: "Crested, ground-feeding, loud at dawn. Nests in the {feat}. The flock is the island's alarm system and it has never once been wrong." },
  { kind: "coua", sci: "Coua", note: "A cuckoo that forgot to be a parasite. Runs the branches like a squirrel. Its call is the first sound of the morning and the last sound anyone can identify." },
  { kind: "fossa", sci: "Cryptoprocta", note: "The only predator. Padded feet, cat-eyes, climbs like smoke. Lemur bones in the latrine sites are the island's entire fossil record." },
  { kind: "elephant bird", sci: "Aepyornis", note: "Extinct. Subfossil only — a femur, three eggshell fragments, and a footprint in volcanic ash that no one has explained to anyone's satisfaction." },
  { kind: "flying fox", sci: "Pteropus", note: "Roosts in the thousands in the littoral forest. At dusk the colony leaves in a river that takes twenty minutes to pass. The guano is the island's economy." }
];
var EPITHETS = ["umbrae","sylvicola","phantasmae","insularis","obscura","velata","maris","nebulosa","crepusculi","tacita","remotissima","vanescens"];
var FEATS = ["third eyelid","crest","tail tuft","vocal sac","dewclaw","brow ridge","ear fringe","throat fan"];
var STATUSES = ["Presumed extant","Last specimen {yr}","Known from {n} {spec}","Described from a footprint","Status: doubtful","Extinct (subfossil only)"];

function generateFauna(seed, island) {
  var rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  var count = randInt(rng, 3, 7);
  var kinds = FAUNA_KINDS.slice();
  for (var i = kinds.length - 1; i > 0; i--) { var k = Math.floor(rng() * (i + 1)); var t = kinds[i]; kinds[i] = kinds[k]; kinds[k] = t; }
  var out = [], usedEpithets = {};
  for (i = 0; i < count; i++) {
    var kd = kinds[i];
    var epithet = pick(rng, EPITHETS);
    while (usedEpithets[epithet]) epithet = pick(rng, EPITHETS);
    usedEpithets[epithet] = true;
    var yr = randInt(rng, 1830, 1955), yr2 = yr + randInt(rng, 3, 40);
    var note = kd.note
      .replace("{n}", randInt(rng, 2, 14))
      .replace("{yr}", yr).replace("{yr2}", yr2)
      .replace("{who}", pick(rng, ["a missionary", "a naval surgeon", "a copra trader", "a lighthouse keeper", "a museum collector"]))
      .replace("{feat}", pick(rng, FEATS));
    var st = pick(rng, STATUSES)
      .replace("{yr}", randInt(rng, 1850, 1930))
      .replace("{n}", randInt(rng, 1, 4))
      .replace("{spec}", pick(rng, ["feathers", "teeth", "a single egg", "footprints", "a skull"]));
    var spot = null;
    if (island.landCells.length) {
      var c = pick(rng, island.landCells);
      spot = { x: c.x, y: c.y };
    }
    out.push({ common: kd.kind, sci: kd.sci + " " + epithet, note: note, status: st, spot: spot });
  }
  return out;
}

/* ---- expedition history ---- */
var VESSELS = ["a Portuguese caravel","a Dutch fluyt","a French corvette","a British survey brig","a whaler out of Nantucket","a Jesuit mission barque","a mail steamer","a Royal Navy sloop","a Norwegian bark"];
var WEATHERS = ["a flat calm","driving rain","a gale out of the southeast","unseasonable heat","fog that would not lift","a dead calm at noon"];
var OUTCOMES = [
  "No landing attempted; the lookout swore it was there at dawn.",
  "A landing party found fresh water and {f} tracks. By the time they rowed back, the island was gone.",
  "Ran aground on a reef marked on no chart. Floated free at high water, rudder intact, nerves not.",
  "Found a cairn of stones and a rusted {obj}. No other sign of man.",
  "The captain declined to land. The men were uneasy and would not say why.",
  "Surveyed for three days. The coastline would not hold still.",
  "Took on water and {f} eggs. The chart position was marked 'doubtful' on the return.",
  "Sighted breakers where the chart showed open sea. Hove to until morning; nothing there.",
  "A boat crew spent the night ashore and returned silent. All requested transfer within the month."
];
var OBJECTS = ["sextant","cutlass","ship's bell","anchor chain","brass compass","lantern"];

function generateHistory(seed, island, fauna) {
  var rng = mulberry32((seed ^ 0x51ab3c2d) >>> 0);
  var count = randInt(rng, 3, 6);
  var first = randInt(rng, 1287, 1490);
  var years = [first], i;
  for (i = 1; i < count; i++) years.push(years[i - 1] + randInt(rng, 28, 190));
  var f0 = fauna.length ? fauna[0].common : "lemur";
  var out = [];
  for (i = 0; i < count; i++) {
    var oc = pick(rng, OUTCOMES)
      .replace("{f}", f0)
      .replace("{obj}", pick(rng, OBJECTS));
    out.push({
      year: years[i],
      text: years[i] + ": " + cap(pick(rng, VESSELS)) + " logs '" + island.name + "' at " + island.latStr + ", " + island.lonStr + ", in " + pick(rng, WEATHERS) + ". " + oc
    });
  }
  return out;
}

/* ---- field notes ---- */
var NOTE_FRAG = [
  "Wind from the east all day. The surf on the windward reef never stops, even in a calm.",
  "Heard, not seen: something large moving through the {b} after dark.",
  "The compass misbehaves within a mile of the north point. Recorded and not explained.",
  "Water: two springs, one brackish. The good one is marked by {f} droppings.",
  "Counted {n} {f} at the salt pan. They watched us longer than we watched them.",
  "Flora unremarkable except for one tree with bark like hammered copper. Took a cutting; it died at sea.",
  "The tide here runs an hour ahead of the tables. Adjusted the chronometer twice.",
  "Found {f} sign on the summit ridge. Altitude {e} m. Nothing should live up here.",
  "Rain at 1500, hard. The rivers rose a meter in an hour and fell by dusk.",
  "Dreamed of the island before seeing it. Noting this only because the second mate dreamed it too."
];

function generateNotes(seed, island, fauna) {
  var rng = mulberry32((seed ^ 0x77aa11cc) >>> 0);
  var count = randInt(rng, 3, 5);
  var out = [];
  var yr = randInt(rng, 1840, 1950);
  for (var i = 0; i < count; i++) {
    yr += randInt(rng, 1, 9);
    var f0 = fauna.length ? pick(rng, fauna).common : "lemur";
    var b0 = pick(rng, ["littoral forest", "spiny thicket", "cloud forest", "mangrove fringe", "highland scrub"]);
    var text = pick(rng, NOTE_FRAG)
      .replace("{f}", f0).replace("{b}", b0)
      .replace("{n}", randInt(rng, 3, 40))
      .replace("{e}", Math.max(50, island.elevM - randInt(rng, 0, 120)));
    var day = randInt(rng, 1, 28), mon = pick(rng, ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]);
    out.push({ date: day + " " + mon + " " + yr, text: text });
  }
  return out;
}

function survey(seed) {
  var island = generateIsland(seed);
  var fauna = generateFauna(seed, island);
  var history = generateHistory(seed, island, fauna);
  var notes = generateNotes(seed, island, fauna);
  return { island: island, fauna: fauna, history: history, notes: notes };
}

var api = {
  survey: survey, generateIsland: generateIsland, generateFauna: generateFauna,
  generateHistory: generateHistory, generateNotes: generateNotes, mulberry32: mulberry32, GRID: N
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
else global.PhantomIsle = api;

})(typeof self !== "undefined" ? self : this);
