"""SEMENTARA: bangun web/public/data/kampus_gerbang.geojson dari kanonik
tanpa walk_graph.graphml.

Label jalan/jarak diambil dari file lama (103 gerbang, subset kanonik) yang
sudah punya nama jalan. Gerbang yang tidak ada di file lama mendapat
jalan/jarak_jalan_m = null dan label bernomor per kampus.

Setelah data/interim/walk_graph.graphml tersedia, pakai cara asli:
jalankan web/scripts/buat_gerbang_geojson.py dengan
GERBANG = "reference/kampus_gerbang_10.geojson" (butuh networkx).

Pakai: python web/scripts/buat_gerbang_tanpa_graf.py
"""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAMA = ROOT / "web" / "public" / "data" / "kampus_gerbang.geojson"
KANONIK = ROOT / "reference" / "kampus_gerbang_10.geojson"
OUT = ROOT / "web" / "public" / "data" / "kampus_gerbang.geojson"


def main():
    # Baca file lama SEBELUM menulis apa pun.
    lama = json.loads(LAMA.read_text(encoding="utf-8"))
    indeks = {}
    for f in lama["features"]:
        p = f["properties"]
        indeks[(p["kampus"], p["osm_node"])] = p

    kanonik = json.loads(KANONIK.read_text(encoding="utf-8"))
    fitur = []
    per_kampus = defaultdict(int)
    null_per_kampus = defaultdict(list)
    tercocok = 0

    for f in kanonik["features"]:
        kp = f["properties"]
        asal = indeks.get((kp["kampus"], kp["osm_node"]))
        if asal:
            tercocok += 1
        jalan = asal["jalan"] if asal else None
        item = {
            "type": "Feature",
            "geometry": f["geometry"],
            "properties": {
                "kampus": kp["kampus"],
                "jalan": jalan,
                "jarak_jalan_m": asal["jarak_jalan_m"] if asal else None,
                "osm_node": kp["osm_node"],
                "label": asal["label"] if asal else None,
            },
        }
        fitur.append(item)
        per_kampus[kp["kampus"]] += 1
        if jalan is None:
            null_per_kampus[kp["kampus"]].append(item)

    # Label untuk semua fitur tanpa nama jalan, berurutan barat->timur lalu
    # selatan->utara supaya nomornya stabil dan mudah dicek.
    for kampus, items in null_per_kampus.items():
        items.sort(key=lambda it: tuple(it["geometry"]["coordinates"]))
        for i, it in enumerate(items, 1):
            it["properties"]["label"] = (
                f"Gerbang {kampus}" if len(items) == 1 else f"Gerbang {kampus} {i}"
            )

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "name": "kampus_gerbang",
                   "features": fitur}, f, ensure_ascii=False)

    print(f"tulis {len(fitur)} gerbang -> {OUT}")
    print(f"  tercocok dari file lama: {tercocok}")
    print(f"  tanpa nama jalan: {sum(len(v) for v in null_per_kampus.values())}")
    for kampus, items in sorted(null_per_kampus.items()):
        print(f"    {kampus}: {len(items)}")
    print(f"  per kampus: {dict(sorted(per_kampus.items()))}")


if __name__ == "__main__":
    main()
