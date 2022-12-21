const { Schema, model } = require("mongoose");
const TransferCountSchema = new Schema({
  vendor: {
    type: Schema.Types.ObjectId,
    ref: "vendor",
  },
  count: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    expires: `${process.env.EXPIRY_TTL}`,
    default: Date.now,
  },
});
module.exports = model("transferCount", TransferCountSchema);
