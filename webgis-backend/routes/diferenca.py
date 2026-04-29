from flask import Blueprint, jsonify, request
from shapely import difference as shapely_difference
from shapely import intersection as shapely_intersection
from shapely import make_valid, set_precision
from shapely.errors import GEOSException
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

diferenca_bp = Blueprint("diferenca", __name__)
GEOMETRY_GRID_SIZE = 1e-10


def iter_features(geojson):
    if not geojson:
        return []

    geojson_type = geojson.get("type")
    if geojson_type == "FeatureCollection":
        return geojson.get("features", [])

    if geojson_type == "Feature":
        return [geojson]

    return []


def iter_polygonal_parts(geometry):
    if not geometry or geometry.is_empty:
        return

    if geometry.geom_type in ("Polygon", "MultiPolygon"):
        yield geometry
        return

    for part in getattr(geometry, "geoms", []):
        yield from iter_polygonal_parts(part)


def fix_geometry(geometry):
    if not geometry or geometry.is_empty:
        return None

    try:
        if not geometry.is_valid:
            geometry = make_valid(geometry)
    except GEOSException:
        geometry = geometry.buffer(0)

    polygonal_parts = list(iter_polygonal_parts(geometry))
    if polygonal_parts:
        geometry = unary_union(polygonal_parts) if len(polygonal_parts) > 1 else polygonal_parts[0]

    if geometry.is_empty:
        return None

    try:
        geometry = set_precision(geometry, GEOMETRY_GRID_SIZE)
    except GEOSException:
        geometry = geometry.buffer(0)

    if geometry.is_empty:
        return None

    if not geometry.is_valid:
        geometry = make_valid(geometry)
        polygonal_parts = list(iter_polygonal_parts(geometry))
        if polygonal_parts:
            geometry = unary_union(polygonal_parts) if len(polygonal_parts) > 1 else polygonal_parts[0]

    return None if geometry.is_empty else geometry


def collect_geometries(items):
    geometries = []

    for item in items or []:
        for feature in iter_features(item):
            geometry = feature.get("geometry")
            if geometry:
                fixed_geometry = fix_geometry(shape(geometry))
                if fixed_geometry:
                    geometries.append(fixed_geometry)

    return geometries


def union_geometries(geometries):
    fixed_geometries = [fix_geometry(geometry) for geometry in geometries]
    fixed_geometries = [geometry for geometry in fixed_geometries if geometry]

    if not fixed_geometries:
        return None

    return fix_geometry(unary_union(fixed_geometries))


def safe_overlay(operation, left, right):
    left = fix_geometry(left)
    right = fix_geometry(right)

    if not left or not right:
        return left

    try:
        if operation == "difference":
            return fix_geometry(shapely_difference(left, right, grid_size=GEOMETRY_GRID_SIZE))
        if operation == "intersection":
            return fix_geometry(shapely_intersection(left, right, grid_size=GEOMETRY_GRID_SIZE))
    except GEOSException:
        left = fix_geometry(left.buffer(0))
        right = fix_geometry(right.buffer(0))

        if operation == "difference":
            return fix_geometry(shapely_difference(left, right, grid_size=GEOMETRY_GRID_SIZE))
        if operation == "intersection":
            return fix_geometry(shapely_intersection(left, right, grid_size=GEOMETRY_GRID_SIZE))

    raise ValueError(f"Operacao espacial desconhecida: {operation}")


@diferenca_bp.route("/gerar-area-beneficiavel", methods=["POST"])
def gerar_area_beneficiavel():
    data = request.get_json() or {}
    imovel_geojson = data.get("imovel")
    impeditivas = data.get("impeditivas", [])
    apf_geojson = data.get("apf")
    estado = str(data.get("estado", "")).upper()

    try:
        if not imovel_geojson or not imovel_geojson.get("geometry"):
            return jsonify({"erro": "Geometria do imovel nao informada."}), 400

        imovel_geom = fix_geometry(shape(imovel_geojson["geometry"]))
        if not imovel_geom:
            return jsonify({"erro": "Geometria do imovel invalida ou vazia."}), 400

        resultado = imovel_geom

        geometries_impeditivas = collect_geometries(impeditivas)
        if geometries_impeditivas:
            uniao_impeditiva = union_geometries(geometries_impeditivas)
            if uniao_impeditiva:
                resultado = safe_overlay("difference", resultado, uniao_impeditiva)

        if estado == "MT":
            geoms_apf = collect_geometries([apf_geojson])
            if not geoms_apf:
                return jsonify(
                    {
                        "erro": "CAR do MT exige validacao com a camada externa APF."
                    }
                ), 400

            uniao_apf = union_geometries(geoms_apf)
            resultado = safe_overlay("intersection", resultado, uniao_apf)

        if not resultado or resultado.is_empty:
            return jsonify(
                {
                    "erro": "A area beneficiavel ficou vazia apos aplicar as restricoes."
                }
            ), 400

        return jsonify(mapping(resultado))
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
