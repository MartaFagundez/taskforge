import type { RequestHandler } from 'express';

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return function (req, res, next) {
    const result = fn(req, res, next);
    return Promise.resolve(result).catch(next);
  };
}
