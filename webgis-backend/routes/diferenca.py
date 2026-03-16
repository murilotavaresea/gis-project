from flask import Blueprint, jsonify, request
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

diferenca_bp = Blueprint("diferenca", __name__)


def iter_features(geojson):
    if not geojson:
        return []

    geojson_type = geojson.get("type")
    if geojson_type == "FeatureCollection":
        return geojson.get("features", [])

    if geojson_type == "Feature":
        return [geojson]

    return []


def collect_geometries(items):
    geometries = []

    for item in items or []:
        for feature in iter_features(item):
            geometry = feature.get("geometry")
            if geometry:
                geometries.append(shape(geometry))

    return geometries


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

        imovel_geom = shape(imovel_geojson["geometry"])
        resultado = imovel_geom

        geometries_impeditivas = collect_geometries(impeditivas)
        if geometries_impeditivas:
            uniao_impeditiva = unary_union(geometries_impeditivas)
            resultado = resultado.difference(uniao_impeditiva)

        if estado == "MT":
            geoms_apf = collect_geometries([apf_geojson])
            if not geoms_apf:
                return jsonify(
                    {
                        "erro": "CAR do MT exige validacao com a camada externa APF."
                    }
                ), 400

            uniao_apf = unary_union(geoms_apf)
            resultado = resultado.intersection(uniao_apf)

        if resultado.is_empty:
            return jsonify(
                {
                    "erro": "A area beneficiavel ficou vazia apos aplicar as restricoes."
                }
            ), 400

        return jsonify(mapping(resultado))
    except Exception as error:
        return jsonify({"erro": str(error)}), 500
