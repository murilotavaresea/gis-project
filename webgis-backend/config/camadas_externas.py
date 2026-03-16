import json
import os

from config.camadas_externas_fallback import CAMADAS_EXTERNAS_FALLBACK


def _load_camadas_externas():
    raw_value = os.getenv("CAMADAS_EXTERNAS_JSON", "").strip()

    if not raw_value:
        return CAMADAS_EXTERNAS_FALLBACK

    try:
        data = json.loads(raw_value)
    except json.JSONDecodeError:
        return CAMADAS_EXTERNAS_FALLBACK

    if isinstance(data, list) and data:
        return data

    return CAMADAS_EXTERNAS_FALLBACK


camadas_externas = _load_camadas_externas()
