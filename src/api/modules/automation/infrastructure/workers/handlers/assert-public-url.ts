import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF guard for tenant-configured outbound HTTP (http_request step).
 * Rejects non-http(s) schemes and any host that resolves to a private,
 * loopback, link-local, or otherwise non-public address — so a tenant cannot
 * point an automation at cloud metadata (169.254.169.254) or internal services.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid url: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`unsupported url scheme: ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  // Resolve hostnames to their addresses; literal IPs are checked directly.
  const addresses: string[] = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);

  for (const addr of addresses) {
    if (isBlockedAddress(addr)) {
      throw new Error(`url resolves to a non-public address: ${addr}`);
    }
  }

  return url;
}

function isBlockedAddress(addr: string): boolean {
  const v = isIP(addr);
  if (v === 4) return isBlockedIPv4(addr);
  if (v === 6) return isBlockedIPv6(addr.toLowerCase());
  return true; // unknown form -> block
}

function isBlockedIPv4(addr: string): boolean {
  const p = addr.split('.').map(Number);
  if (
    p.length !== 4 ||
    p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return true;
  }
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedIPv6(addr: string): boolean {
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  if (addr.startsWith('fe80')) return true; // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique local
  // IPv4-mapped (::ffff:a.b.c.d)
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}
