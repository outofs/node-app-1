function subtractSeconds(date: Date, seconds: number) {
  date.setSeconds(date.getSeconds() - seconds);

  return date;
}
module.exports = subtractSeconds;
