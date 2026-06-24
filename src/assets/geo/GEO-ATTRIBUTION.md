# Geographic Data Attribution

All map data sources are keyless and legally clean for commercial use (public
domain, PDDL, or ODbL). No API keys, no NonCommercial terms, no paid tiers.
**Most static datasets in this folder are public domain and require no credit;
the live street basemap (OpenStreetMap via OpenFreeMap) is ODbL and DOES require
visible attribution.** The credits below are surfaced in the site footer.

---

## Footer credit (short form — REQUIRED visible)

> Map data © OpenStreetMap contributors (ODbL), tiles by OpenFreeMap · Natural
> Earth (public domain) · SF neighborhoods: DataSF.

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

### `districts-sf.json` — San Francisco neighborhood boundary lines

- **Source:** DataSF — Analysis Neighborhoods (41 official SF neighborhoods)
- **License:** Public Domain (DataSF datasets are released under the Public Domain Dedication and License / open data terms — free for any use, including commercial)
- **URL:** https://data.sfgov.org/Geographic-Locations-and-Boundaries/Analysis-Neighborhoods/j2bu-swwd
- **API endpoint used:** https://data.sfgov.org/resource/j2bu-swwd.geojson
- **Processing:** simplified with mapshaper (`-simplify 12% keep-shapes`), coordinates rounded to 5 decimals (~1 m), converted from MultiPolygon boundaries to flat rings.
- **Shape:** `{ "rings": [ [ [lng, lat], ... ], ... ] }` (neighborhood boundary rings; renders with the same loop as the other line layers)

### `districts-sf-named.json` — San Francisco neighborhoods (named, point-in-polygon)

- **Source:** DataSF — Analysis Neighborhoods (41 official SF neighborhoods)
- **License:** Public Domain (DataSF datasets are released under the Public Domain Dedication and License / PDDL — free for any use, including commercial; no attribution required)
- **URL:** https://data.sfgov.org/Geographic-Locations-and-Boundaries/Analysis-Neighborhoods/j2bu-swwd
- **API endpoint used:** https://data.sfgov.org/resource/j2bu-swwd.geojson
- **`name` field:** the `nhood` property (e.g. "Mission", "Castro/Upper Market", "Sunset/Parkside")
- **Processing:** simplified with mapshaper (`-simplify 12% keep-shapes`), coordinates rounded to 5 decimals (~1 m), MultiPolygon flattened to filled rings.
- **Shape:** `{ "features": [ { "name": "<nhood>", "rings": [ [ [lng, lat], ... ], ... ] }, ... ] }` (named fill polygons for point-in-polygon hover lookup)
- **Stats:** 41 features, ~138 KB.

### `counties-us-named.json` — US counties (named, point-in-polygon "areas" tier)

- **Source:** US Census Bureau TIGER / cartographic county boundaries (public domain), via the Plotly datasets mirror.
- **License:** Public Domain (US Census TIGER products are not subject to copyright)
- **URL:** https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json
- **Upstream:** https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
- **`name` field:** the `NAME` property, suffixed with the 2-letter USPS state abbreviation derived from the `STATE` FIPS code (e.g. "San Francisco, CA", "Los Angeles, CA", "Cook, IL")
- **Processing:** simplified hard with mapshaper (`-simplify 6% keep-shapes`), coordinates rounded to 3 decimals, Polygon/MultiPolygon flattened to filled rings.
- **Shape:** `{ "features": [ { "name": "<County>, <ST>", "rings": [ [ [lng, lat], ... ], ... ] }, ... ] }`
- **Stats:** 3221 features, ~567 KB.

### `zip-sf-named.json` — San Francisco Bay Area ZIP codes / ZCTA (named, point-in-polygon)

- **Source:** US Census Bureau ZIP Code Tabulation Areas (ZCTA, 2010 series, public domain), California subset via the OpenDataDE state ZIP GeoJSON mirror, clipped to the Bay Area.
- **License:** Public Domain (US Census ZCTA products are not subject to copyright)
- **URL:** https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ca_california_zip_codes_geo.min.json
- **Upstream:** https://www.census.gov/geographies/reference-files/time-series/geo/zcta.html
- **`name` field:** the `ZCTA5CE10` property = the 5-digit ZIP string (e.g. "94110", "94103", "94122")
- **Processing:** clipped to the Bay Area bbox (`-clip bbox=-123.2,36.9,-121.5,38.5`), simplified with mapshaper (`-simplify 6% keep-shapes`), coordinates rounded to 3 decimals, Polygon/MultiPolygon flattened to filled rings.
- **Shape:** `{ "features": [ { "name": "<ZIP5>", "rings": [ [ [lng, lat], ... ], ... ] }, ... ] }`
- **Stats:** 326 features, ~391 KB.

---

## Notes on sourcing decisions

- **Why Natural Earth for cities** instead of GeoNames: Natural Earth is full
  public domain (zero attribution obligation), whereas GeoNames is CC BY 4.0
  (attribution required). Natural Earth's `POP_MAX` gave a clean top-2000 with
  real populations, so no keyed source was needed.
- **Why DataSF for SF** instead of OSM/Overture: DataSF "Analysis Neighborhoods"
  is the city's own official 41-neighborhood layer, public domain, no key, and
  far cleaner than scraping OSM relations. (OSM/Overture would be ODbL/CC0 and
  also acceptable, but lower quality for this specific cut.)
- All sources were fetched live from public GitHub mirrors / the Socrata open
  data API; none required an API key.
