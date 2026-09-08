"""Geospatial constants and H3 helpers.

Every distance in this project is a metric distance in EPSG:32749 (UTM 49S).
Never measure in EPSG:4326 -- degrees are not metres, and at this latitude the
error is large enough to reorder hexagons.
"""
import geopandas as gpd
import h3
import pandas as pd
from shapely.geometry import Point, Polygon

CRS_WGS84 = "EPSG:4326"
CRS_UTM49S = "EPSG:32749"  # Sleman, DIY


def to_metric(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Reproject to UTM 49S for metric work."""
    if gdf.crs is None:
        gdf = gdf.set_crs(CRS_WGS84)
    return gdf.to_crs(CRS_UTM49S)


def hex_polygons(cells: list[str], metric: bool = False) -> gpd.GeoDataFrame:
    """H3 cells -> GeoDataFrame of polygons, indexed by h3_index."""
    geoms = [Polygon([(lng, lat) for lat, lng in h3.cell_to_boundary(c)]) for c in cells]
    gdf = gpd.GeoDataFrame({"h3_index": cells}, geometry=geoms, crs=CRS_WGS84)
    return to_metric(gdf) if metric else gdf


def hex_centroids(cells: list[str], metric: bool = False) -> gpd.GeoDataFrame:
    """H3 cell centres. Uses the true H3 centre, not the polygon centroid."""
    pts = []
    for c in cells:
        lat, lng = h3.cell_to_latlng(c)
        pts.append(Point(lng, lat))
    gdf = gpd.GeoDataFrame({"h3_index": cells}, geometry=pts, crs=CRS_WGS84)
    return to_metric(gdf) if metric else gdf


def points_to_hex(gdf: gpd.GeoDataFrame, res: int = 9) -> pd.Series:
    """Assign each point to its H3 cell. Input must be in EPSG:4326."""
    if gdf.crs is not None and gdf.crs.to_string() != CRS_WGS84:
        gdf = gdf.to_crs(CRS_WGS84)
    return gdf.geometry.apply(lambda p: h3.latlng_to_cell(p.y, p.x, res))
