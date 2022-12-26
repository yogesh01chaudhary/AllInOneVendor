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
    expires: "5m",
    default: Date.now,
  },
});
module.exports = model("mail", mailSchema);
