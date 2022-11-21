const { Schema, model } = require("mongoose");
const UserSchema = new Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  dateOfBirth: {
    type: String,
  },
  gender: {
    type: String,
  },
  city: {
    type: String,
  },
  pincode: {
    type: Number,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: Array,
    },
  },
});

UserSchema.index({ location: "2dsphere" });
module.exports = model("user", UserSchema);
