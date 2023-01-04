const { Schema, model } = require("mongoose");
const NearByVendorsSchema = new Schema([
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "vendor",
      required: true,
    },
    action: {
      type: String,
      enum: ["Confirm", "Transfer"],
    },
  },
]);
module.exports = model("nearByVendors", NearByVendorsSchema);