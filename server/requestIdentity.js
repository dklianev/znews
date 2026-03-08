import { createHash } from 'crypto';
import { isIP } from 'node:net';

export function stripPortFromIpMaybe(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';

  raw = raw.replace(/^['"]+|['"]+$/g, '').trim();

  if (raw.includes(',')) raw = raw.split(',')[0].trim();

  raw = raw.replace(/^for=/i, '').trim();
  raw = raw.replace(/^['"]+|['"]+$/g, '').trim();

  const bracketMatch = raw.match(/^\[(.+)\](?::\d+)?$/);
  if (bracketMatch) raw = bracketMatch[1];

  const ipv4Port = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4Port) raw = ipv4Port[1];

  if (!isIP(raw) && /:\d+$/.test(raw)) {
    const idx = raw.lastIndexOf(':');
    const head = raw.slice(0, idx);
    if (isIP(head)) raw = head;
  }

  if (!isIP(raw) && raw.includes('%')) {
    const noZone = raw.split('%')[0];
    if (isIP(noZone)) raw = noZone;
  }

  return raw;
}

export function getTrustedClientIp(req) {
  const directHeaders = [
    'cf-connecting-ip',
    'x-real-ip',
    'x-client-ip',
    'true-client-ip',
    'x-arr-clientip',
  ];
  for (const headerName of directHeaders) {
    const headerValue = req.headers?.[headerName];
    if (typeof headerValue !== 'string' || !headerValue.trim()) continue;
    const parsed = stripPortFromIpMaybe(headerValue);
    if (isIP(parsed)) return parsed;
  }

  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const fromXff = stripPortFromIpMaybe(xff);
    if (isIP(fromXff)) return fromXff;
  }

  const forwarded = req.headers?.forwarded;
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const entries = forwarded.split(',').map((item) => item.trim()).filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split(';').map((item) => item.trim());
      const forPart = parts.find((item) => item.toLowerCase().startsWith('for='));
      if (!forPart) continue;
      const parsed = stripPortFromIpMaybe(forPart);
      if (isIP(parsed)) return parsed;
    }
  }

  const fromReqIp = stripPortFromIpMaybe(req.ip);
  if (isIP(fromReqIp)) return fromReqIp;

  const fromSocket = stripPortFromIpMaybe(req.socket?.remoteAddress);
  if (isIP(fromSocket)) return fromSocket;

  return fromReqIp || fromSocket || 'unknown';
}

export function getClientUserAgent(req) {
  const ua = typeof req.headers?.['user-agent'] === 'string'
    ? req.headers['user-agent']
    : '';
  return ua.trim().slice(0, 300) || 'unknown';
}

export function hashTrustedClientFingerprint(req, scope = '') {
  const ip = getTrustedClientIp(req);
  const ua = getClientUserAgent(req);
  return createHash('sha256')
    .update(`${scope}|${ip}|${ua}`)
    .digest('hex');
}
