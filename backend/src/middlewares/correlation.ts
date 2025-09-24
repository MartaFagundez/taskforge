import type { RequestHandler } from 'express';
import crypto from 'crypto';

export const correlation: RequestHandler = (req, _res, next) => {
  (req as any).cid =
    req.headers['x-correlation-id'] || crypto.randomBytes(6).toString('hex');
  next();
};
