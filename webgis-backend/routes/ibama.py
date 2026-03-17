import json
import os
import tempfile
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urlunparse

import requests
from flask import Blueprint, Response, current_app, request

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


def empty_geojson():
    return '{"type":"FeatureCollection","features":[]}', 0


def request_external(base, params, timeout=60):
    headers = {
        "User-Agent": "webgis-backend-proxy/1.0",
        "Accept": "*/*",
    }

    try:
        return requests.get(base, params=params, timeout=timeout, headers=headers)
    except requests.exceptions.SSLError as error:
        current_app.logger.warning(
            "Falha SSL ao consultar fonte externa; repetindo sem verificacao de certificado. "
            "base=%s erro=%s",
            base,
            error,
        )
        return requests.get(
            base,
            params=params,
            timeout=timeout,
            headers=headers,
            verify=False,
        )


def normalize_external_base_url(base):
    try:
        parsed = urlparse(base)
    except Exception:
        return base

    hostname = (parsed.hostname or "").lower()
    if hostname != "acervofundiario.incra.gov.br":
        return base

    if parsed.scheme != "https":
        return base

    netloc = hostname
    if parsed.port and parsed.port not in (80, 443):
        netloc = f"{hostname}:{parsed.port}"

    return urlunparse(
        parsed._replace(
            scheme="http",
            netloc=netloc,
        )
    )


def gml_has_features(content):
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        return True

    number_of_features = root.attrib.get("numberOfFeatures")
    if number_of_features == "0":
        return False

    namespaces = {
        "gml": "http://www.opengis.net/gml",
        "wfs": "http://www.opengis.net/wfs",
    }

    if root.findall(".//gml:featureMember", namespaces):
        return True

    if root.findall(".//gml:featureMembers", namespaces):
        return True

    return False


def gml_bytes_to_geojson(content, type_name=None):
    temp_path = None

    try:
        import geopandas as gpd

        if not gml_has_features(content):
            return empty_geojson()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".gml") as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        last_error = None
        gdf = None
        layer_name = (type_name or "").split(":")[-1].strip() or None
        read_attempts = []

        if layer_name:
            read_attempts.extend(
                [
                    {"layer": layer_name},
                    {"engine": "fiona", "layer": layer_name},
                ]
            )

        read_attempts.extend(
            [
                {},
                {"engine": "fiona"},
            ]
        )

        for kwargs in read_attempts:
            try:
                gdf = gpd.read_file(temp_path, **kwargs)
                break
            except Exception as error:
                last_error = error
                gdf = None

        if gdf is None:
            raise last_error

        if gdf is None or gdf.empty:
            return empty_geojson()

        if gdf.crs and str(gdf.crs).upper() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        return gdf.to_json(drop_id=True), len(gdf.index)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def fetch_wfs_as_gml(base, params):
    fallback_params = params.copy()
    fallback_params.pop("outputFormat", None)
    return request_external(base, fallback_params, timeout=60)


def build_response(content, status, content_type, extra_headers=None):
    response = Response(content, status=status, content_type=content_type)

    for header, value in (extra_headers or {}).items():
        response.headers[header] = value

    return response


def proxy_external_request(base, params, timeout=60):
    response = request_external(base, params, timeout=timeout)
    return Response(
        response.content,
        status=response.status_code,
        content_type=response.headers.get("Content-Type", "application/octet-stream"),
    )


# Proxy generico para WFS externo (IBAMA, INPE, INCRA, etc.)
@ibama_bp.route("/proxy/wfs")
def proxy_wfs():
    base = normalize_external_base_url(request.args.get("base", "").strip())

    if not base:
        return {"erro": "Parametro 'base' e obrigatorio"}, 400

    params = request.args.to_dict()
    params.pop("base", None)

    try:
        proxy_params = normalize_wfs_params(params)
        type_name = proxy_params.get("typeName") or proxy_params.get("typenames")
        if is_wfs_getfeature(params) and wants_geojson(params) and should_force_gml(params):
            response = fetch_wfs_as_gml(base, proxy_params)
        else:
            response = request_external(base, proxy_params, timeout=60)

        if response.ok and is_wfs_getfeature(params) and wants_geojson(params) and is_xml_response(response):
            try:
                geojson, feature_count = gml_bytes_to_geojson(response.content, type_name=type_name)
                return build_response(
                    geojson,
                    status=response.status_code,
                    content_type="application/json",
                    extra_headers={
                        "X-Proxy-Transform": "gml-to-geojson",
                        "X-Feature-Count": str(feature_count),
                    },
                )
            except Exception as error:
                current_app.logger.warning(
                    "Falha ao converter resposta WFS XML para GeoJSON (tentativa primaria). "
                    "base=%s type=%s status=%s erro=%s",
                    base,
                    type_name,
                    response.status_code,
                    error,
                    exc_info=True,
                )
                try:
                    fallback_response = fetch_wfs_as_gml(base, proxy_params)

                    if fallback_response.ok and is_xml_response(fallback_response):
                        geojson, feature_count = gml_bytes_to_geojson(
                            fallback_response.content,
                            type_name=type_name,
                        )
                        return build_response(
                            geojson,
                            status=fallback_response.status_code,
                            content_type="application/json",
                            extra_headers={
                                "X-Proxy-Transform": "gml-to-geojson-fallback",
                                "X-Feature-Count": str(feature_count),
                            },
                        )
                except Exception as fallback_error:
                    current_app.logger.warning(
                        "Falha ao converter resposta WFS XML para GeoJSON (tentativa fallback). "
                        "base=%s type=%s status=%s erro=%s",
                        base,
                        type_name,
                        response.status_code,
                        fallback_error,
                        exc_info=True,
                    )

                return build_response(
                    json.dumps(
                        {
                            "erro": "Falha ao converter resposta WFS GML para GeoJSON.",
                            "typeName": type_name or "",
                        }
                    ),
                    status=502,
                    content_type="application/json",
                    extra_headers={"X-Proxy-Transform": "gml-to-geojson-failed"},
                )

        return build_response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get("Content-Type", "application/json"),
            extra_headers={"X-Proxy-Transform": "passthrough"},
        )

    except Exception as error:
        return {"erro": str(error)}, 500


@ibama_bp.route("/proxy/wms")
def proxy_wms():
    base = normalize_external_base_url(request.args.get("base", "").strip())

    if not base:
        return {"erro": "Parametro 'base' e obrigatorio"}, 400

    params = request.args.to_dict()
    params.pop("base", None)

    try:
        return proxy_external_request(base, params)
    except Exception as error:
        return {"erro": str(error)}, 500
