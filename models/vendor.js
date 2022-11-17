const { Schema, model } = require("mongoose");
const { geocoder } = require("../helpers/geoCoder");
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
    requestStatus: {
      type: String,
      default: "pending",
    },
    transferCount: {
      type: Number,
    },
    transferStatus: {
      type: String,
      default: "unblock",
    },
    timeSlot: [
      {
        start: String,
        end: String,
        booked: {
          type: Boolean,
          default: false,
        },
      },
    ],
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
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: "service",
      },
    ],
    requestedService: [
      {
        type: String,
      },
    ],
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
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
