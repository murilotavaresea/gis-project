import os
import tempfile

import requests
from flask import Blueprint, Response, request

ibama_bp = Blueprint("ibama", __name__)


def is_wfs_getfeature(params):
    return (
        params.get("service", "").upper() == "WFS"
        and params.get("request", "").lower() == "getfeature"
    )


def wants_geojson(params):
    output_format = params.get("outputFormat", "").lower()
    return "json" in output_format or params.get("f", "").lower() == "geojson"


def should_force_gml(params):
    return params.get("proxyFormat", "").lower() == "gml"


def is_xml_response(response):
    content_type = response.headers.get("Content-Type", "").lower()
    return "xml" in content_type or response.content.lstrip().startswith(b"<")


def normalize_wfs_params(params):
    normalized = params.copy()
    version = str(normalized.get("version", "2.0.0"))
    normalized.pop("proxyFormat", None)

    if "typenames" in normalized and "typeName" not in normalized and "typename" not in normalized:
        type_name = normalized.pop("typenames")
        normalized["typenames" if version.startswith("2.") else "typeName"] = type_name

    return normalized


def gml_bytes_to_geojson(content):
    temp_path = None

    try:
        import geopandas as gpd

        with tempfile.NamedTemporaryFile(delete=False, suffix=".gml") as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        gdf = gpd.read_file(temp_path)

        if gdf.crs and str(gdf.crs).upper() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        return gdf.to_json(drop_id=True)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def fetch_wfs_as_gml(base, params):
    fallback_params = params.copy()
    fallback_params.pop("outputFormat", None)
    return requests.get(base, params=fallback_params, timeout=60)


def proxy_external_request(base, params, timeout=60):
    response = requests.get(base, params=params, timeout=timeout)
    return Response(
        response.content,
        status=response.status_code,
        content_type=response.headers.get("Content-Type", "application/octet-stream"),
    )


# Proxy generico para WFS externo (IBAMA, INPE, INCRA, etc.)
@ibama_bp.route("/proxy/wfs")
def proxy_wfs():
    base = request.args.get("base", "").strip()

    if not base:
        return {"erro": "Parametro 'base' e obrigatorio"}, 400

    params = request.args.to_dict()
    params.pop("base", None)

    try:
        proxy_params = normalize_wfs_params(params)
        if is_wfs_getfeature(params) and wants_geojson(params) and should_force_gml(params):
            response = fetch_wfs_as_gml(base, proxy_params)
        else:
            response = requests.get(base, params=proxy_params, timeout=60)

        if response.ok and is_wfs_getfeature(params) and wants_geojson(params) and is_xml_response(response):
            try:
                geojson = gml_bytes_to_geojson(response.content)
                return Response(geojson, status=response.status_code, content_type="application/json")
            except Exception:
                try:
                    fallback_response = fetch_wfs_as_gml(base, proxy_params)

                    if fallback_response.ok and is_xml_response(fallback_response):
                        geojson = gml_bytes_to_geojson(fallback_response.content)
                        return Response(
                            geojson,
                            status=fallback_response.status_code,
                            content_type="application/json",
                        )
                except Exception:
                    pass

        return Response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get("Content-Type", "application/json"),
        )

    except Exception as error:
        return {"erro": str(error)}, 500


@ibama_bp.route("/proxy/wms")
def proxy_wms():
    base = request.args.get("base", "").strip()

    if not base:
        return {"erro": "Parametro 'base' e obrigatorio"}, 400

    params = request.args.to_dict()
    params.pop("base", None)

    try:
        return proxy_external_request(base, params)
    except Exception as error:
        return {"erro": str(error)}, 500
