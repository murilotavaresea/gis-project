function normalizeBaseUrl(url) {
  if (!url) {
    return "";
  }

  return url.replace(/\/+$/, "");
}

const API_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000"
);

const GEOSERVER_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_GEOSERVER_BASE_URL || ""
);

const config = {
  API_BASE_URL,
  GEOSERVER_BASE_URL,
  EXTERNAL_LAYERS_URL: `${API_BASE_URL}/camadas_externas`,
  PROXY_WFS_BASE_URL: `${API_BASE_URL}/proxy/wfs`,
  GENERATE_AREA_URL: `${API_BASE_URL}/gerar-area-beneficiavel`,
};

export default config;
