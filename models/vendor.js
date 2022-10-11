const { Schema, model } = require("mongoose");
const vendorSchema = new Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  gender: {
    type: String,
  },
  phone: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  DOB: {
    type: String,
  },
  address: {
    type: String,
  },
  city: {
    type: String,
  },
  pin: {
    type: Number,
  },
  requestStatus: {
    type: String,
    default: "pending",
  },
});
exports.Vendor = model("vendor", vendorSchema);
