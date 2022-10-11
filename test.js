"use strict";
const nodemailer = require("nodemailer");

exports.sendMail = async () => {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: "chaudharyyogesh382@gmail.com",
        pass: "hbdcvlhdtozwzmta",
      },
    });
    let info = await transporter.sendMail({
      from: "chaudharyyogesh382@gmail.com",
      to: "yogesh01chaudhary@gmail.com",
      subject: "Hello ✔",
      text: `Hello world? your password is ${password}`,
      html: `Hi your password is ${password}`,
    });
    console.log("Message sent: %s", info.messageId);
  } catch (e) {
    console.log("error", e);
  }
};

const alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const integers = "0123456789";
const exCharacters = "!@#$%^&*_-=+";
exports.createPassword = (length, hasNumbers, hasSymbols) => {
  let chars = alpha;
  if (hasNumbers) {
    chars += integers;
  }
  if (hasSymbols) {
    chars += exCharacters;
  }
  return generatePassword(length, chars);
};
const generatePassword = (length, chars) => {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// let password = createPassword(6, true, true);
// console.log(password);
// checkMail();
