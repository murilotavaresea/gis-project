import logging

from flask import Blueprint, jsonify, request

from services.mapbiomas_classes import (
    CLASSES_AGRICULTURA,
    CLASSES_LULC,
    CLASSES_PASTAGEM,
    GRUPOS_LULC,
)
from services.mapbiomas_service import (
    ANO_MAXIMO,
    ANO_MINIMO,
    COG_URLS,
    analisar_cobertura,
    gerar_mapa_png,
)

logger = logging.getLogger(__name__)

mapbiomas_bp = Blueprint("mapbiomas", __name__)


@mapbiomas_bp.route("/analise", methods=["POST"])
def analise_cobertura():
    """POST /mapbiomas/analise

    Body JSON:
        geometria  (obrigatório): GeoJSON Feature, FeatureCollection ou Geometry
        anos       (opcional):    lista de inteiros, ex. [2022, 2023, 2024]
        colecoes   (opcional):    lista de strings, ex. ["lulc", "pastagem"]

    Response: dict com resultados por coleção/ano + bloco "meta".
    """
    data = request.get_json(silent=True) or {}

    geometria = data.get("geometria")
    anos      = data.get("anos", [2024])
    colecoes  = data.get("colecoes", ["lulc"])

    if not geometria:
        return jsonify({"erro": "Campo 'geometria' é obrigatório."}), 400

    if not isinstance(anos, list) or not anos:
        return jsonify({"erro": "'anos' deve ser uma lista não vazia."}), 400

    if not isinstance(colecoes, list) or not colecoes:
        return jsonify({"erro": "'colecoes' deve ser uma lista não vazia."}), 400

    # Limite operacional: evita timeouts para solicitações muito grandes
    if len(anos) > 40:
        return jsonify({"erro": "Máximo de 40 anos por requisição."}), 400

    try:
        resultado = analisar_cobertura(geometria, anos, colecoes)
        return jsonify(resultado)
    except ValueError as exc:
        return jsonify({"erro": str(exc)}), 400
    except Exception as exc:
        return jsonify({"erro": f"Erro interno: {exc}"}), 500


@mapbiomas_bp.route("/mapa", methods=["POST"])
def mapa_cobertura():
    """POST /mapbiomas/mapa

    Body JSON:
        geometria (obrigatório): GeoJSON Feature, FeatureCollection ou Geometry
        ano       (opcional):    int  (padrão 2024)
        colecao   (opcional):    str  (padrão "lulc")

    Response: { png_base64, largura_px, altura_px, bounds }
    """
    data     = request.get_json(silent=True) or {}
    geometria = data.get("geometria")
    ano       = int(data.get("ano", 2024))
    colecao   = data.get("colecao", "lulc")

    if not geometria:
        return jsonify({"erro": "Campo 'geometria' é obrigatório."}), 400
    if colecao not in COG_URLS:
        return jsonify({"erro": f"Coleção '{colecao}' não disponível para mapa."}), 400
    if not (ANO_MINIMO <= ano <= ANO_MAXIMO):
        return jsonify({"erro": f"Ano {ano} fora do intervalo {ANO_MINIMO}–{ANO_MAXIMO}."}), 400

    try:
        resultado = gerar_mapa_png(geometria, ano, colecao)
        return jsonify(resultado)
    except ValueError as exc:
        return jsonify({"erro": str(exc)}), 400
    except Exception as exc:
        logger.exception("MapBiomas /mapa erro: %s", exc)
        return jsonify({"erro": f"Erro interno: {exc}"}), 500


@mapbiomas_bp.route("/classes", methods=["GET"])
def listar_classes():
    """GET /mapbiomas/classes

    Retorna o dicionário completo de classes por coleção (IDs, nomes, cores,
    hierarquia). Útil para montar legendas e definir cores no frontend.
    """
    return jsonify({
        "lulc":        CLASSES_LULC,
        "grupos_lulc": GRUPOS_LULC,
        "pastagem":    CLASSES_PASTAGEM,
        "agricultura": CLASSES_AGRICULTURA,
        "meta": {
            "colecao":   "10.1",
            "ano_min":   ANO_MINIMO,
            "ano_max":   ANO_MAXIMO,
        },
    })
