const { Schema, model } = require("mongoose");
const SubCategorySchema2 = new Schema(
  {
    name: {
      type: String,
    },
    image: {
      type: String,
    },
    service: [
      {
        type: Schema.Types.ObjectId,
        ref: "service",
      },
    ],
  },
  {
    timestamps: true,
  }
);
module.exports = model("subCategory2", SubCategorySchema2);
