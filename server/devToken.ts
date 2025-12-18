import crypto from 'crypto';
import type { Request } from 'express';

const SECRET = process.env.SESSION_SECRET || 'dev-secret';

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export type DevUserPayload = {
  id: string;
  email?: string;
  isAdmin?: boolean;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  ts: number;
};

export function signDevToken(payload: Omit<DevUserPayload, 'ts'>): string {
  const body: DevUserPayload = { ...payload, ts: Date.now() } as DevUserPayload;
  const json = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', SECRET).update(json).digest();
  return `${b64url(json)}.${b64url(sig)}`;
}

export function verifyDevToken(token: string): DevUserPayload | null {
  try {
    const [dataB64, sigB64] = token.split('.') as [string, string];
    if (!dataB64 || !sigB64) return null;
    const json = Buffer.from(dataB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const expectedSig = crypto.createHmac('sha256', SECRET).update(json).digest();
    const actualSig = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;
    const parsed = JSON.parse(json);
    return parsed as DevUserPayload;
  } catch {
    return null;
  }
}

export function getDevTokenFromReq(req: Request): string | null {
  const h = req.headers['authorization'];
  if (!h) return null;
  const parts = String(h).split(' ');
  if (parts.length !== 2) return null;
  const scheme = parts[0].toLowerCase();
  const token = parts[1];
  if (scheme === 'bearer' || scheme === 'dev') return token;
  return null;
}
