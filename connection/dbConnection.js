const mongoose = require("mongoose");

const MONGO_URL=process.env.MONGO_URL
exports.connect = () => {
  mongoose
    .connect(MONGO_URL)
    .then(() => {
      console.log("Database connected sucessfully!!");
    })
    .catch((e) => {
      console.log("Something went wrong,Databse not connected");
    });
};
