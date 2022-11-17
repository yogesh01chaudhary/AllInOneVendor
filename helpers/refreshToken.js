const { v4: uuidv4 } = require("uuid");
const RefreshToken = require("../models/refreshToken");

exports.createToken = async (vendor) => {
  let token = uuidv4();

  let refreshToken = new RefreshToken({
    token,
    vendor: vendor._id,
  });

  refreshToken = await refreshToken.save();

  return refreshToken.token;
};
