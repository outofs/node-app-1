import { strict } from 'assert';
import { Request, Response, NextFunction } from 'express';
import { ProtectedUserRequest, UserDoc } from '../utils/interfaces';
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await User.find();

  /// Sending response
  res.status(200).json({
    status: 'succcess',
    results: users.length,
    data: { users: users },
  });
});

exports.getUserById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1) Create error if user POSTs password data
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError('No user found with that id', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { user: user },
    });
  }
);

exports.updateMe = catchAsync(
  async (req: ProtectedUserRequest, res: Response, next: NextFunction) => {
    if (req.body.password || req.body.passwordConfirm) {
      return next(
        new AppError(
          'You cannot update ypur password here. Please, use /updatePassword.',
          400
        )
      );
    }

    // 2) Update user document
    const user: UserDoc = await User.findById(req.user!.id);

    const { name, email } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;

    await user.save({ validateModifiedOnly: true });

    res.status(200).json({
      status: 'success',
      data: { user: user },
    });
  }
);

exports.deleteMe = catchAsync(
  async (req: ProtectedUserRequest, res: Response, next: NextFunction) => {
    const user: UserDoc = await User.findById(req.user!.id).select('+password');

    if (!(await user.correctPassword!(req.body.password, user.password))) {
      return next(new AppError('Your current password is wrong', 401));
    }

    await User.findByIdAndUpdate(req.user?.id, { active: false });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  }
);
