import "server-only";

// =============================================================================
// Server-side geolocation for the auto-generated CV footer metadata.
// -----------------------------------------------------------------------------
// The 2D CV footer prints "បង្កើតនៅទីណា" (Created Location). Per spec this is
// AUTO-GENERATED — the user can neither pick nor edit it. Resolution strategy,
// fastest → most expensive, short-circuiting on the first hit:
//
//   1. Edge geo headers — Vercel injects x-vercel-ip-city / -country-region /
//      -country on every request at zero latency and zero cost. Preferred.
//   2. Cloudflare header — cf-ipcountry, when fronted by Cloudflare.
//   3. IP lookup API — ip-api.com (free, no key) as a last-resort fallback for
//      hosts that don't inject geo headers. Best-effort with a hard timeout;
//      any failure degrades gracefully to an empty string (the footer then
//      omits the location line rather than printing a wrong/placeholder one).
// =============================================================================

export interface GeoResult {
  /** Human label, e.g. "Phnom Penh, Cambodia" — already display-ready. */
  location: string;
  /** ISO-3166 alpha-2 country code when known. */
  country: string | null;
  /** How the value was resolved (for logging / auditing). */
  source: "vercel-headers" | "cloudflare-headers" | "ip-api" | "none";
}

const EMPTY: GeoResult = { location: "", country: null, source: "none" };

function header(headers: Headers, name: string): string {
  const v = headers.get(name);
  return v ? decodeURIComponent(v).trim() : "";
}

function firstPublicIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    for (const part of fwd.split(",")) {
      const ip = part.trim();
      if (
        ip &&
        ip !== "127.0.0.1" &&
        ip !== "::1" &&
        !ip.startsWith("10.") &&
        !ip.startsWith("192.168.") &&
        !/^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      ) {
        return ip;
      }
    }
  }
  return headers.get("x-real-ip")?.trim() || null;
}

/** Compose a "City, Region, Country" label from non-empty parts. */
function compose(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(", ");
}

/**
 * Resolve the creation location from the incoming request. Reads edge geo
 * headers synchronously; only falls through to the network on hosts that don't
 * provide them. Never throws.
 */
export async function resolveCreatedLocation(headers: Headers): Promise<GeoResult> {
  // 1. Vercel edge geo headers.
  const vCity = header(headers, "x-vercel-ip-city");
  const vRegion = header(headers, "x-vercel-ip-country-region");
  const vCountry = header(headers, "x-vercel-ip-country");
  if (vCity || vCountry) {
    return {
      location: compose(vCity, vRegion, vCountry),
      country: vCountry || null,
      source: "vercel-headers",
    };
  }

  // 2. Cloudflare country header.
  const cfCountry = header(headers, "cf-ipcountry");
  const cfCity = header(headers, "cf-ipcity");
  if (cfCountry && cfCountry !== "XX") {
    return {
      location: compose(cfCity, cfCountry),
      country: cfCountry,
      source: "cloudflare-headers",
    };
  }

  // 3. IP lookup fallback (best-effort, hard timeout, never throws).
  const ip = firstPublicIp(headers);
  if (!ip) return EMPTY;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timeout);
    if (!res.ok) return EMPTY;
    const json = (await res.json()) as {
      status?: string;
      country?: string;
      countryCode?: string;
      regionName?: string;
      city?: string;
    };
    if (json.status !== "success") return EMPTY;
    return {
      location: compose(json.city, json.regionName, json.country),
      country: json.countryCode ?? null,
      source: "ip-api",
    };
  } catch {
    return EMPTY;
  }
}
