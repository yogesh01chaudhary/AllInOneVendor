const { Schema, model } = require("mongoose");

const ServiceCategorySchema = new Schema({
  vendor: {
    type: Schema.Types.ObjectId,
    ref: "vendor",
    required: true,
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: "service",
    required: true,
  },

  silver: {
    type: Schema.Types.ObjectId,
    ref: "servicePrice",
  },

  gold: {
    type: Schema.Types.ObjectId,
    ref: "servicePrice",
  },

  platinum: {
    type: Schema.Types.ObjectId,
    ref: "servicePrice",
  },
});

exports.ServiceCategory = model("serviceCategory", ServiceCategorySchema);
