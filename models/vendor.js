const { Schema, model } = require("mongoose");
const { geocoder } = require("../helpers/geoCoder");
const TransferCount = require("./transferCount");

// var mongoose = require("mongoose");

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
var LeaveSchema = new Schema(
  {
    flag: {
      type: Boolean,
      default: false,
    },
    leaveDate: { type: String },
  },
  { _id: false }
);
var TransferCountSchema = new Schema(
  {
    count: {
      type: Number,
      default: 0,
    },
    createdAt: { type: Date, expires: "1m", default: Date.now },
  },
  { _id: false }
);

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
      unique: true,
    },
    password: {
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
    timeSlot: [SlotSchema],
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

    transferCount: TransferCountSchema,
    transferredBookings: [
      {
        type: Schema.Types.ObjectId,
        ref: "service",
      },
    ],
    onLeave: [LeaveSchema],
    emergencyLeave:{
      type:Boolean,
      default:false
    },
    duty:{
      type:Boolean,
      defaut:false
    },
    rating: [
      {
        userId: {
          type: Schema.Types.ObjectId,
        },
        star: {
          type: Number,
        },
        comments: {
          type: String,
        },
      },
    ],
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
