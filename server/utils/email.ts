import { EmailOptions } from './interfaces';
import { SentMessageInfo } from 'nodemailer';
import Mail from 'nodemailer/lib/mailer/index';

const nodemailer = require('nodemailer');

const sendEmail = async (options: EmailOptions): Promise<SentMessageInfo> => {
  // 1. Create transporter
  const transporter: Mail = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Activate in gmail 'less secure app' option
  });

  // 2. Define email options
  const mailOptions = {
    from: 'Sanya <test@gmail.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html: options.message,
  };

  // 3. Actually send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
