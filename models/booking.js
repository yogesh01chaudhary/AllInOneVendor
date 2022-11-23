const User = require("./user");
const { Schema, model } = require("mongoose");
const BookingSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: User,
    required: true,
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: "service",
  },
  item: {
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "service",
      required: true,
    },
    description: {
      type: String,
    },
    rating: {
      type: Number,
      default: 5,
    },
    price: {
      type: Number,
    },
  },
  total: {
    type: Number,
  },
  timeSlot: {
    start: {
      type: String,
    },
    end: {
      type: String,
    },
    bookingDate: {
      type: String,
    },
  },
  vendor: {
    type: Schema.Types.ObjectId,
    ref: "Vendor",
  },
  startTime: {
    type: String,
  },
  endTime: {
    type: String,
  },
  bookingStatus: {
    type: String,
    enum: ["Confirmed", "Pending", "Cancelled", "Completed"],
    default: "Pending",
  },
  payby: {
    type: String,
    enum: ["online", "cash"],
  },
  paid: {
    type: Boolean,
    default: false,
  },
  transactionId: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ["Failed", "Successful", "Pending"],
    default: "Pending",
  },
});
module.exports = model("booking", BookingSchema);
