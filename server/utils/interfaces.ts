import { NextFunction, Request, Response } from 'express';
import { Document } from 'mongoose';

export interface AppErrorType extends Error {
  status?: string;
  isOperational?: boolean;
  statusCode?: number;
  path?: any;
  value: any;
  keyValue?: any;
  errors?: any;
}

export interface AsyncFunction {
  (req?: Request, res?: Response, next?: NextFunction): Promise<any>;
}

// export interface CorrectPassword {
//   (candidatePassword: string, userPassword: string)=> Promise<boolean>;
// }

export interface UserDoc extends Document {
  name: string;
  email: string;
  role?: string;
  password: string | undefined;
  passwordConfirm: string | undefined;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date | number | string;
  active?: boolean;
  correctPassword?: (
    candidatePassword: string,
    userPassword: string | undefined
  ) => Promise<boolean>;
  changedPasswordAfter?: (this: UserDoc, JWTTimestamp: number) => boolean;
  createPasswordResetToken?: (this: UserDoc) => string;
}

// export interface CookieOptions {
//   expires?: Date | number | string | undefined;
//   path?: string;
//   domain?: string;
//   secure?: boolean;
// }

export interface DecodedToken {
  id: string;
  iat: number;
  exp: number;
}

export interface ProtectedUserRequest extends Request {
  user?: UserDoc;
}

export interface EmailOptions {
  email: string;
  subject: string;
  message: string;
}
