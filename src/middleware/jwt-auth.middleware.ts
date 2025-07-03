import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHmac } from 'node:crypto';

interface JwtPayload {
  user: { id: string };
  exp: number;
}

function verifyJwt(token: string, secret: string): JwtPayload {
  const [headerB64, payloadB64, signature] = token.split('.');
  if (!headerB64 || !payloadB64 || !signature) {
    throw new Error('Malformed token');
  }
  const data = `${headerB64}.${payloadB64}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  if (expected !== signature) {
    throw new Error('Invalid signature');
  }
  const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
  return JSON.parse(payloadJson) as JwtPayload;
}

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token de autenticación faltante' });
    }
    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || '';
    if (!secret) {
      return res.status(500).json({ message: 'Configuración de token inválida' });
    }
    try {
      const payload = verifyJwt(token, secret) as {
        user: { id: string };
        exp: number;
      };
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return res.status(401).json({ message: 'Token expirado' });
      }
      (req as { user?: { id: string } }).user = payload.user;
      next();
    } catch {
      return res.status(401).json({ message: 'Token inválido' });
    }
  }
}
