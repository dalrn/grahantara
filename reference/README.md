# reference/

Hand-curated pipeline **inputs**. Unlike `data/`, this directory **is committed** —
these files are small, were made by hand, and the pipeline cannot be reproduced
without them.

## `kampus_gerbang_10.geojson` — CANONICAL

219 campus gate points across 10 campuses, extracted from OSM nodes tagged
`barrier=gate` (196) or `entrance=yes` (24).

This is the C3 input. C3 asks "does the nearest halte actually take you to *your*
campus", which requires real entry points — a campus centroid would put the gate
in the middle of a field.

| Campus | Gates |
|---|---|
| UGM | 106 |
| UNY | 56 |
| UII Kaliurang | 15 |
| UIN Sunan Kalijaga | 8 |
| UPN Veteran | 8 |
| STIE YKPN | 7 |
| Instiper | 6 |
| AMIKOM | 5 |
| Atma Jaya Babarsari | 4 |
| Sanata Dharma III | 4 |

**Duplicate `osm_node` values are intentional.** Nodes `12317733863` and
`12335959201` sit on the shared UGM/UNY boundary and serve both campuses, so they
appear twice with different `kampus`. Deduplicate on `(osm_node, kampus)`, never
on `osm_node` alone.

## `kampus_gerbang_103.geojson` — SUPERSEDED

Earlier draft (2026-07-16), 103 gates, 9 campuses. Kept for provenance only.
All 101 of its unique nodes are a strict subset of the canonical file, it is
missing UIN Sunan Kalijaga entirely, and it badly under-covers the large
campuses (UGM 42 vs 106, UNY 25 vs 56, UII 2 vs 15). **Do not read this file.**

## `hex_index.txt` — FROZEN

The 2,134 canonical H3 resolution-9 cells, one per line, sorted.

This is the primary key shared with the frontend. It is **frozen**: derived once
from the stub `hexagons.geojson` and never regenerated. Regenerating it from a
boundary polygon would risk a slightly different cell set, which would silently
desynchronise every `h3_index` join in `web/`.

Verified: 2,134 unique cells, all valid, all resolution 9, forming a single
connected component.

## `study_area.geojson` — DERIVED

The 2,134 hexagons dissolved into one boundary polygon. 213,19 km².
Bounds: lon 110,3341…110,4727 · lat −7,8371…−7,6433.

Use this to clip every OSM and raster download. For **routing graphs**, buffer it
by ~2 km first — clipping a walk graph to the analysis boundary makes edge
hexagons look unreachable when in reality the path just leaves and re-enters.
