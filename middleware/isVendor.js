const { Vendor } = require("../models/vendor");

exports.isVendor = async (req, res, next) => {
  try {
    const { id } = req.user;
    const vendor = await Vendor.findById({ _id: id });
    if (!vendor) {
      return res.status(200).send({ success: true, message: "Not Vendor" });
    }
    next();
  } catch (e) {
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", error: e.name });
  }
};
