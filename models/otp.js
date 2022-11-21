const { Schema, model } = require("mongoose");
const OTPSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "booking",
      required: true,
    },
    otpDetails: {
      type: String,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    otp: {
      type: Number,
    },
    expiredAt: {
      type: Date,
    },
    verified: {
      type: Boolean,
      default:false
    },
  },
  {
    timestamps: true,
  }
);
module.exports = model("otp", OTPSchema);
