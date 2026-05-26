"""
Serviço de análise de cobertura/uso do solo via MapBiomas Coleção 10.1.

Lê COGs públicos no Google Cloud Storage via HTTP Range Request usando
rasterio + GDAL VSI. Nenhum dado é armazenado localmente.

Fontes públicas:
  https://brasil.mapbiomas.org/colecoes-mapbiomas/
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import os

import numpy as np
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

try:
    import rasterio
    import rasterio.mask
    import rasterio.warp
    _RASTERIO_OK = True
except ImportError:
    _RASTERIO_OK = False

# ── Fix: conflito de PROJ no Windows ─────────────────────────────────────────
# PostgreSQL/PostGIS no Windows sobrescreve PROJ_DATA com seu proj.db antigo
# (schema v2). pyproj também tem proj.db schema v4. Rasterio (PROJ 9.7.1)
# precisa de schema v6, mas seu proj_data fica em rasterio/proj_data/.
# Priorizamos: rasterio > pyproj > ambiente do SO.
def _fix_proj_data() -> None:
    candidates = []
    try:
        import rasterio as _rs
        candidates.append(
            os.path.join(os.path.dirname(_rs.__file__), "proj_data")
        )
    except Exception:
        pass
    try:
        import pyproj as _pp
        candidates.append(str(_pp.datadir.get_data_dir()))
    except Exception:
        pass
    for _c in candidates:
        if os.path.isfile(os.path.join(_c, "proj.db")):
            os.environ["PROJ_DATA"] = _c
            os.environ["PROJ_LIB"]  = _c
            break

_fix_proj_data()

from services.mapbiomas_classes import get_classes

logger = logging.getLogger(__name__)

# ── Intervalo de anos disponíveis na Coleção 10.1 ────────────────────────────
ANO_MINIMO = 1985
ANO_MAXIMO = 2024

# ── URLs dos COGs públicos ────────────────────────────────────────────────────
# Bucket: gs://mapbiomas-public  (público, sem autenticação)
#
# Estrutura confirmada em 2026-05-23 via listagem do bucket:
#   initiatives/brasil/collection_10/
#     ├── fire-col41/
#     ├── fire-col5/
#     └── lulc/
#               └── coverage/
#                       └── brazil_coverage_{ano}.tif  ("brazil", não "brasil")
#
# Pastagem e Agricultura NÃO estão em collection_10.
# São iniciativas separadas — buscar os paths em:
#   https://storage.googleapis.com/mapbiomas-public/?prefix=initiatives%2F&delimiter=%2F
COG_URLS = {
    "lulc": (
        "https://storage.googleapis.com/mapbiomas-public"
        "/initiatives/brasil/collection_10/lulc/coverage"
        "/brazil_coverage_{ano}.tif"
    ),
}

# URLs pendentes de localização no bucket — não habilitar sem validar o path
COG_URLS_PENDENTES = {
    "pastagem":    None,  # buscar em initiatives/pasture/ ou similar
    "agricultura": None,  # buscar em initiatives/agriculture/ ou similar
}

# ── Configuração GDAL para leitura de COG via HTTP ───────────────────────────
_GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_LIST",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    "VSI_CACHE": "TRUE",
    "VSI_CACHE_SIZE": "10000000",       # 10 MB de cache local por processo
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MULTIPLEX": "YES",
    "GDAL_HTTP_VERSION": "2",
    "GDAL_HTTP_CONNECTTIMEOUT": "30",
    "GDAL_HTTP_TIMEOUT": "60",
}

MAX_WORKERS = 4
# Resolução padrão MapBiomas: 30 m × 30 m = 900 m² = 0,09 ha/pixel
_PIXEL_AREA_HA_30M = 0.09


# ── Normalização de geometria ─────────────────────────────────────────────────

def _extrair_geometria(geojson: dict) -> dict:
    """Retorna um dict de geometria GeoJSON (Polygon/MultiPolygon) a partir de
    qualquer entrada válida: Feature, FeatureCollection ou Geometry."""
    if not geojson:
        raise ValueError("Geometria não informada.")

    gtype = geojson.get("type", "")

    if gtype == "FeatureCollection":
        features = geojson.get("features") or []
        geoms = [f["geometry"] for f in features if f.get("geometry")]
        if not geoms:
            raise ValueError("FeatureCollection sem geometrias.")
        if len(geoms) == 1:
            return geoms[0]
        union = unary_union([shape(g) for g in geoms])
        return mapping(union)

    if gtype == "Feature":
        geom = geojson.get("geometry")
        if not geom:
            raise ValueError("Feature sem geometria.")
        return geom

    if gtype in ("Polygon", "MultiPolygon", "GeometryCollection"):
        return geojson

    raise ValueError(f"Tipo de geometria não suportado: '{gtype}'.")


# ── Leitura de um único COG ───────────────────────────────────────────────────

def _calcular_pixels_cog(geom_dict: dict, url: str) -> tuple:
    """Abre um COG via HTTP Range Request e conta pixels por valor de classe.

    Returns:
        Tupla (contagem_por_classe: dict[int, int], pixel_area_ha: float)
    """
    if not _RASTERIO_OK:
        raise RuntimeError(
            "rasterio não está instalado. "
            "Execute: pip install rasterio numpy"
        )

    vsicurl = f"/vsicurl/{url}"

    with rasterio.Env(**_GDAL_ENV):
        with rasterio.open(vsicurl) as src:
            raster_crs = src.crs

            # Reprojetar geometria para o CRS do raster se necessário
            epsg = raster_crs.to_epsg()
            if epsg == 4326:
                geom_proj = geom_dict
            else:
                geom_proj = rasterio.warp.transform_geom(
                    "EPSG:4326", raster_crs, geom_dict
                )

            # Leitura apenas da janela que intersecta o bounding box (Range Request)
            out_image, out_transform = rasterio.mask.mask(
                src, [geom_proj], crop=True, nodata=0, filled=True
            )

            data = out_image[0]  # banda 1

            # Área por pixel
            if raster_crs.is_geographic:
                pixel_area_ha = _PIXEL_AREA_HA_30M
            else:
                px = abs(out_transform.a)   # tamanho em metros
                py = abs(out_transform.e)
                pixel_area_ha = (px * py) / 10_000

            # Contar pixels por classe, excluindo nodata (0)
            mask = data > 0
            if not mask.any():
                return {}, pixel_area_ha

            valores, contagens = np.unique(data[mask], return_counts=True)
            return {int(v): int(c) for v, c in zip(valores, contagens)}, pixel_area_ha


# ── Conversão de pixels → áreas ───────────────────────────────────────────────

def _montar_resultado(contagem: dict, pixel_area_ha: float, classes_dict: dict) -> dict:
    """Converte contagem bruta de pixels em estrutura com ha, % e metadados."""
    total_ha = sum(n * pixel_area_ha for n in contagem.values())

    resultado = {}
    for codigo, n_pixels in sorted(contagem.items()):
        info = classes_dict.get(codigo)
        nome = info["nome"] if info else f"Classe {codigo}"
        cor  = info["cor"]  if info else "#aaaaaa"

        ha  = n_pixels * pixel_area_ha
        pct = (ha / total_ha * 100) if total_ha > 0 else 0.0

        resultado[nome] = {
            "ha":     round(ha,  2),
            "pct":    round(pct, 2),
            "pixels": n_pixels,
            "cor":    cor,
            "codigo": codigo,
        }

    return resultado


# ── Tarefa individual (colecao × ano) ─────────────────────────────────────────

def _analisar_um(geom_dict: dict, colecao: str, ano: int):
    """Executa análise de uma coleção/ano e retorna (colecao, ano, resultado)."""
    url = COG_URLS[colecao].format(ano=ano)
    classes = get_classes(colecao)

    try:
        contagem, pixel_area_ha = _calcular_pixels_cog(geom_dict, url)
        if not contagem:
            return colecao, ano, {"aviso": "Nenhum pixel encontrado na geometria."}
        return colecao, ano, _montar_resultado(contagem, pixel_area_ha, classes)
    except Exception as exc:
        logger.warning("MapBiomas erro %s/%d: %s", colecao, ano, exc)
        return colecao, ano, {"erro": str(exc)}


# ── Área geodésica do imóvel (para metadados) ─────────────────────────────────

def _area_geodesica_ha(geom) -> float:
    """Calcula área em hectares usando o elipsóide WGS-84 (via pyproj.Geod)."""
    try:
        from pyproj import Geod
        geod = Geod(ellps="WGS84")
        area_m2, _ = geod.geometry_area_perimeter(geom)
        return round(abs(area_m2) / 10_000, 2)
    except Exception:
        # Fallback muito aproximado apenas para latitudes tropicais
        return round(abs(geom.area) * 1_200_000, 2)


# ── Helpers de cor ───────────────────────────────────────────────────────────

def _hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# ── Geração de PNG colorido ───────────────────────────────────────────────────

def gerar_mapa_png(geom_geojson: dict, ano: int, colecao: str) -> dict:
    """Gera PNG RGBA da cobertura MapBiomas recortado na geometria.

    Returns:
        Dict com: png_base64, largura_px, altura_px, bounds {north/south/east/west}.
    """
    import base64
    from rasterio.io import MemoryFile

    if not _RASTERIO_OK:
        raise RuntimeError("rasterio não instalado.")

    geom_dict = _extrair_geometria(geom_geojson)
    url = COG_URLS[colecao].format(ano=ano)
    classes = get_classes(colecao)
    vsicurl = f"/vsicurl/{url}"

    with rasterio.Env(**_GDAL_ENV):
        with rasterio.open(vsicurl) as src:
            raster_crs = src.crs
            epsg = raster_crs.to_epsg()
            geom_proj = (
                geom_dict if epsg == 4326
                else rasterio.warp.transform_geom("EPSG:4326", raster_crs, geom_dict)
            )

            out_image, out_transform = rasterio.mask.mask(
                src, [geom_proj], crop=True, nodata=0, filled=True
            )
            data = out_image[0]
            h, w = data.shape

            # Monta RGBA — nodata (0) fica transparente
            rgba = np.zeros((h, w, 4), dtype=np.uint8)
            for codigo, info in classes.items():
                mask_px = data == int(codigo)
                if mask_px.any():
                    r, g, b = _hex_to_rgb(info["cor"])
                    rgba[mask_px] = [r, g, b, 255]

            with MemoryFile() as memfile:
                with memfile.open(driver="PNG", height=h, width=w, count=4, dtype="uint8") as dst:
                    dst.write(rgba.transpose(2, 0, 1))
                png_bytes = memfile.read()

            png_b64 = base64.b64encode(png_bytes).decode()

            # Bounds em WGS-84
            minx = out_transform.c
            maxy = out_transform.f
            maxx = minx + out_transform.a * w
            miny = maxy + out_transform.e * h
            if epsg != 4326:
                from rasterio.warp import transform_bounds as _tb
                minx, miny, maxx, maxy = _tb(raster_crs, "EPSG:4326", minx, miny, maxx, maxy)

            return {
                "png_base64": png_b64,
                "largura_px": int(w),
                "altura_px":  int(h),
                "bounds": {"west": minx, "south": miny, "east": maxx, "north": maxy},
            }


# ── Entry-point público ───────────────────────────────────────────────────────

def analisar_cobertura(geom_geojson: dict, anos: list, colecoes: list) -> dict:
    """Analisa cobertura/uso do solo para uma geometria via MapBiomas COGs.

    Args:
        geom_geojson: GeoJSON (Feature, FeatureCollection ou Geometry) em EPSG:4326.
        anos:         Lista de anos inteiros (1985–2024).
        colecoes:     Lista de coleções: "lulc", "pastagem", "agricultura".

    Returns:
        Dict com resultados por coleção/ano e bloco "meta".
    """
    t_inicio = time.time()

    geom_dict = _extrair_geometria(geom_geojson)

    # Separar coleções com URL configurada das pendentes
    pendentes = [c for c in colecoes if c in COG_URLS_PENDENTES]
    colecoes  = [c for c in colecoes if c in COG_URLS]
    anos      = [a for a in anos if ANO_MINIMO <= int(a) <= ANO_MAXIMO]

    if pendentes and not colecoes:
        raise ValueError(
            f"As coleções {pendentes} ainda não têm URL configurada. "
            "Localize o path no bucket GCS e atualize COG_URLS em mapbiomas_service.py."
        )

    if not colecoes:
        raise ValueError(
            f"Nenhuma coleção válida. Disponíveis: {list(COG_URLS.keys())}"
        )
    if not anos:
        raise ValueError(
            f"Anos fora do intervalo {ANO_MINIMO}–{ANO_MAXIMO}."
        )

    area_total_ha = _area_geodesica_ha(shape(geom_dict))
    tarefas = [(geom_dict, col, int(ano)) for col in colecoes for ano in anos]
    resultados = {c: {} for c in colecoes}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futuros = {executor.submit(_analisar_um, *t): t for t in tarefas}
        for futuro in as_completed(futuros):
            try:
                colecao, ano, resultado = futuro.result()
                resultados[colecao][str(ano)] = resultado
            except Exception as exc:
                _, col, ano = futuros[futuro]
                resultados[col][str(ano)] = {"erro": str(exc)}

    return {
        **resultados,
        "meta": {
            "area_total_ha":       area_total_ha,
            "resolucao_m":         30,
            "tempo_processamento_s": round(time.time() - t_inicio, 2),
            "anos":                sorted(anos),
            "colecoes":            colecoes,
        },
    }
