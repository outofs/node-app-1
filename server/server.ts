const dotenv = require('dotenv');
const mongoose = require('mongoose');

process.on('uncaughtException', (err: any) => {
  console.log('Uncaught exception! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE!.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD!
);

mongoose.connect(DB).then(() => {
  console.log('DB connection successful!');
});

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  console.log(`Server runs at port ${port}`);
});

process.on('unhandledRejection', (err: any) => {
  console.log(err.name, err.message);
  console.log('Unhandled rejection! Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});
