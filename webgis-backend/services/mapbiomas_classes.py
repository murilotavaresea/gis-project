# MapBiomas Brasil Coleção 10.1 — Legenda oficial de classes LULC
# Referência: https://brasil.mapbiomas.org/colecoes-mapbiomas/
# Abrangência temporal: 1985–2024

# Grupos de nível 1 (usados para agrupamento e totalização)
GRUPOS_LULC = {
    1:  {"nome": "Floresta",                        "cor": "#1f8d49"},
    10: {"nome": "Formação Natural não Florestal",  "cor": "#d6bc74"},
    14: {"nome": "Agropecuária",                    "cor": "#edde8e"},
    22: {"nome": "Área não Vegetada",               "cor": "#d4271e"},
    26: {"nome": "Corpo D'água",                    "cor": "#2532e4"},
    27: {"nome": "Não Observado",                   "cor": "#d3d3d3"},
}

# Classes nível 2–3 — valores que aparecem no pixel do raster LULC
CLASSES_LULC = {
    # ── Floresta (parent 1) ──────────────────────────────────────────
    3:  {"nome": "Formação Florestal",              "cor": "#1f8d49", "nivel": 2, "parent": 1},
    4:  {"nome": "Formação Savânica",               "cor": "#7dc975", "nivel": 2, "parent": 1},
    5:  {"nome": "Mangue",                          "cor": "#04381d", "nivel": 2, "parent": 1},
    6:  {"nome": "Floresta Alagável",               "cor": "#026975", "nivel": 2, "parent": 1},
    49: {"nome": "Restinga Arborizada",             "cor": "#02d659", "nivel": 2, "parent": 1},
    # ── Formação Natural não Florestal (parent 10) ───────────────────
    11: {"nome": "Área Úmida Natural",              "cor": "#519799", "nivel": 2, "parent": 10},
    12: {"nome": "Formação Campestre",              "cor": "#d6bc74", "nivel": 2, "parent": 10},
    29: {"nome": "Afloramento Rochoso",             "cor": "#8a646b", "nivel": 2, "parent": 10},
    32: {"nome": "Apicum",                          "cor": "#ad5100", "nivel": 2, "parent": 10},
    50: {"nome": "Restinga Herbácea",               "cor": "#ff8c02", "nivel": 2, "parent": 10},
    13: {"nome": "Outras Formações não Florestais", "cor": "#d89f5c", "nivel": 2, "parent": 10},
    # ── Agropecuária (parent 14) ─────────────────────────────────────
    15: {"nome": "Pastagem",                        "cor": "#edde8e", "nivel": 2, "parent": 14},
    39: {"nome": "Soja",                            "cor": "#c27ba0", "nivel": 3, "parent": 19},
    20: {"nome": "Cana-de-Açúcar",                  "cor": "#f54ca9", "nivel": 3, "parent": 19},
    40: {"nome": "Arroz Irrigado",                  "cor": "#d082de", "nivel": 3, "parent": 19},
    62: {"nome": "Algodão",                         "cor": "#ed0082", "nivel": 3, "parent": 19},
    41: {"nome": "Outras Lavouras Temporárias",     "cor": "#f09dce", "nivel": 3, "parent": 19},
    46: {"nome": "Café",                            "cor": "#c59ff4", "nivel": 3, "parent": 36},
    47: {"nome": "Citrus",                          "cor": "#b6b5df", "nivel": 3, "parent": 36},
    35: {"nome": "Dendê (Palma de Óleo)",           "cor": "#ff73ed", "nivel": 3, "parent": 36},
    48: {"nome": "Outras Lavouras Perenes",         "cor": "#e77fa0", "nivel": 3, "parent": 36},
    9:  {"nome": "Silvicultura",                    "cor": "#7a5900", "nivel": 2, "parent": 14},
    21: {"nome": "Mosaico de Usos",                 "cor": "#ffefc3", "nivel": 2, "parent": 14},
    # ── Área não Vegetada (parent 22) ───────────────────────────────
    23: {"nome": "Praia, Duna e Areal",             "cor": "#dd7e6b", "nivel": 2, "parent": 22},
    24: {"nome": "Área Urbanizada",                 "cor": "#d4271e", "nivel": 2, "parent": 22},
    30: {"nome": "Mineração",                       "cor": "#9c0027", "nivel": 2, "parent": 22},
    25: {"nome": "Outras Áreas não Vegetadas",      "cor": "#eb4e1b", "nivel": 2, "parent": 22},
    # ── Corpo D'água (parent 26) ─────────────────────────────────────
    33: {"nome": "Rio, Lago e Oceano",              "cor": "#2532e4", "nivel": 2, "parent": 26},
    31: {"nome": "Aquicultura",                     "cor": "#091077", "nivel": 2, "parent": 26},
    # ── Não Observado ────────────────────────────────────────────────
    27: {"nome": "Não Observado",                   "cor": "#d3d3d3", "nivel": 1, "parent": None},
}

# Produto MapBiomas Pastagem — qualidade/degradação
# Pixel values: 1 = sem degradação, 2 = intermediária, 3 = severa (0 = fora de pastagem)
# ATENÇÃO: URL do COG desta coleção precisa ser validada antes do uso em produção
CLASSES_PASTAGEM = {
    1: {"nome": "Sem degradação",          "cor": "#92d050", "nivel": 1, "parent": None},
    2: {"nome": "Degradação intermediária","cor": "#ffca28", "nivel": 1, "parent": None},
    3: {"nome": "Degradação severa",       "cor": "#e53935", "nivel": 1, "parent": None},
}

# Produto MapBiomas Agricultura — culturas mapeadas
# Reutiliza os mesmos IDs do LULC (subconjunto agrícola)
# ATENÇÃO: URL do COG desta coleção precisa ser validada antes do uso em produção
CLASSES_AGRICULTURA = {
    39: {"nome": "Soja",                        "cor": "#c27ba0", "nivel": 1, "parent": None},
    20: {"nome": "Cana-de-Açúcar",              "cor": "#f54ca9", "nivel": 1, "parent": None},
    40: {"nome": "Arroz Irrigado",              "cor": "#d082de", "nivel": 1, "parent": None},
    62: {"nome": "Algodão",                     "cor": "#ed0082", "nivel": 1, "parent": None},
    41: {"nome": "Outras Lavouras Temporárias", "cor": "#f09dce", "nivel": 1, "parent": None},
    46: {"nome": "Café",                        "cor": "#c59ff4", "nivel": 1, "parent": None},
    47: {"nome": "Citrus",                      "cor": "#b6b5df", "nivel": 1, "parent": None},
    35: {"nome": "Dendê (Palma de Óleo)",       "cor": "#ff73ed", "nivel": 1, "parent": None},
    48: {"nome": "Outras Lavouras Perenes",     "cor": "#e77fa0", "nivel": 1, "parent": None},
    15: {"nome": "Pastagem",                    "cor": "#edde8e", "nivel": 1, "parent": None},
}

COLECOES_DISPONIVEIS = ("lulc", "pastagem", "agricultura")


def get_classes(colecao: str) -> dict:
    mapa = {
        "lulc": CLASSES_LULC,
        "pastagem": CLASSES_PASTAGEM,
        "agricultura": CLASSES_AGRICULTURA,
    }
    return mapa.get(colecao, {})
