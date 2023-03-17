import { NextFunction, Request, Response } from 'express';
import { AsyncFunction } from './interfaces';

module.exports = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err: any) => next(err));
  };
};
