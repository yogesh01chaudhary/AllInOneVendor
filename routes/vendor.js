const express = require("express");
const router = express.Router();
const {
  vendorRequest,
  addPrice,
  addPriceToSilver,
  addPriceToGold,
  addPriceToPlatinum,
  addPackageToService,
  getPopulatedService,
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
  S3Url,
  updateS3Url,
  updateImageUrl,
  deleteImageUrl,
  s3Url,
  s3Url1,
  nearByVendors,
  updateCoordinates,
} = require("../controllers/vendor");
const { auth } = require("../middleware/auth");
const { isVendor } = require("../middleware/isVendor");


//**************************************NOT_IN_USE***************************************************************************//
router.post("/vendorRequest", vendorRequest);
router.post("/price", addPrice);
router.post("/silver", addPriceToSilver);
router.post("/gold", addPriceToGold);
router.post("/platinum", addPriceToPlatinum);
router.post("/package", addPackageToService);
router.get("/service", getPopulatedService);

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

//*************************************USERS******************************************************************************************//
router.get("/nearByVendors", auth, isVendor, nearByVendors);
router.get("/getVendorLocation",auth, isVendor, getVendorLocation);

module.exports = router;
