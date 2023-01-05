const { Schema, model } = require("mongoose");
var NearSchema = new Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "vendor",
      required: true,
    },
    action: {
      type: String,
      enum: ["Confirm", "Transfer", "Pending"],
      default: "Pending",
    },
  },
  { _id: false }
);
const NearByVendorsSchema = new Schema({
  vendors: [NearSchema],
});
module.exports = model("nearByVendors", NearByVendorsSchema);
