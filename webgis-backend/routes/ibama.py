import json
import os
import tempfile
import time
import xml.etree.ElementTree as ET
from collections import OrderedDict
from urllib.parse import urlencode, urlparse, urlunparse

import requests
from flask import Blueprint, Response, current_app, request
from shapely import wkt as shapely_wkt
from shapely.geometry import mapping

ibama_bp = Blueprint("ibama", __name__)

WFS_CACHE_TTL_SECONDS = 180
WFS_CACHE_MAX_ENTRIES = 24
WFS_CACHE = OrderedDict()
MAPBIOMAS_TOKEN_TTL_SECONDS = 6 * 60 * 60
MAPBIOMAS_RESPONSE_CACHE_TTL_SECONDS = 180
MAPBIOMAS_RESPONSE_CACHE_MAX_ENTRIES = 24
MAPBIOMAS_RESPONSE_CACHE = OrderedDict()
MAPBIOMAS_TOKEN_CACHE = {}
MAPBIOMAS_ALERTA_API_URL = "https://plataforma.alerta.mapbiomas.org/api/v2/graphql"
MAPBIOMAS_SIGN_IN_MUTATION = """
mutation signIn($email: String!, $password: String!) {
  signIn(email: $email, password: $password) {
    token
  }
}
"""
MAPBIOMAS_ALERTS_QUERY = """
query alerts(
  $page: Int,
  $limit: Int,
  $startDate: BaseDate,
  $endDate: BaseDate,
  $dateType: DateTypes,
  $sources: [SourceTypes!],
  $boundingBox: [Float!],
  $sortField: AlertSortField,
  $sortDirection: SortDirection
) {
  alerts(
    page: $page,
    limit: $limit,
    startDate: $startDate,
    endDate: $endDate,
    dateType: $dateType,
    sources: $sources,
    boundingBox: $boundingBox,
    sortField: $sortField,
    sortDirection: $sortDirection
  ) {
    collection {
      id
      alertCode
      areaHa
      detectedAt
      publishedAt
      statusName
      sources
      geometryWkt
      bbox
    }
  }
}
"""


class MapbiomasAuthError(Exception):
    pass


class MapbiomasApiError(Exception):
    pass


def build_wfs_cache_key(base, params):
    return f"{normalize_external_base_url(base)}?{urlencode(sorted(params.items()), doseq=True)}"


def get_cached_wfs_response(cache_key):
    cached = WFS_CACHE.get(cache_key)
    if not cached:
        return None

    if cached["expires_at"] <= time.time():
        WFS_CACHE.pop(cache_key, None)
        return None

    WFS_CACHE.move_to_end(cache_key)
    return cached


def set_cached_wfs_response(cache_key, *, content, status, content_type, extra_headers=None):
    if status >= 400:
        return

    WFS_CACHE[cache_key] = {
        "content": content,
        "status": status,
        "content_type": content_type,
        "extra_headers": extra_headers or {},
        "expires_at": time.time() + WFS_CACHE_TTL_SECONDS,
    }
    WFS_CACHE.move_to_end(cache_key)

    while len(WFS_CACHE) > WFS_CACHE_MAX_ENTRIES:
        WFS_CACHE.popitem(last=False)


def get_cached_entry(cache_store, cache_key):
    cached = cache_store.get(cache_key)
    if not cached:
        return None

    if cached["expires_at"] <= time.time():
        cache_store.pop(cache_key, None)
        return None

    cache_store.move_to_end(cache_key)
    return cached


def set_cached_entry(cache_store, cache_key, *, ttl_seconds, max_entries, payload):
    cache_store[cache_key] = {
        "payload": payload,
        "expires_at": time.time() + ttl_seconds,
    }
    cache_store.move_to_end(cache_key)

    while len(cache_store) > max_entries:
        cache_store.popitem(last=False)



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


def post_json(url, payload, *, headers=None, timeout=60):
    request_headers = {
        "User-Agent": "webgis-backend-proxy/1.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
        **(headers or {}),
    }

    try:
        return requests.post(url, json=payload, timeout=timeout, headers=request_headers)
    except requests.exceptions.SSLError as error:
        current_app.logger.warning(
            "Falha SSL ao consultar API externa via POST; repetindo sem verificacao de certificado. "
            "url=%s erro=%s",
            url,
            error,
        )
        return requests.post(
            url,
            json=payload,
            timeout=timeout,
            headers=request_headers,
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


def get_mapbiomas_credentials():
    email = os.getenv("MAPBIOMAS_ALERTA_EMAIL", "").strip()
    password = os.getenv("MAPBIOMAS_ALERTA_PASSWORD", "").strip()
    return email, password


def parse_mapbiomas_errors(payload):
    errors = payload.get("errors") or []
    message = " | ".join(
        str(item.get("message") or "Falha ao consultar o MapBiomas Alerta.")
        for item in errors
        if isinstance(item, dict)
    ).strip()

    if not message:
        message = "Falha ao consultar o MapBiomas Alerta."

    serialized = json.dumps(errors).lower()
    if any(token in serialized for token in ("unauth", "forbidden", "token", "login")):
        raise MapbiomasAuthError(message)

    raise MapbiomasApiError(message)


def normalize_mapbiomas_bbox(raw_bbox):
    if raw_bbox is None:
        return None

    if isinstance(raw_bbox, list):
        values = []
        for value in raw_bbox:
            try:
                values.append(float(value))
            except (TypeError, ValueError):
                continue
        return values[:4] if len(values) >= 4 else None

    text = str(raw_bbox).strip()
    if not text:
        return None

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return normalize_mapbiomas_bbox(parsed)
    except json.JSONDecodeError:
        pass

    numeric_values = []
    current = ""
    valid_chars = set("-0123456789.")
    for char in text:
        if char in valid_chars:
            current += char
            continue

        if current:
            try:
                numeric_values.append(float(current))
            except ValueError:
                pass
            current = ""

    if current:
        try:
            numeric_values.append(float(current))
        except ValueError:
            pass

    return numeric_values[:4] if len(numeric_values) >= 4 else None


def build_polygon_from_bounds(bounds):
    west, south, east, north = bounds
    return {
        "type": "Polygon",
        "coordinates": [[
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
        ]],
    }


def geometry_from_wkt(geometry_wkt):
    if not geometry_wkt:
        return None

    try:
        geometry = shapely_wkt.loads(geometry_wkt)
    except Exception:
        return None

    return mapping(geometry) if geometry else None


def build_mapbiomas_feature(alert):
    geometry = geometry_from_wkt(alert.get("geometryWkt"))
    bounds = normalize_mapbiomas_bbox(alert.get("bbox"))
    if geometry is None and not bounds:
        return None

    sources = alert.get("sources")
    return {
        "type": "Feature",
        "geometry": geometry or build_polygon_from_bounds(bounds),
        "properties": {
            "id": alert.get("id"),
            "alertCode": alert.get("alertCode"),
            "areaHa": alert.get("areaHa"),
            "detectedAt": alert.get("detectedAt"),
            "publishedAt": alert.get("publishedAt"),
            "statusName": alert.get("statusName"),
            "sources": ", ".join(sources) if isinstance(sources, list) else sources,
            "provider": "MapBiomas Alerta",
            "geometrySource": "geometryWkt" if geometry is not None else "bbox",
        },
    }


def build_mapbiomas_response_cache_key(params):
    return json.dumps(params, sort_keys=True, ensure_ascii=True)


def get_mapbiomas_token(force_refresh=False):
    email, password = get_mapbiomas_credentials()
    if not email or not password:
        raise MapbiomasApiError(
            "Credenciais do MapBiomas Alerta nao configuradas no backend."
        )

    cached = MAPBIOMAS_TOKEN_CACHE.get("token")
    if (
        cached
        and not force_refresh
        and MAPBIOMAS_TOKEN_CACHE.get("email") == email
        and MAPBIOMAS_TOKEN_CACHE.get("expires_at", 0) > time.time()
    ):
        return cached

    response = post_json(
        MAPBIOMAS_ALERTA_API_URL,
        {
            "query": MAPBIOMAS_SIGN_IN_MUTATION,
            "variables": {
                "email": email,
                "password": password,
            },
        },
        timeout=60,
    )

    if not response.ok:
        raise MapbiomasApiError(
            f"Autenticacao no MapBiomas Alerta falhou com HTTP {response.status_code}."
        )

    payload = response.json()
    if payload.get("errors"):
        parse_mapbiomas_errors(payload)

    token = ((payload.get("data") or {}).get("signIn") or {}).get("token")
    if not token:
        raise MapbiomasApiError(
            "Autenticacao no MapBiomas Alerta nao retornou token."
        )

    MAPBIOMAS_TOKEN_CACHE.clear()
    MAPBIOMAS_TOKEN_CACHE.update(
        {
            "token": token,
            "email": email,
            "expires_at": time.time() + MAPBIOMAS_TOKEN_TTL_SECONDS,
        }
    )
    return token


def request_mapbiomas_alerts(*, token, variables):
    normalized_variables = {
        key: value
        for key, value in variables.items()
        if value is not None and value != ""
    }

    response = post_json(
        MAPBIOMAS_ALERTA_API_URL,
        {
            "query": MAPBIOMAS_ALERTS_QUERY,
            "variables": normalized_variables,
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )

    if response.status_code in (401, 403):
        raise MapbiomasAuthError(
            f"Consulta ao MapBiomas Alerta falhou com HTTP {response.status_code}."
        )

    if not response.ok:
        raise MapbiomasApiError(
            f"Consulta ao MapBiomas Alerta falhou com HTTP {response.status_code}."
        )

    payload = response.json()
    if payload.get("errors"):
        parse_mapbiomas_errors(payload)

    return ((payload.get("data") or {}).get("alerts") or {}).get("collection") or []


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


def build_cached_response(cached):
    headers = dict(cached.get("extra_headers") or {})
    headers["X-Proxy-Cache"] = "hit"
    return build_response(
        cached["content"],
        status=cached["status"],
        content_type=cached["content_type"],
        extra_headers=headers,
    )


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
        cache_key = build_wfs_cache_key(base, proxy_params)
        cached_response = get_cached_wfs_response(cache_key)

        if cached_response:
            return build_cached_response(cached_response)
        if is_wfs_getfeature(params) and wants_geojson(params) and should_force_gml(params):
            response = fetch_wfs_as_gml(base, proxy_params)
        else:
            response = request_external(base, proxy_params, timeout=60)

        if response.ok and is_wfs_getfeature(params) and wants_geojson(params) and is_xml_response(response):
            try:
                geojson, feature_count = gml_bytes_to_geojson(response.content, type_name=type_name)
                extra_headers = {
                    "X-Proxy-Transform": "gml-to-geojson",
                    "X-Feature-Count": str(feature_count),
                    "X-Proxy-Cache": "miss",
                }
                set_cached_wfs_response(
                    cache_key,
                    content=geojson,
                    status=response.status_code,
                    content_type="application/json",
                    extra_headers=extra_headers,
                )
                return build_response(
                    geojson,
                    status=response.status_code,
                    content_type="application/json",
                    extra_headers=extra_headers,
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
                        extra_headers = {
                            "X-Proxy-Transform": "gml-to-geojson-fallback",
                            "X-Feature-Count": str(feature_count),
                            "X-Proxy-Cache": "miss",
                        }
                        set_cached_wfs_response(
                            cache_key,
                            content=geojson,
                            status=fallback_response.status_code,
                            content_type="application/json",
                            extra_headers=extra_headers,
                        )
                        return build_response(
                            geojson,
                            status=fallback_response.status_code,
                            content_type="application/json",
                            extra_headers=extra_headers,
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

        extra_headers = {
            "X-Proxy-Transform": "passthrough",
            "X-Proxy-Cache": "miss",
        }
        set_cached_wfs_response(
            cache_key,
            content=response.content,
            status=response.status_code,
            content_type=response.headers.get("Content-Type", "application/json"),
            extra_headers=extra_headers,
        )
        return build_response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get("Content-Type", "application/json"),
            extra_headers=extra_headers,
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


@ibama_bp.route("/proxy/mapbiomas-alerta")
def proxy_mapbiomas_alerta():
    try:
        bbox = normalize_mapbiomas_bbox(request.args.get("bbox", ""))
        if not bbox:
            return {"erro": "Parametro 'bbox' invalido ou ausente."}, 400

        email, password = get_mapbiomas_credentials()
        if not email or not password:
            return {
                "erro": "Credenciais do MapBiomas Alerta nao configuradas no backend."
            }, 503

        start_date = request.args.get("startDate", "2019-01-01").strip() or "2019-01-01"
        end_date = request.args.get("endDate", "").strip() or None
        date_type = request.args.get("dateType", "DetectedAt").strip() or "DetectedAt"
        sort_field = request.args.get("sortField", "DETECTED_AT").strip() or "DETECTED_AT"
        sort_direction = request.args.get("sortDirection", "DESC").strip() or "DESC"
        page_size = max(1, min(int(request.args.get("pageSize", "100")), 500))
        max_pages = max(1, min(int(request.args.get("maxPages", "3")), 10))
        sources_raw = request.args.get("sources", "All").strip()
        sources = [item.strip() for item in sources_raw.split(",") if item.strip()] or ["All"]

        cache_key = build_mapbiomas_response_cache_key(
            {
                "bbox": bbox,
                "startDate": start_date,
                "endDate": end_date,
                "dateType": date_type,
                "sortField": sort_field,
                "sortDirection": sort_direction,
                "pageSize": page_size,
                "maxPages": max_pages,
                "sources": sources,
            }
        )
        cached = get_cached_entry(MAPBIOMAS_RESPONSE_CACHE, cache_key)
        if cached:
            response = build_response(
                json.dumps(cached["payload"]),
                status=200,
                content_type="application/json",
                extra_headers={"X-Proxy-Cache": "hit"},
            )
            return response

        def collect_features(force_refresh=False):
            token = get_mapbiomas_token(force_refresh=force_refresh)
            features = []

            for page in range(1, max_pages + 1):
                collection = request_mapbiomas_alerts(
                    token=token,
                    variables={
                        "page": page,
                        "limit": page_size,
                        "startDate": start_date,
                        "endDate": end_date,
                        "dateType": date_type,
                        "sources": sources,
                        "boundingBox": bbox,
                        "sortField": sort_field,
                        "sortDirection": sort_direction,
                    },
                )

                for alert in collection:
                    feature = build_mapbiomas_feature(alert)
                    if feature:
                        features.append(feature)

                if len(collection) < page_size:
                    break

            return features

        try:
            features = collect_features(force_refresh=False)
        except MapbiomasAuthError:
            MAPBIOMAS_TOKEN_CACHE.clear()
            features = collect_features(force_refresh=True)

        payload = {
            "type": "FeatureCollection",
            "features": features,
        }
        set_cached_entry(
            MAPBIOMAS_RESPONSE_CACHE,
            cache_key,
            ttl_seconds=MAPBIOMAS_RESPONSE_CACHE_TTL_SECONDS,
            max_entries=MAPBIOMAS_RESPONSE_CACHE_MAX_ENTRIES,
            payload=payload,
        )
        return build_response(
            json.dumps(payload),
            status=200,
            content_type="application/json",
            extra_headers={"X-Proxy-Cache": "miss"},
        )
    except ValueError:
        return {"erro": "Parametros numericos invalidos para a consulta do MapBiomas."}, 400
    except MapbiomasApiError as error:
        current_app.logger.warning("Falha ao consultar o MapBiomas Alerta: %s", error)
        return {"erro": str(error)}, 502
    except Exception as error:
        current_app.logger.exception("Erro inesperado ao consultar o MapBiomas Alerta.")
        return {"erro": str(error)}, 500
