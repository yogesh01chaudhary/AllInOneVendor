const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema({
  token: String,
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "vendor",
  },
});

// RefreshTokenSchema.statics.createToken = async function (user) {
//   let expiredAt = new Date();

//   expiredAt.setSeconds(
//     expiredAt.getSeconds() + process.env.jwtRefreshExpiration
//   );

//   let _token = uuidv4();

//   let _object = new this({
//     token: _token,
//     user: user._id,
//     expiryDate: expiredAt.getTime(),
//   });

//   console.log(_object);

//   let refreshToken = await _object.save();

//   return refreshToken.token;
// };

// RefreshTokenSchema.statics.verifyExpiration = (token) => {
//   return token.expiryDate.getTime() < new Date().getTime();
// }

const RefreshToken = mongoose.model("RefreshToken", RefreshTokenSchema);

module.exports = RefreshToken;
