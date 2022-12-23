const { Schema, model } = require("mongoose");
const mailSchema = new Schema({
  OTP: {
    type: Number,
    required: true,
  },
  email: {
    type: String,
    required: true,
    // unique:true,
  },
  createdAt: { type: Date, expires: "2m", default: Date.now },
});
module.exports = model("mail", mailSchema);
