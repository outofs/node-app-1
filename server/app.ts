const express = require('express');
import { NextFunction, Request, Response } from 'express';
const helmet = require('helmet');
const morgan = require('morgan');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const userRouter = require('./routes/userRoutes');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

///////////////////////////////GLOBAL MIDDLEWARES///////////////////////////////
// Set security HTTP header
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit request from same IP
const limiter = rateLimit({
  max: 100, // allows sending only 100 requests from the same ip
  windowMs: 60 * 60 * 1000, // per 1 hour
  message: 'Too many requests from this IP, please try again in a hour!',
});
app.use('/api', limiter); // limiter is available for all requests which starts with /api

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Serving static files
app.use(express.static(`${__dirname}/public`));

app.get('/api', (req: any, res: any) => {
  res.status(200).json({ users: ['user1', 'user2', 'user3', 'user4'] });
});

///////////////////////////////ROUTES///////////////////////////////
app.use('/api/users', userRouter);

/// this middleware will runs if neither of routes above were reached
app.use('*', (req: Request, res: Response, next: NextFunction) => {
  // res.status(404).json({
  //   status: 'fail',
  //   message: `Cant find ${req.originalUrl} `,
  // });
  next(new AppError(`Cant find ${req.originalUrl} `, 404));
});

app.use(globalErrorHandler);

module.exports = app;
