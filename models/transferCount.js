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
    createdAt: { type: Date, expires: "1m", default: Date.now },
  });

module.exports = model("transferCount", TransferCountSchema);
