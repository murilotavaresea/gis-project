function getWindowLocation() {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }

  return window.location;
}

export function canUseProxy(useProxy, proxyBaseUrl) {
  return useProxy !== false && Boolean(proxyBaseUrl);
}

export function canRequestExternalUrlDirectly(targetUrl) {
  if (!targetUrl) {
    return false;
  }

  try {
    const location = getWindowLocation();
    const baseHref = location?.href || "http://localhost";
    const currentProtocol = location?.protocol || "http:";
    const resolvedUrl = new URL(targetUrl, baseHref);

    if (!["http:", "https:"].includes(resolvedUrl.protocol)) {
      return false;
    }

    if (currentProtocol === "https:" && resolvedUrl.protocol === "http:") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function shouldStartWithProxy({ targetUrl, useProxy = true, proxyBaseUrl }) {
  if (!canUseProxy(useProxy, proxyBaseUrl)) {
    return false;
  }

  if (useProxy === "always") {
    return true;
  }

  return !canRequestExternalUrlDirectly(targetUrl);
}

export function buildRequestModes({
  preferProxy = false,
  useProxy = true,
  proxyBaseUrl,
}) {
  if (!canUseProxy(useProxy, proxyBaseUrl)) {
    return [false];
  }

  if (preferProxy || useProxy === "always") {
    return [true];
  }

  return [false, true];
}

export function buildExternalRequestUrl({
  targetUrl,
  queryString = "",
  proxyBaseUrl,
  useProxy = false,
}) {
  const sanitizedQuery = String(queryString || "").replace(/^\?/, "");

  if (useProxy && proxyBaseUrl) {
    const baseQuery = `base=${encodeURIComponent(targetUrl || "")}`;
    return sanitizedQuery
      ? `${proxyBaseUrl}?${baseQuery}&${sanitizedQuery}`
      : `${proxyBaseUrl}?${baseQuery}`;
  }

  if (!sanitizedQuery) {
    return targetUrl;
  }

  const separator = String(targetUrl || "").includes("?") ? "&" : "?";
  return `${targetUrl}${separator}${sanitizedQuery}`;
}
