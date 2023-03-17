import { NextFunction, Request, Response } from 'express';
import { Schema, model } from 'mongoose';
import { UserDoc } from '../utils/interfaces';

const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

const subtractSeconds = require('../utils/subtractSeconds');

const userSchema = new Schema<UserDoc>({
  name: { type: String, required: [true, 'Please tell us your name'] },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    // validate: [validator.isEmail, 'Please provide a valid email'],
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    select: false,
  },
  passwordChangedAt: { type: Date },
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre<UserDoc>(
  'save',
  async function (this: UserDoc, next: (err?: Error) => void) {
    // Only run this function if password was actualy modified
    if (!this.isModified('password')) return next();

    // If not, runs scrypt that encrypt password
    this.password = await bcrypt.hash(this.password, 12);

    this.passwordChangedAt = subtractSeconds(new Date(), 1);

    // Delete passwordConfirm field
    this.passwordConfirm = undefined;
    next();
  }
);

userSchema.pre(/^find/, function (next: (err?: Error) => void) {
  // this. points to current query
  this.find({ active: { $ne: false } });
  next();
});

userSchema.method(
  'correctPassword',
  async function (candidatePassword: string, userPassword: string) {
    return await bcrypt.compare(candidatePassword, userPassword);
  }
);

userSchema.method(
  'changedPasswordAfter',
  function (this: UserDoc, JWTTimestamp: number) {
    if (this.passwordChangedAt) {
      const changeTimestamp = parseInt(
        String(this.passwordChangedAt.getTime() / 1000),
        10
      );
      // console.log(changeTimestamp, JWTTimestamp);
      return JWTTimestamp < changeTimestamp;
    }

    /// False means NOT changed
    return false;
  }
);

userSchema.method('createPasswordResetToken', function (this: UserDoc) {
  const resetToken: string = crypto.randomBytes(32).toString('hex');

  /// Encrypted resetToken send to user document
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  /// Plain text format resetToken will be sent to user email
  return resetToken;
});

const User = model<UserDoc>('User', userSchema);

module.exports = User;
