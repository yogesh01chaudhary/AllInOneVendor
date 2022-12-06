const { Schema, model } = require("mongoose");
const { Service } = require("./services");
const subCategory = require("./subCategory");
const CategorySchema = new Schema(
  {
    name: {
      type: String,
    },
    image: {
      type: String,
    },
    subCategory: [
      {
        type: Schema.Types.ObjectId,
        ref: subCategory,
      },
    ],
    service: [
      {
        type: Schema.Types.ObjectId,
        ref: Service,
      },
    ],
  },
  {
    timestamps: true,
  }
);
module.exports = model("category", CategorySchema);
