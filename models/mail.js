const { Schema, model } = require("mongoose");
const mailSchema = new Schema({
  OTP: {
    type: Number,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    expires: `${process.env.MAIL_OTP_EXPIRY}`,
    default: Date.now,
  },
});
module.exports = model("mail", mailSchema);
