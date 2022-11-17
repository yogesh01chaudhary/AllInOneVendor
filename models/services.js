const { Schema, model } = require("mongoose");
const { PackageSchema } = require("./packageSchema");

const ServiceSchema = new Schema(
  {
    name: {
      type: String,
    },
    image: {
      type: Buffer,
    },
    description: {
      type: String,
    },
    silver: PackageSchema,
    gold: PackageSchema,
    platinum: PackageSchema,
  },
  {
    timestamps: true,
  }
);

exports.Service = model("service", ServiceSchema);
