const AppError = require('../utils/AppError');
import { NextFunction, Request, Response } from 'express';
import { AppErrorType } from '../utils/interfaces';

const handleCastErrorDB = (err: AppErrorType) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const sendErrorDev = (err: AppErrorType, res: Response) => {
  res.status(err.statusCode!).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const handleDuplicateFieldsDB = (err: AppErrorType) => {
  // const value = err.keyValue.name; // works only for duplicate field is 'name'
  //
  const value = Object.values(err.keyValue)[0];
  const message = `Duplicate field value:${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err: AppErrorType) => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please Again', 401);

const sendErrorProd = (err: AppErrorType, res: Response) => {
  //   console.log(err.isOperational);
  /// Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode!).json({
      status: err.status,
      message: err.message,
    });
  } else {
    /// Programming or other unknown error: don't leak details to client
    console.error('ERROR!');

    res.status(500).json({
      status: 'error',
      message: 'Something went wrong! Please try later.',
    });
  }
};

module.exports = (
  err: AppErrorType,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  //   err.isOperational = err.isOperational || true;

  //   console.log(err);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = Object.create(err);
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};
