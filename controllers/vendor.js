const { Vendor } = require("../models/vendor");
exports.vendorRequest = async (req, res) => {
  try {
    const { body } = req;
    let vendor = new Vendor(body);
    vendor = await vendor.save();
    if (!vendor) {
      return res
        .statsu(400)
        .send({ success: false, message: "Vendor not created successfully" });
    }
    res
      .status(200)
      .send({
        success: true,
        message: "Request For Vendor created successfully",
        vendor,
      });
  } catch (e) {
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", error: e.name });
  }
};
