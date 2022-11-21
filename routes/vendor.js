const express = require("express");
const router = express.Router();
const {
  loginVendor,
  verifyOTP,
  signUp,
  aadharVerification,
  addBankAccountDetails,
  loginVendor2,
  updatePassword,
  requestForService,
  getVendorLocation,
  uploadProfilePhoto,
  updateImageUrl,
  deleteImageUrl,
  s3Url,
  s3Url1,
  nearByVendors,
  updateCoordinates,
  confirmBooking,
} = require("../controllers/vendor");
const { auth } = require("../middleware/auth");
const { isVendor } = require("../middleware/isVendor");

//*************************************VENDOR*****************************************************************************************//
//*************************************loginVendorByNumber****************************************************************************//
router.post("/loginVendor", loginVendor);
router.post("/verifyOTP", verifyOTP);

//*************************************updatingDetails********************************************************************************//
router.put("/signUp", auth, isVendor, signUp);
router.put("/aadharVerification", auth, isVendor, aadharVerification);
router.put("/bankDetails", auth, isVendor, addBankAccountDetails);
router.put("/coordinates", auth, isVendor, updateCoordinates);

//*************************************PHOTO_UPLOAD***********************************************************************************//
// //************************************express-fileupload***************************************************************************//
router.put("/photo", auth, isVendor, uploadProfilePhoto);

//*************************************s3Bucket***************************************************************************************//
router.get("/s3Url", auth, isVendor, s3Url);
router.get("/s3Url1", auth, isVendor, s3Url1);
router.put("/imageUrl", auth, isVendor, updateImageUrl);
router.delete("/imageUrl", auth, isVendor, deleteImageUrl);

//*************************************vendorRequestForService************************************************************************//
router.put("/serviceRequested", auth, isVendor, requestForService);

//*************************************loginVendorByIDPasword*************************************************************************//
router.post("/loginVendor2", loginVendor2);
router.put("/updatePassword", auth, isVendor, updatePassword);

//*************************************booking*************************************************************************//
router.put("/confirmBooking",auth,isVendor,confirmBooking)

module.exports = router;
