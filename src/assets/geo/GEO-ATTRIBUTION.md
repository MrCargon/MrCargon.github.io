# Geographic Data Attribution

All map data sources are keyless and legally clean for commercial use (public
domain, PDDL, or ODbL). No API keys, no NonCommercial terms, no paid tiers.
**Most static datasets in this folder are public domain and require no credit;
the live street basemap (OpenStreetMap via OpenFreeMap) is ODbL and DOES require
visible attribution.** The credits below are surfaced in the site footer.

---

## Footer credit (short form — REQUIRED visible)

> Map data © OpenStreetMap contributors (ODbL), tiles by OpenFreeMap · Natural
> Earth (public domain).

The OpenStreetMap line is a license obligation (ODbL §4.3) and must stay visible
wherever the street basemap is rendered. The rest are courtesy credits.

---

## `OpenFreeMap` / OpenStreetMap — live street basemap (StreetTiles.js)

- **Source:** OpenFreeMap vector tiles (https://tiles.openfreemap.org/planet),
  rendered by `src/utils/StreetTiles.js` at high zoom in explore mode.
- **Underlying data:** OpenStreetMap.
- **License:** **ODbL** (Open Database License) — attribution REQUIRED:
  `© OpenStreetMap contributors`. OpenFreeMap asks for a tiles credit too.
- **Keyless:** yes (no API key, CORS-enabled, version-dated `{z}/{x}/{y}.pbf`
  template resolved from the tilejson at runtime).

---

## `Esri World Imagery` — live satellite basemap (SatelliteTiles.js)

- **Source:** Esri World Imagery raster tiles, rendered by
  `src/utils/SatelliteTiles.js` as textured sphere patches at progressive zoom in
  explore mode.
  URL template: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
  (note Esri's `{z}/{y}/{x}` row-before-col order, unlike OSM's `{z}/{x}/{y}`).
- **Imagery providers:** Esri, Maxar, Earthstar Geographics (and the wider Esri
  community contributors).
- **License:** **free / keyless, attribution REQUIRED** — credit
  `Imagery © Esri, Maxar, Earthstar Geographics`. The Esri ToS permits this use
  for a portfolio / non-bulk, non-commercial-resale context (no API key, no
  bulk download/caching). Surfaced in the site footer.
- **Keyless:** yes (no API key, CORS-enabled `Access-Control-Allow-Origin: *`,
  returns `image/jpeg`).

---

## Per-dataset attribution

### `country_borders.json` — Country boundary lines

- **Source:** Natural Earth — Admin 0 Countries (boundary lines)
- **License:** Public Domain (Natural Earth terms — free to use, no permission needed, no credit required)
- **URL:** https://www.naturalearthdata.com/downloads/
- **Mirror:** https://github.com/nvkelso/natural-earth-vector
- **Shape:** `{ "rings": [ [ [lng, lat], ... ], ... ] }` (array of boundary line rings)

### `country_shapes.json` — Country fill polygons

- **Source:** Natural Earth — Admin 0 Countries
- **License:** Public Domain (Natural Earth terms)
- **URL:** https://www.naturalearthdata.com/downloads/
- **Mirror:** https://github.com/nvkelso/natural-earth-vector

### `country-pop.json` — Country population estimates (place card)

- **Source:** Natural Earth — Admin 0 Countries, 1:110m scale (`POP_EST` + `POP_YEAR` fields), the same layer as `country_shapes.json`
- **License:** Public Domain (Natural Earth terms)
- **Mirror file:** https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
- **Processing:** keyed by the exact `ADMIN` name used in `country_shapes.json` (177 of 177 matched, no aliases needed); `year` is the most common `POP_YEAR` (2019), `yearOverride` lists the countries whose estimate is from another year.
- **Shape:** `{ "source": "...", "year": 2019, "pop": { "Latvia": 1912789, ... }, "yearOverride": { "Taiwan": 2020, ... } }`
- **Regions:** Natural Earth Admin-1 has no population field, so region cards show none.

### `admin1-50m.json` — State / province boundary lines (1:50m)

- **Source:** Natural Earth — Admin 1 States/Provinces (boundary lines), 1:50m scale
- **License:** Public Domain (Natural Earth terms)
- **URL:** https://www.naturalearthdata.com/downloads/50m-cultural-vectors/
- **Mirror file:** https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lines.geojson
- **Processing:** simplified with mapshaper (`-simplify 60% keep-shapes`), coordinates rounded to 2 decimals, converted from GeoJSON LineString/MultiLineString to flat rings.
- **Shape:** `{ "rings": [ [ [lng, lat], ... ], ... ] }`

### `states-named.json` — Named state / province polygons (cascade hover)

- **Source:** Natural Earth Admin-1 (global provinces, public domain) for non-US regions; the **50 US states + DC + Puerto Rico** were replaced with higher-fidelity US Census cartographic-boundary polygons (public domain) so coastal cities (NYC, Miami) resolve correctly.
- **US polygons mirror:** https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json (US Census-derived, public domain)
- **License:** Public Domain (Natural Earth + US Census)
- **Processing:** US features converted to flat `{name, rings}`, coordinates rounded to 4 decimals; foreign regions sharing a US state name (Montana/Bulgaria, Maryland/Liberia, Florida/Uruguay) preserved.
- **Shape:** `{ "features": [ { "name": "California", "rings": [ [ [lng, lat], ... ] ] } ] }`

### `populated-places.json` — Cities & towns (top 2000 by population)

- **Source:** Natural Earth — Populated Places, 1:10m scale (uses the `POP_MAX` field for population)
- **License:** Public Domain (Natural Earth terms)
- **URL:** https://www.naturalearthdata.com/downloads/10m-cultural-vectors/
- **Mirror file:** https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson
- **Processing:** sorted by `POP_MAX` descending, capped to the top 2000, coordinates rounded to 4 decimals.
- **Shape:** `{ "places": [ { "name": "...", "lat": <num>, "lng": <num>, "pop": <int> }, ... ] }` (sorted by `pop` descending)

### `counties-us-named.json` — US counties (named, point-in-polygon "areas" tier)

- **Source:** US Census Bureau TIGER / cartographic county boundaries (public domain), via the Plotly datasets mirror.
- **License:** Public Domain (US Census TIGER products are not subject to copyright)
- **URL:** https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json
- **Upstream:** https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
- **`name` field:** the `NAME` property, suffixed with the 2-letter USPS state abbreviation derived from the `STATE` FIPS code (e.g. "San Francisco, CA", "Los Angeles, CA", "Cook, IL")
- **Processing:** simplified hard with mapshaper (`-simplify 6% keep-shapes`), coordinates rounded to 3 decimals, Polygon/MultiPolygon flattened to filled rings.
- **Shape:** `{ "features": [ { "name": "<County>, <ST>", "rings": [ [ [lng, lat], ... ], ... ] }, ... ] }`
- **Stats:** 3221 features, ~567 KB.

---

## Notes on sourcing decisions

- **Why Natural Earth for cities** instead of GeoNames: Natural Earth is full
  public domain (zero attribution obligation), whereas GeoNames is CC BY 4.0
  (attribution required). Natural Earth's `POP_MAX` gave a clean top-2000 with
  real populations, so no keyed source was needed.
- All sources were fetched live from public GitHub mirrors; none required an API key.
