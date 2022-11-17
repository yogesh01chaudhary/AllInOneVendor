const { Schema, model } = require("mongoose");

const ServicePriceSchema = new Schema({
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
  serviceType: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
  },
  description: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
  },
  image: {
    type: String,
  },
});

exports.ServicePrice = model("servicePrice", ServicePriceSchema);
