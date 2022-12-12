const { Schema, model } = require("mongoose");

//SlotSchema
var SlotSchema = new Schema(
  {
    start: String,
    end: String,
    bookingDate: String,
    booked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

//LeaveSchema
var LeaveSchema = new Schema(
  {
    date: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Disapproved", "Applied"],
      default: "Pending",
    },
  },
  { _id: false }
);

//EmergencyLeaveSchema
var EmergencyLeaveSchema = new Schema(
  {
    date: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Disapproved", "Applied"],
      default: "Pending",
    },
  },
  { _id: false }
);

//BookingDutySchema
var BookingDutySchema = new Schema({
  bookingId: {
    type: Schema.Types.ObjectId,
  },
  startTime: {
    type: String,
  },
  endTime: {
    type: String,
  },
});

//OnDutySchema
var onDutySchema = new Schema(
  {
    loginTime: String,
    logoutTime: String,
    date: String,
  },
  { _id: false }
);

//ReviewSchema
var ReviewSchema = new Schema(
  {
    name: { type: String },
    rating: { type: Number },
    comment: { type: String },
    user: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "user",
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

//VendorSchema
const VendorSchema = new Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    DOB: {
      type: String,
    },
    workExperience: {
      type: String,
    },
    gender: {
      type: String,
    },
    mobileNumber: {
      type: String,
      unique: true,
    },
    alternateNumber: {
      type: String,
    },
    emergencyNumber: {
      type: String,
    },
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    deviceToken: {
      type: String,
    },
    currentAddress: {
      address: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      pin: {
        type: Number,
      },
    },
    permanentAddress: {
      address: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      pin: {
        type: Number,
      },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
    imageUrl: {
      type: String,
    },
    verification: {
      aadharFront: {
        type: String,
      },
      aadharBack: {
        type: String,
      },

      selfie1: {
        type: String,
      },
      selfie2: {
        type: String,
      },
      pancard: {
        type: String,
      },
    },
    bankDetails: {
      bankName: {
        type: String,
      },
      accountNumber: {
        type: Number,
      },
      accountHolder: {
        type: String,
      },
      ifscCode: {
        type: String,
      },
      upi: {
        type: String,
      },
    },
    requestStatus: {
      type: String,
      default: "pending",
    },
    requestedService: [
      {
        type: String,
      },
    ],
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: "service",
      },
    ],
    transferredBookings: [
      {
        type: Schema.Types.ObjectId,
        ref: "service",
      },
    ],
    transferCount: {
      type: Schema.Types.ObjectId,
      ref: "transferCount",
    },
    bookings: [BookingDutySchema],
    timeSlot: [SlotSchema],
    onLeave: [LeaveSchema],
    emergencyLeave: [EmergencyLeaveSchema],
    onDuty: [onDutySchema],
    onDutyStatus: { type: Boolean, enum: [true, false], default: false },
    reviews: [ReviewSchema],
    rating: { type: Number, default: 0 },
    reviewNumber: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// VendorSchema.pre("save", async function (next) {
//   const loc = await geocoder.geocode(this.address);
//   this.location = {
//     type: "Point",
//     coordinates: [loc[0].longitude, loc[0].latitude],
//     formattedAddress: loc[0].formattedAddress,
//   };
//   next();
// });

VendorSchema.index({ location: "2dsphere" });

exports.Vendor = model("vendor", VendorSchema);
