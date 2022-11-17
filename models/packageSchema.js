const { Schema, model } = require("mongoose");
const PackageSchema = new Schema({
  description: { type: String, required: true },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
  },
  vendor: [
    {
      type: Schema.Types.ObjectId,
      ref: "vendor",
    },
  ],
  rating: [
    {
      ratedBy: {
        type: Schema.Types.ObjectId,
        ref: "user",
      },
      star: {
        type: Number,
      },
    },
  ],
  
});

module.exports = { PackageSchema };
