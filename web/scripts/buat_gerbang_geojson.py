"""Beri nama gerbang kampus dari nama jalan terdekat pada walk graph.

Sumber:
  reference/kampus_gerbang_103.geojson  (titik gerbang, tanpa nama)
  data/interim/walk_graph.graphml       (ruas jalan OSM, punya atribut name)

Keluaran: web/public/data/kampus_gerbang.geojson
"""
import json, math, sys
from collections import defaultdict
import networkx as nx

GERBANG = "reference/kampus_gerbang_103.geojson"
GRAPH = "data/interim/walk_graph.graphml"
OUT = "web/public/data/kampus_gerbang.geojson"
RADIUS_M = 60  # jangan menamai gerbang dari jalan yang jauh

def meters(lon1, lat1, lon2, lat2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def seg_distance(px, py, ax, ay, bx, by):
    """Jarak titik ke ruas, di ruang lon/lat yang diskalakan ke meter."""
    k = math.cos(math.radians(py))
    px_, ax_, bx_ = px*k, ax*k, bx*k
    dx, dy = bx_-ax_, by-ay
    if dx == 0 and dy == 0:
        t = 0.0
    else:
        t = max(0.0, min(1.0, ((px_-ax_)*dx + (py-ay)*dy) / (dx*dx + dy*dy)))
    cx_, cy = ax_ + t*dx, ay + t*dy
    return math.hypot((px_-cx_), (cy-py)) * 111320.0

def main():
    G = nx.read_graphml(GRAPH)
    pos = {n: (float(d["x"]), float(d["y"])) for n, d in G.nodes(data=True)}

    # Hanya ruas bernama yang berguna sebagai label.
    edges = []
    for u, v, d in G.edges(data=True):
        name = d.get("name")
        if not name or u not in pos or v not in pos:
            continue
        if isinstance(name, str) and name.startswith("["):
            # osmnx kadang menyimpan daftar nama sebagai string
            try:
                name = json.loads(name.replace("'", '"'))[0]
            except Exception:
                pass
        if isinstance(name, list):
            name = name[0]
        edges.append((pos[u], pos[v], str(name)))
    print(f"ruas bernama: {len(edges)}", file=sys.stderr)

    gj = json.load(open(GERBANG, encoding="utf-8"))
    out = []
    per_jalan = defaultdict(int)
    tanpa_nama = 0

    for f in gj["features"]:
        lon, lat = f["geometry"]["coordinates"]
        best, best_d = None, float("inf")
        for (ax, ay), (bx, by), name in edges:
            # saring kasar dulu supaya tidak menghitung semua ruas
            if abs(ax-lon) > 0.002 and abs(bx-lon) > 0.002:
                continue
            if abs(ay-lat) > 0.002 and abs(by-lat) > 0.002:
                continue
            dd = seg_distance(lon, lat, ax, ay, bx, by)
            if dd < best_d:
                best, best_d = name, dd
        kampus = f["properties"]["kampus"]
        if best is None or best_d > RADIUS_M:
            best = None
            tanpa_nama += 1
        else:
            per_jalan[(kampus, best)] += 1
        out.append({
            "type": "Feature",
            "geometry": f["geometry"],
            "properties": {
                "kampus": kampus,
                "jalan": best,
                "jarak_jalan_m": None if best is None else round(best_d, 1),
                "osm_node": f["properties"]["osm_node"],
            },
        })

    # Bila satu kampus punya beberapa gerbang di jalan yang sama, beri nomor
    # supaya label tetap unik dan tidak menyesatkan.
    urut = defaultdict(int)
    for feat in out:
        p = feat["properties"]
        key = (p["kampus"], p["jalan"])
        if p["jalan"] is None:
            p["label"] = f"Gerbang {p['kampus']}"
            continue
        if per_jalan[key] > 1:
            urut[key] += 1
            p["label"] = f"Gerbang {p['kampus']} - {p['jalan']} {urut[key]}"
        else:
            p["label"] = f"Gerbang {p['kampus']} - {p['jalan']}"

    json.dump({"type": "FeatureCollection", "name": "kampus_gerbang",
               "features": out},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"tulis {len(out)} gerbang -> {OUT}; tanpa nama jalan: {tanpa_nama}",
          file=sys.stderr)

if __name__ == "__main__":
    main()
