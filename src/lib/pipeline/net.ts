/**
 * SSRF guard for server-side fetches of third-party feed/audio URLs. We pull
 * enclosure URLs straight from RSS, so block non-http(s) schemes and obvious
 * private/loopback/link-local/metadata hosts before fetching. (Hostnames that
 * resolve to private IPs via DNS are not caught here — a full guard would pin
 * the resolved IP; this covers the common literal-IP / localhost cases.)
 */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return true;
  }
  if (h === "::1" || h === "0.0.0.0") return true;
  // IPv4 literal ranges: loopback, private, link-local (incl. cloud metadata).
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local + 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  // IPv6 unique-local / link-local.
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) {
    return true;
  }
  return false;
}

/** Throws if the URL is unsafe to fetch server-side. Returns the parsed URL. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked non-http(s) URL scheme: ${url.protocol}`);
  }
  if (isPrivateHost(url.hostname)) {
    throw new Error(`Blocked private/internal host: ${url.hostname}`);
  }
  return url;
}
