import exp from 'constants';
import { CookieOptions, NextFunction, Request, Response } from 'express';
import {
  DecodedToken,
  ProtectedUserRequest,
  UserDoc,
} from '../utils/interfaces';

const crypto = require('crypto');
const { Request, Response, NextFunction } = require('express');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const sendEmail = require('../utils/email');
const subtractSeconds = require('../utils/subtractSeconds');

const signToken = function (id: string) {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user: UserDoc, statusCode: number, res: Response) => {
  const token = signToken(user._id);

  const expiresDate = function (): number {
    if (process.env.JWT_COOKIE_EXPIRES_IN) {
      const date: number = Number(process.env.JWT_COOKIE_EXPIRES_IN);
      return Date.now() + date * 24 * 60 * 60 * 1000;
    }
    return 1;
  };

  const cookieOptions: CookieOptions = {
    expires: new Date(expiresDate()),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; // cookies send via secure connection only in production mode

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined; // to not show password in response message

  res.status(statusCode).json({
    status: 'success',
    token: token,
    data: {
      user: user,
    },
  });
};

exports.signup = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const expression: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

    if (req.body.password !== req.body.passwordConfirm) {
      return next(new AppError('Passwords are not the same!', 401));
    }

    if (!expression.test(req.body.email)) {
      return next(new AppError('Please provide a valid email!', 401));
    }

    const newUser = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
    });

    createSendToken(newUser, 201, res);
  }
);

exports.login = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    // 1) Check if email and pasword exists
    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }
    // 2) Check if user existst && password is correct
    const user: UserDoc = await User.findOne({ email: email }).select(
      '+password'
    );

    if (!user || !(await user.correctPassword!(password, user.password!))) {
      return next(new AppError('Incorrect email or password!', 401));
    }

    // 3) Check if everythimg ok, send token to client
    createSendToken(user, 200, res);
  }
);

exports.protect = catchAsync(
  async (req: ProtectedUserRequest, res: Response, next: NextFunction) => {
    // 1) Getting token and check if it's ther
    let token: string | undefined;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    // console.log(token);

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get acces', 401)
      );
    }

    // 2) Varification token
    const decoded: DecodedToken = await promisify(jwt.verify)(
      token,
      process.env.JWT_SECRET
    );
    // console.log(decoded);

    // 3) Check if user still exists
    const currentUser: UserDoc = await User.findById(decoded.id);
    // console.log(currentUser);
    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token does no longer exists!',
          401
        )
      );
    }

    // 4) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter!(decoded.iat)) {
      return next(
        new AppError(
          'User resently changed password! Please log in again!',
          401
        )
      );
    }

    // GRAND ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  }
);

exports.restrictTo = function (...roles: string[]): Function {
  return (req: ProtectedUserRequest, res: Response, next: NextFunction) => {
    // roles - is array ['admin','lead-guide']. role='user'
    // console.log(req);
    if (!roles.includes(req.user!.role!)) {
      return next(
        new AppError('You dont have permission to perform this action', 403)
      );
    }
    return next();
  };
};

exports.forgotPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Get user based on POSTed email
    const user: UserDoc = await User.findOne({ email: req.body.email });

    if (!user) {
      return next(new AppError('There is no user with email address.', 404));
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken!();

    /// WE USE .save instead of .update to validate our data via validators before updating.
    /// .update method don't use validators
    await user.save({ validateBeforeSave: false });

    // 3) Send it to user's email
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;

    const message = `Forgot your password? Submit a PATCH request with your new password and password Confirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 10min)',
        message: message,
      });
      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!',
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(
        new AppError(
          'There was an error sending the email. Try again later!',
          500
        )
      );
    }
  }
);

exports.resetPassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Get user based on the token
    const hashedToken: string = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user: UserDoc = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    // 2) If token has not expired, and there is user, set the new password
    if (!user) {
      return next(new AppError('Token is invalid or has expired!', 400));
    }

    if (req.body.password !== req.body.passwordConfirm) {
      return next(new AppError('Passwords are not the same!', 401));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = subtractSeconds(new Date(), 1);

    await user.save();

    // 3) Update changedPasswordAt property for the user

    // 4) Log the user in, send JWT
    createSendToken(user, 201, res);
  }
);

exports.updatePassword = catchAsync(
  async (req: ProtectedUserRequest, res: Response, next: NextFunction) => {
    // 1) Get user from collection
    const user: UserDoc = await User.findById(req.user!.id).select('+password');

    // 2) Check if POSTed password is correct
    if (
      !(await user.correctPassword!(req.body.passwordCurrent, user.password))
    ) {
      return next(new AppError('Your current password is wrong', 401));
    }

    // 3) If the password is correct - update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
  }
);
