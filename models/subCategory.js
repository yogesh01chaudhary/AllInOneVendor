const { Schema, model } = require("mongoose");
const subCategory2 = require("./subCategory2");
const { Service } = require("./services");
const SubCategorySchema = new Schema(
  {
    name: {
      type: String,
    },
    image: {
      type: String,
    },
    subCategory2: [
      {
        type: Schema.Types.ObjectId,
        ref: subCategory2,
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
module.exports = model("subCategory", SubCategorySchema);
