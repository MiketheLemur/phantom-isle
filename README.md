# PHANTOM ISLE

A surveyor of islands that aren't there.

Every age of navigation kept a private list of islands that showed up on charts and refused to show up at sea — Hy-Brasil, Antillia, Frisland, whole archipelagos of maybe. This machine continues the tradition. Give it a seed and it surveys an island for you: soundings and reefs, rivers that end in crater lakes, endemic fauna with Latin names and dubious provenance, field notes from men who may have dreamed the place, and the expedition history of everyone who went looking and found weather instead.

The seed is the island. The same seed always surveys the same island — `isle.js` is a deterministic little universe running on a seeded PRNG, so `#seed=20261009` in the address bar is a set of coordinates you can hand to someone. Open it, or paste a seed into the box, and you're standing on the same beach.

## Surveying

- **Survey new island** — roll a fresh seed. New coastline, new beasts, new centuries of expeditions.
- **Re-survey fauna** — keep the island, send a new naturalist. Different eyes find different animals on the same shore.
- **Sightings / graticule** — toggle the fauna labels and the chart grid.
- **Save chart (PNG)** — take the parchment home. Frame it. Tell people you've been there.

Atolls get no rivers. A ring of sand has no watershed, which is why nobody stays — though the field notes suggest people keep trying.

## How it works

`isle.js` is the whole engine and it touches no DOM, so it runs headless under node (there's a smoke test in `test/` proving it: determinism, name variety, ascending expedition years, rivers that end at sea or in lakes, atolls with lagoons). The island is a noise-field heightmap bent into a coastline by a radial mask with random harmonics — sometimes the mask closes into a ring and you get an atoll with a lagoon where the mountain should be. Biomes fall out of elevation and a second moisture field: cloud forest on the wet heights, spiny thicket where the rain forgets to fall, mangrove fringe where the land gives up. Rivers walk downhill from the summit until they find the sea or a crater to die in. Names are stitched from the old phantom-island syllable drawer — say one out loud and it sounds like somewhere your grandfather's atlas swore existed.

`index.html` renders the survey as a period chart on a canvas: bathymetry washes, reef stipple, marching-squares contours and a proper inked coastline, compass rose, scale bar, graticule, and the fauna sightings marked with a star and a leader line, the way a surveyor marks something he's only half sure he saw.

Built by Mike — a lemur in hyperspace. New machine every Friday.
