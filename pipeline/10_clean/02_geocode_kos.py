#!/usr/bin/env python3
"""Recover approximate coordinates for the surveyed kos, so A1 can be modelled.

    python pipeline/10_clean/02_geocode_kos.py [--force]

The field survey did not record kos coordinates. Location exists only as
`Kawasan` (12 survey areas), which collapses 29 price labels onto 12 geographic
points -- far too coarse to train A1 across 2,134 hexagons.

This recovers position from the road each kos sits on, using the OSM walk graph
as the gazetteer. OSM is used rather than Google Maps because it is already
downloaded, free, offline, reproducible, and carries no terms-of-service or
API-key problem. 3,653 distinct road names cover the study area.

Three tiers, in the order the repo owner proposed:

  1. NAME IN THE KOS RECORD. Some kos names embed their road
     ("Kos Nawangsari (Candisari, Jl. Kaliurang Km 13)"). Match that road.
  2. LINKED RUAS. 27 of 31 kos carry `ID ruas terkait`; the survey recorded that
     segment's road name. Match it.
  3. SURVEY AREA CENTROID. Neither worked -- fall back to the centroid of the
     other located kos in the same Kawasan.

Matching is fuzzy because survey names are handwritten: "Jl.Murai",
"JI. Pandega Maharsi" (capital I for l), "Jl. Padjajaran depan UPN persis".
Exact string matching finds none of the 20 needed roads.

EVERY result carries `presisi` saying how it was derived, and `sumber_koordinat`
naming the road matched. A1 must treat tier 3 as far weaker evidence than tier 1
-- these are ESTIMATES, and the spread of a road can be hundreds of metres.

Output: data/interim/kos_geocoded.parquet
"""
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S, CRS_WGS84

AMBANG = 0.72   # minimum similarity to accept a road-name match

# Words that carry no identifying information in an Indonesian road name.
STOP = {
    "jl", "jln", "jalan", "gg", "gang", "raya", "km", "no", "depan", "persis",
    "arah", "sebaliknya", "dalam", "sisi", "barat", "timur", "utara", "selatan",
    "kos", "kost", "putra", "putri", "exclusive", "eksklusif", "exsklusif",
}


def normalise(s: str) -> str:
    """Lowercase, strip accents and punctuation, drop generic road words.

    Also fixes a common transcription slip: a capital I typed for a lowercase l,
    which turns "Jl." into "JI." and defeats exact matching.
    """
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("JI.", "Jl.").replace("Ji.", "Jl.")
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    kata = [w for w in s.split() if w and w not in STOP]
    return " ".join(kata)


def ekstrak_jalan(teks: str) -> str:
    """Pull an explicit road name out of a free-text kos record.

    Returns "" unless the text actually contains a road marker (Jl., Jln, Gg.,
    Gang, Perumnas...). Without this guard the matcher compares a kos's own name
    against 3,297 road names and finds spurious letter-overlap hits.
    """
    if not isinstance(teks, str):
        return ""
    m = re.search(r"\b(jl\.?|jln\.?|jalan|gg\.?|gang)\s*\.?\s*([^,()]+)",
                  teks, flags=re.IGNORECASE)
    return f"{m.group(1)} {m.group(2)}".strip() if m else ""


def mirip(a: str, b: str) -> float:
    """Similarity in [0,1], rewarding shared distinctive tokens."""
    if not a or not b:
        return 0.0
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return 0.0
    jaccard = len(ta & tb) / len(ta | tb)
    urutan = SequenceMatcher(None, a, b).ratio()
    return max(jaccard, urutan)


def _osm_roads() -> gpd.GeoDataFrame:
    """One row per named road, geometry dissolved, in metric CRS."""
    G = ox.load_graphml(interim("walk_graph.graphml"))
    e = ox.graph_to_gdfs(G, nodes=False, edges=True).to_crs(CRS_UTM49S)
    e = e[e["name"].notna()].copy()
    # A way may carry several names; explode so each is matchable.
    e["name"] = e["name"].apply(lambda n: n if isinstance(n, list) else [n])
    e = e.explode("name")
    e["kunci"] = e["name"].apply(normalise)
    e = e[e.kunci != ""]
    jalan = e.dissolve(by="kunci", aggfunc={"name": "first"}).reset_index()
    return jalan


def cari_jalan(teks: str, jalan: gpd.GeoDataFrame):
    """Best fuzzy match for a road name; returns (row, score) or (None, 0)."""
    kunci = normalise(teks)
    if not kunci:
        return None, 0.0
    skor = jalan["kunci"].apply(lambda k: mirip(kunci, k))
    i = skor.idxmax()
    return (jalan.loc[i], float(skor[i])) if skor[i] >= AMBANG else (None, float(skor[i]))


def main(force: bool = False) -> int:
    out_path = interim("kos_geocoded.parquet")
    if cached(out_path, force):
        return 0

    kos = pd.read_parquet(interim("survei_kos.parquet"))
    ruas = pd.read_parquet(interim("survei_ruas.parquet"))
    ruas_nama = dict(zip(ruas["ID"], ruas["Nama ruas"]))

    jalan = _osm_roads()
    print(f"  gazetteer OSM: {len(jalan):,} jalan bernama")

    baris = []
    for _, k in kos.iterrows():
        nama = k["Nama atau alamat kos"]
        rid = k["ID ruas terkait"]

        # Tier 1: an EXPLICIT road inside the kos record, e.g.
        # "Kos Nawangsari (Candisari, Jl. Kaliurang Km 13)". Only the part after
        # a "Jl./Gg." marker is used. Matching the whole kos name against road
        # names is worthless -- it matched "Kost Soto Medan" to "Gang Noto
        # Dimejan" and "Kos Aydin" to "Jalan Gading" purely on letter overlap.
        hit, skor, tier, dari = None, 0.0, None, None
        jalan_di_nama = ekstrak_jalan(nama)
        if jalan_di_nama:
            hit, skor = cari_jalan(jalan_di_nama, jalan)
            tier, dari = "nama_kos", jalan_di_nama

        # Tier 2: the road of the linked survey segment. This is the reliable
        # tier -- the surveyor recorded which segment the kos sits on.
        if hit is None and isinstance(rid, str) and rid in ruas_nama:
            hit, skor = cari_jalan(ruas_nama[rid], jalan)
            tier, dari = "ruas_terkait", f"{rid}: {ruas_nama[rid]}"

        if hit is not None:
            titik = hit.geometry.centroid
            baris.append({
                "ID": k["ID"], "Kawasan": k["Kawasan"],
                "x": titik.x, "y": titik.y,
                "presisi": tier, "skor_cocok": round(skor, 3),
                "sumber_koordinat": hit["name"], "dicocokkan_dari": dari,
            })
        else:
            baris.append({
                "ID": k["ID"], "Kawasan": k["Kawasan"],
                "x": None, "y": None,
                "presisi": "gagal", "skor_cocok": round(skor, 3),
                "sumber_koordinat": None, "dicocokkan_dari": dari,
            })

    df = pd.DataFrame(baris)

    # Tier 3: fall back to the centroid of located kos in the same Kawasan.
    ok = df.x.notna()
    pusat = df[ok].groupby("Kawasan")[["x", "y"]].mean()
    for i in df.index[~ok]:
        kw = df.at[i, "Kawasan"]
        if kw in pusat.index:
            df.at[i, "x"] = pusat.at[kw, "x"]
            df.at[i, "y"] = pusat.at[kw, "y"]
            df.at[i, "presisi"] = "pusat_kawasan"
            df.at[i, "sumber_koordinat"] = f"rata-rata kos lain di {kw}"

    gdf = gpd.GeoDataFrame(
        df, geometry=gpd.points_from_xy(df.x, df.y), crs=CRS_UTM49S
    ).to_crs(CRS_WGS84)
    gdf["lon"] = gdf.geometry.x
    gdf["lat"] = gdf.geometry.y
    gdf.drop(columns="geometry").to_parquet(out_path)

    print()
    print("  hasil per tingkat presisi:")
    for t, n in df.presisi.value_counts().items():
        print(f"    {t:16s} {n:3d}")
    berharga = kos["Harga median (Rp)"].notna().values
    punya = df.x.notna().values
    print(f"  kos berharga DAN berkoordinat: {int((berharga & punya).sum())} dari "
          f"{int(berharga.sum())}")
    print(f"  -> {out_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
