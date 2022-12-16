const express = require("express");
const {
  confirmBooking,
  transferBooking,
  completeBooking,
  getBookingsVendor,
  s3UrlMaskSelfie,
  updateMaskSelfie,
  deleteMaskSelfie,
  s3UrlProduct,
  updateProductUrl,
  deleteProductUrl,
  transferCount,
  bookingStartTime,
  bookingImageUpload,
} = require("../controllers/booking");
const { auth } = require("../middleware/auth");
const { isVendor } = require("../middleware/isVendor");

const router = express.Router();

//*************************************booking*************************************************************************//
router.put("/confirm", auth, isVendor, confirmBooking);
router.put("/transfer", auth, isVendor, transferBooking);
router.put("/complete", auth, isVendor, completeBooking);
router.get("/", auth, isVendor, getBookingsVendor);

//***********************************SELFIE_WITH_MASK***********************************************************************************//
router.get("/s3UrlMaskSelfie", auth, isVendor, s3UrlMaskSelfie);
router.put("/maskSelfieUrl", auth, isVendor, updateMaskSelfie);
router.delete("/maskSelfieUrl", auth, isVendor, deleteMaskSelfie);

//***********************************PRODUCTS_UPLOAD***********************************************************************************//
router.get("/s3UrlProduct", auth, isVendor, s3UrlProduct);
router.put("/productUrl", auth, isVendor, updateProductUrl);
router.delete("/productUrl", auth, isVendor, deleteProductUrl);

//testing
router.put("/transferCount", auth, isVendor, transferCount);
router.put("/bookingStartTime", auth, isVendor, bookingStartTime);

router.put("/bookingImageUpload", auth, isVendor, bookingImageUpload);

module.exports = router;
