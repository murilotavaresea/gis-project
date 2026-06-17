import json

from flask import Blueprint, Response, jsonify

from config.camadas_locais import CAMADAS_LOCAIS
from db import get_db_connection

camadas_locais_bp = Blueprint("camadas_locais", __name__)

_TABELAS_PERMITIDAS = {c["tabela"] for c in CAMADAS_LOCAIS}


@camadas_locais_bp.route("/local/<tabela>")
def camada_local(tabela):
    if tabela not in _TABELAS_PERMITIDAS:
        return jsonify({"erro": "camada nao encontrada"}), 404

    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT json_build_object(
                    'type', 'FeatureCollection',
                    'features', coalesce(json_agg(
                        json_build_object(
                            'type',       'Feature',
                            'geometry',   ST_AsGeoJSON(t.geometry, 6)::json,
                            'properties', to_jsonb(t) - 'geometry'
                        )
                    ), '[]'::json)
                ) AS geojson
                FROM {tabela} t
                """
            )
            row = cur.fetchone()

        geojson = row["geojson"] if row else {"type": "FeatureCollection", "features": []}
        response = Response(json.dumps(geojson), mimetype="application/geo+json")
        response.headers["Cache-Control"] = "public, max-age=86400"
        return response

    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    finally:
        if conn:
            conn.close()
