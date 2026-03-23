// totpDebug.js
// Run with: node totpDebug.js

const otplib = require('otplib');
const secret = process.argv[2] || 'JBSWY3DPEHPK3PXP';
const digits = 4;
otplib.totp.options = { digits, step: 30, algorithm: 'SHA1' };
const timeWindow = Math.floor(Date.now() / 1000 / 30);
const timestamp = Date.now();
const code = otplib.totp.generate(secret);
console.log('TOTP DEBUG:', { secret, timeWindow, timestamp, code });
