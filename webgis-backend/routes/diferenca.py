from flask import Blueprint, request, jsonify
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

diferenca_bp = Blueprint('diferenca', __name__)

@diferenca_bp.route('/gerar-area-beneficiavel', methods=['POST'])
def gerar_area_beneficiavel():
    data = request.get_json()
    imovel_geojson = data.get('imovel')
    impeditivas = data.get('impeditivas', [])
    apf_geojson = data.get('apf')
    estado = data.get('estado', '').upper()

    try:
        # Converte área do imóvel
        imovel_geom = shape(imovel_geojson['geometry'])

        # Une todas as áreas impeditivas
        geoms_impeditivas = []
        for camada in impeditivas:
            for feat in camada.get('features', []):
                geoms_impeditivas.append(shape(feat['geometry']))
        if geoms_impeditivas:
            uniao_impeditiva = unary_union(geoms_impeditivas)
            resultado = imovel_geom.difference(uniao_impeditiva)
        else:
            resultado = imovel_geom

        # Caso MT, faz interseção com a APF
        if estado == "MT" and apf_geojson:
            geoms_apf = [shape(feat['geometry']) for feat in apf_geojson.get('features', [])]
            if geoms_apf:
                uniao_apf = unary_union(geoms_apf)
                resultado = resultado.intersection(uniao_apf)

        return jsonify(mapping(resultado))

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
