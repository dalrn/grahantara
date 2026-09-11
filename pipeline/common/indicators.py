"""Indicator records, percentile normalisation, and score aggregation.

Three rules from docs/DATA_DICTIONARY.md are enforced here so that no pipeline
stage can accidentally break them:

1. Every indicator is normalised as an ECDF percentile rank against the whole
   study area, not as an absolute value.
2. `tidak_tersedia` means excluded from the score, and the remaining weights in
   that dimension are renormalised. There is NO neutral 0.5 imputation.
3. The final score is a weighted GEOMETRIC mean, so one near-zero dimension
   drags the total down regardless of the others.
"""
from typing import Any

import numpy as np
import pandas as pd

# Allowed values of the `sumber` field. Must match contracts/hexagon.schema.json.
# `mapid` covers MAPID's non-POI layers (flood hazard, nighttime light polygons);
# `mapid_poi` stays for the POI point layers. `viirs` and `inarisk` are retained
# for older files only -- W3 and W4 have read MAPID layers since 2026-09-11.
SUMBER = {
    "survei", "mapid_poi", "mapid", "osm", "sentinel2", "viirs", "inarisk",
    "krl", "model", "tidak_tersedia",
}

EPS = 0.01


def ecdf_percentile(values: pd.Series) -> pd.Series:
    """Percentile rank in [0,1] against the non-null pool.

    Ties share the average rank. NaN stays NaN -- missing data never gets a
    percentile, because a percentile would imply we know something.
    """
    return values.rank(method="average", pct=True, na_option="keep")


def indikator(nilai: Any, satuan: str | None, persentil: float | None,
              sumber: str) -> dict:
    """Build one schema-conformant indicator record.

    Guards the contract invariant: sumber='tidak_tersedia' REQUIRES both nilai
    and persentil to be null, and any other sumber requires a percentile in
    [0,1]. The validator checks this too; failing here gives a better message.
    """
    if sumber not in SUMBER:
        raise ValueError(f"sumber tidak dikenal: {sumber!r}")

    if sumber == "tidak_tersedia":
        if nilai is not None or persentil is not None:
            raise ValueError("tidak_tersedia harus punya nilai dan persentil None")
        return {"nilai": None, "satuan": satuan, "persentil": None, "sumber": sumber}

    if persentil is None or not 0 <= persentil <= 1:
        raise ValueError(f"persentil harus 0..1, dapat {persentil!r}")

    if isinstance(nilai, (np.floating, np.integer)):
        nilai = nilai.item()
    if isinstance(nilai, float):
        nilai = round(nilai, 4)

    return {
        "nilai": nilai,
        "satuan": satuan,
        "persentil": round(float(persentil), 4),
        "sumber": sumber,
    }


def tidak_tersedia(satuan: str | None = None) -> dict:
    """Shorthand for an indicator with no data. Never render this as 0."""
    return indikator(None, satuan, None, "tidak_tersedia")


def subskor(indikator_dimensi: dict[str, dict],
            bobot: dict[str, float]) -> float | None:
    """Weighted mean of indicator percentiles, on a 0-100 scale.

    Indicators sourced `tidak_tersedia` are dropped and the remaining weights
    are renormalised within the dimension. If every indicator in the dimension
    is missing, the subscore is 0.0 -- which the geometric mean then propagates
    honestly, rather than inventing a middling value.
    """
    total_bobot = 0.0
    total = 0.0
    for kunci, rec in indikator_dimensi.items():
        if rec["sumber"] == "tidak_tersedia":
            continue
        w = bobot[kunci]
        total += w * rec["persentil"]
        total_bobot += w

    if total_bobot == 0:
        # Every indicator in the dimension is missing. Returning None (not 0)
        # lets skor_akhir exclude the dimension and renormalise, instead of
        # scoring the hexagon as if it were genuinely bad.
        return None
    return round(100.0 * total / total_bobot, 2)


def skor_akhir(sub: dict[str, float | None], bobot_dimensi: dict[str, float],
               eps: float = EPS) -> float:
    """Weighted geometric mean of the subscores, 0-100.

        Skor = 100 * PROD((sub_d/100 + eps) ** bobot_d)

    A dimension whose value is None is EXCLUDED and the remaining dimension
    weights are renormalised, exactly as indicator weights are renormalised
    inside a dimension when an indicator is tidak_tersedia.

    This matters because Affordability is unavailable in 1,981 of 2,134
    hexagons: A1 covers 7.2% and A2 has no source at all. Scoring the empty
    dimension as 0 dragged a typical hexagon from ~47 to ~18, which punishes
    93% of the map for MISSING DATA rather than for being expensive -- the one
    thing docs/DATA_DICTIONARY.md and CLAUDE.md both forbid.

    The dictionary defines renormalisation for missing indicators but is silent
    on a missing dimension; this applies its stated principle one level up.

    NOTE for web/src/lib/mesinSkor.js: the client recomputes this in log space
    from the four subscores. Hexagons with an excluded dimension carry that
    dimension as 0 in the GeoJSON for schema conformance, so the client MUST
    read properties.dimensi_kosong to reproduce these numbers.
    """
    ada = {d: v for d, v in sub.items() if v is not None}
    if not ada:
        return 0.0
    total = sum(bobot_dimensi[d] for d in ada)
    if total <= 0:
        return 0.0
    log_sum = 0.0
    for dim, nilai in ada.items():
        w = bobot_dimensi[dim] / total
        log_sum += w * np.log(nilai / 100.0 + eps)
    return round(float(np.clip(100.0 * np.exp(log_sum), 0.0, 100.0)), 2)
