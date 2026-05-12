/**
 * Generates a free Ethereal SMTP test account and prints credentials
 * to paste into your .env file.
 *
 * Usage:
 *   node scripts/generate-ethereal.mjs
 */

import nodemailer from "nodemailer";

const account = await nodemailer.createTestAccount();

console.log("\n✅  Ethereal test account created!\n");
console.log("Paste these into your .env file:\n");
console.log(`EMAIL_SERVER_HOST=${account.smtp.host}`);
console.log(`EMAIL_SERVER_PORT=${account.smtp.port}`);
console.log(`EMAIL_SERVER_USER=${account.user}`);
console.log(`EMAIL_SERVER_PASSWORD=${account.pass}`);
console.log(`EMAIL_FROM=noreply@example.com`);
console.log("\nTo read sent emails, visit: https://ethereal.email/messages");
console.log(`Log in with: ${account.user} / ${account.pass}\n`);
