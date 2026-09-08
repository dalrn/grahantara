#!/usr/bin/env python3
"""C3: can the nearest halte actually carry you to your campus?

    python pipeline/20_network/04_c3.py [--force]

This is the product thesis and the hardest step. A halte 100 m from your kos is
worthless if no corridor from it reaches your campus. Answering that needs the
inter-corridor transfer graph, not a buffer around stops.

THE MODELLING TRAP (hit once, documented so it is not repeated):

  The obvious graph -- stops as nodes, an edge between consecutive stops on a
  corridor -- is WRONG. Corridors share stops: 295 of 589 stops here are served
  by more than one corridor. With stops as nodes those shared stops silently
  fuse every corridor into a single connected blob, so riding from corridor 1A
  to corridor 4B costs zero transfers and every campus looks directly reachable
  from everywhere. That produced a flat 97.5% direct for nine campuses, which is
  how the bug was caught.

  The correct node is a (stop, corridor) PAIR. Then:
      ride     (s1, 1A) -> (s2, 1A)   cost 0   staying on the bus
      transfer (s,  1A) -> (s,  4B)   cost 1   changing corridor at a stop
      walk     (s1, 1A) -> (s2, 4B)   cost 1   walking a short way to change
  Changing corridor is now always an explicit, counted edge.

Method:

  1. Corridor graph over (stop, corridor) nodes as above.
  2. A stop serves a campus if it is within GATE_M walking distance of any gate
     of that campus.
  3. Per hexagon, per campus: from stops reachable on foot (ORIGIN_M), the
     minimum transfers to any (stop, corridor) node serving that campus.

         0 transfers -> 1.00   direct
         1 transfer  -> 0.60
         2+ or none  -> 0.20

Because AI-1 lets the user name their campus and the frontend re-ranks live, the
per-campus result is kept, not only the default. It goes to a companion file so
the 2,134-feature GeoJSON does not grow ten extra fields per hexagon.

Outputs: data/interim/c3.parquet, data/interim/c3_per_kampus.parquet
"""
import sys
from collections import defaultdict, deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import geopandas as gpd
import networkx as nx
import osmnx as ox
import pandas as pd

from pipeline.common.cache import cached, interim
from pipeline.common.geo import CRS_UTM49S
from pipeline.common.paths import hex_index

ORIGIN_M = 800      # how far a resident walks to their first stop
TRANSFER_M = 300    # how far they walk between stops to change corridor
GATE_M = 1000       # how far they walk from the alighting stop to a campus gate
# GATE_M was 600 m first. At that threshold Instiper and Sanata Dharma III had
# ZERO serving stops, which looked like a bug but is not: Instiper's nearest
# halte is 330 m in a straight line yet 918 m by the walking network, and Sanata
# Dharma III is 1,184 m. The routes are genuinely that indirect. A sensitivity
# sweep (600/800/1000/1200/1500 m) showed 1,000 m is where nine of ten campuses
# gain serving stops; Sanata Dharma III stays at zero until 1,200 m. 1,000 m is
# roughly a 12-minute walk and is kept as the honest threshold -- Sanata Dharma
# III scoring 0.20 everywhere is a true finding about its transit access, not a
# defect to be tuned away.

SKOR = {0: 1.00, 1: 0.60}
SKOR_JAUH = 0.20


def _undirected(G) -> nx.Graph:
    """Undirected view with the shortest parallel edge kept."""
    U = nx.Graph()
    for u, v, data in G.edges(data=True):
        w = float(data.get("length", 0.0))
        if U.has_edge(u, v):
            if w < U[u][v]["length"]:
                U[u][v]["length"] = w
        else:
            U.add_edge(u, v, length=w)
    return U


def main(force: bool = False) -> int:
    out_path = interim("c3.parquet")
    per_path = interim("c3_per_kampus.parquet")
    if cached(out_path, force) and per_path.exists():
        return 0

    G = ox.project_graph(ox.load_graphml(interim("walk_graph.graphml")),
                         to_crs=CRS_UTM49S)
    snap = pd.read_parquet(interim("snap.parquet"))
    halte = gpd.read_parquet(interim("halte_rute.parquet")).to_crs(CRS_UTM49S)
    rute = pd.read_parquet(interim("rute.parquet"))

    halte["osm_id"] = halte["osm_id"].astype(str)
    stop_pos = {r.osm_id: (r.geometry.x, r.geometry.y) for r in halte.itertuples()}

    # ---- 1. corridor graph over (stop, corridor) nodes ---------------------
    Cg = nx.Graph()
    stop_corridors = defaultdict(set)

    for _, r in rute.iterrows():
        if not r["stop_ids"]:
            continue
        ref = str(r["ref"] or r["rel_id"])
        seq = [s for s in str(r["stop_ids"]).split(",") if s in stop_pos]
        for s in seq:
            stop_corridors[s].add(ref)
        for a, b in zip(seq, seq[1:]):
            if a != b:
                Cg.add_edge((a, ref), (b, ref), transfer=0)

    # Transfer at the same stop: change corridor without walking.
    n_same = 0
    for s, refs in stop_corridors.items():
        refs = sorted(refs)
        for i, ra in enumerate(refs):
            for rb in refs[i + 1:]:
                Cg.add_edge((s, ra), (s, rb), transfer=1)
                n_same += 1

    # Transfer by walking a short way to a nearby stop on another corridor.
    ids = list(stop_pos)
    pts = gpd.GeoDataFrame(
        {"osm_id": ids},
        geometry=gpd.points_from_xy([stop_pos[i][0] for i in ids],
                                    [stop_pos[i][1] for i in ids]),
        crs=CRS_UTM49S)
    joined = gpd.sjoin_nearest(pts, pts, how="inner", max_distance=TRANSFER_M,
                              distance_col="d")
    n_walk = 0
    for row in joined.itertuples():
        a, b = row.osm_id_left, row.osm_id_right
        if a == b:
            continue
        for ra in stop_corridors.get(a, ()):
            for rb in stop_corridors.get(b, ()):
                if ra == rb:
                    continue  # same corridor: that is a ride, not a transfer
                if not Cg.has_edge((a, ra), (b, rb)):
                    Cg.add_edge((a, ra), (b, rb), transfer=1)
                    n_walk += 1

    comps = nx.number_connected_components(Cg)
    print(f"  graf koridor: {Cg.number_of_nodes()} simpul (halte,koridor), "
          f"{Cg.number_of_edges()} sisi")
    print(f"    transfer di halte sama {n_same}, transfer jalan kaki {n_walk}, "
          f"komponen {comps}")

    # ---- 2. which stops serve which campus ---------------------------------
    U = _undirected(G)

    key_to_node = dict(zip(snap.loc[snap.kind == "halte", "key"],
                           snap.loc[snap.kind == "halte", "node"]))
    node_to_stops = defaultdict(list)
    for sid, nd in key_to_node.items():
        node_to_stops[nd].append(sid)

    gates = snap[snap.kind == "gerbang"].copy()
    gates["kampus"] = gates["key"].str.split("|").str[0]
    kampus_list = sorted(gates["kampus"].unique())

    kampus_stops = {k: set() for k in kampus_list}
    for kampus, grp in gates.groupby("kampus"):
        for nd in set(grp["node"]):
            if nd not in U:
                continue
            near = nx.single_source_dijkstra_path_length(U, nd, cutoff=GATE_M,
                                                         weight="length")
            for n in near:
                kampus_stops[kampus].update(node_to_stops.get(n, []))
    for k in kampus_list:
        served = sum(1 for s in kampus_stops[k] if s in stop_corridors)
        print(f"    {k:22s} {len(kampus_stops[k]):3d} halte dalam {GATE_M} m "
              f"({served} dilayani koridor)")

    # ---- 3. transfers from every (stop, corridor) to every campus ----------
    def transfers_to(target_stops):
        """0-1 BFS: ride edges cost 0, transfer edges cost 1."""
        dist = {}
        dq = deque()
        for s in target_stops:
            for ref in stop_corridors.get(s, ()):
                node = (s, ref)
                if node in Cg and node not in dist:
                    dist[node] = 0
                    dq.appendleft(node)
        while dq:
            u = dq.popleft()
            du = dist[u]
            for v, data in Cg[u].items():
                nd = du + data["transfer"]
                if v not in dist or nd < dist[v]:
                    dist[v] = nd
                    if data["transfer"] == 0:
                        dq.appendleft(v)
                    else:
                        dq.append(v)
        return dist

    stop_transfers = {k: transfers_to(kampus_stops[k]) for k in kampus_list}

    # ---- 4. per hexagon ----------------------------------------------------
    hexes = snap[snap.kind == "hexagon"].set_index("key")
    origin_cache = {}

    rows, per_rows = [], []
    for i, h3 in enumerate(hex_index(), 1):
        node = hexes.at[h3, "node"]
        snap_m = float(hexes.at[h3, "snap_m"])
        budget = ORIGIN_M - snap_m
        if budget <= 0:
            origin = []
        else:
            if node not in origin_cache:
                near = nx.single_source_dijkstra_path_length(U, node,
                                                             cutoff=ORIGIN_M,
                                                             weight="length")
                origin_cache[node] = [(n, d) for n, d in near.items()
                                      if n in node_to_stops]
            origin = [(n, d) for n, d in origin_cache[node] if d <= budget]

        origin_stops = {s for n, _ in origin for s in node_to_stops[n]}
        origin_nodes = [(s, ref) for s in origin_stops
                        for ref in stop_corridors.get(s, ())]

        per = {}
        for k in kampus_list:
            td = stop_transfers[k]
            best = min((td[n] for n in origin_nodes if n in td), default=None)
            per[k] = SKOR_JAUH if best is None else SKOR.get(best, SKOR_JAUH)
        rows.append({"h3_index": h3,
                     "n_halte_asal": len(origin_stops),
                     "n_koridor_asal": len({r for _, r in origin_nodes})})
        per_rows.append({"h3_index": h3, **per})
        if i % 500 == 0:
            print(f"    {i}/2134 heksagon")

    per_df = pd.DataFrame(per_rows)
    base = pd.DataFrame(rows)
    # Default C3 is the best campus reachable, so a hexagon well connected to
    # any campus scores well by default. AI-1 narrows it to the chosen campus.
    base["C3_nilai"] = per_df[kampus_list].max(axis=1)
    base["C3_kampus_terbaik"] = per_df[kampus_list].idxmax(axis=1)
    base.to_parquet(out_path)
    per_df.to_parquet(per_path)

    print()
    print("  sebaran C3 bawaan (kampus terbaik):")
    for v, lbl in ((1.00, "langsung"), (0.60, "satu transfer"),
                   (0.20, "2+/tidak terjangkau")):
        n = int((base.C3_nilai == v).sum())
        print(f"    {lbl:22s} {n:5d}  ({100 * n / len(base):5.1f}%)")
    print()
    reach = base.n_halte_asal > 0
    print(f"  heksagon dengan >=1 halte dalam {ORIGIN_M} m: {int(reach.sum())}")
    print("  per kampus, dari heksagon yang punya halte:")
    print(f"    {'kampus':22s} {'langsung':>9s} {'1 transfer':>11s} {'tidak':>8s}")
    for k in kampus_list:
        sub = per_df.loc[reach.values, k]
        d = int((sub == 1.00).sum())
        t = int((sub == 0.60).sum())
        x = int((sub == 0.20).sum())
        print(f"    {k:22s} {d:5d} ({100*d/len(sub):4.1f}%) {t:5d} ({100*t/len(sub):4.1f}%) "
              f"{x:5d}")
    print(f"\n  -> {out_path.name}, {per_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main("--force" in sys.argv))
