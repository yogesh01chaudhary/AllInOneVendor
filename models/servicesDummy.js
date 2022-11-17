const { Schema, model } = require("mongoose");

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
    // vendor: {
    //   type: Schema.Types.ObjectId,
    //   ref: "vendor",
    //   required: true,
    // },
    serviceCategory:[ {
      type: Schema.Types.ObjectId,
      ref: "serviceCategory",
      required: true,
    }],
  },
  {
    timestamps: true,
  }
);

exports.Service = model("service", ServiceSchema);
