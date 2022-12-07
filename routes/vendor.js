const express = require("express");
const router = express.Router();
const {
  loginVendor,
  verifyOTP,
  signUp,
  addBankAccountDetails,
  loginVendor2,
  updatePassword,
  requestForService,
  uploadProfilePhoto,
  updateImageUrl,
  deleteImageUrl,
  s3Url,
  s3Url1,
  updateCoordinates,
  s3UrlSelfie1,
  updateSelfie1Url,
  deleteSelfie1Url,
  s3UrlSelfie2,
  updateSelfie2Url,
  deleteSelfie2Url,
  s3UrlAadharFront,
  updateAaadharFrontUrl,
  deleteAadharFrontUrl,
  s3UrlAadharBack,
  updateAadharBackUrl,
  deleteAadharBackUrl,
  s3UrlPancard,
  deletePancardUrl,
  updatePancardUrl,
  addTimeSlot,
  requestLeave,
  requestEmergencyLeave,
  logoutTime,
  loginTime,
} = require("../controllers/vendor");
const { auth } = require("../middleware/auth");
const { isVendor } = require("../middleware/isVendor");

//*************************************VENDOR*****************************************************************************************//
//*************************************loginVendorByNumber****************************************************************************//
router.post("/loginVendor", loginVendor);
router.post("/verifyOTP", verifyOTP);

//*************************************updatingDetails********************************************************************************//
router.put("/signUp", auth, isVendor, signUp);
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

//*************************************_AADHAR_VERIFICATION_PHOTO_UPLOAD***********************************************************************************//
//***********************************SELFIE_1***********************************************************************************//
router.get("/s3UrlSelfie1", auth, isVendor, s3UrlSelfie1);
router.put("/selfie1Url", auth, isVendor, updateSelfie1Url);
router.delete("/selfie1Url", auth, isVendor, deleteSelfie1Url);

//***********************************SELFIE_2***********************************************************************************//
router.get("/s3UrlSelfie2", auth, isVendor, s3UrlSelfie2);
router.put("/selfie2Url", auth, isVendor, updateSelfie2Url);
router.delete("/selfie2Url", auth, isVendor, deleteSelfie2Url);

//***********************************AADHAR_FRONT***********************************************************************************//
router.get("/s3UrlAadharFront", auth, isVendor, s3UrlAadharFront);
router.put("/aadharFrontUrl", auth, isVendor, updateAaadharFrontUrl);
router.delete("/aadharFrontUrl", auth, isVendor, deleteAadharFrontUrl);

//***********************************AADHAR_BACK***********************************************************************************//
router.get("/s3UrlAadharBack", auth, isVendor, s3UrlAadharBack);
router.put("/aadharBackUrl", auth, isVendor, updateAadharBackUrl);
router.delete("/aadharBackUrl", auth, isVendor, deleteAadharBackUrl);

//***********************************PANCARD***********************************************************************************//
router.get("/s3UrlPancard", auth, isVendor, s3UrlPancard);
router.put("/pancardUrl", auth, isVendor, updatePancardUrl);
router.delete("/pancardUrl", auth, isVendor, deletePancardUrl);

//*************************************vendorRequestForService************************************************************************//
router.put("/serviceRequested", auth, isVendor, requestForService);

//*************************************loginVendorByIDPasword*************************************************************************//
router.post("/loginVendor2", loginVendor2);
router.put("/updatePassword", auth, isVendor, updatePassword);

//*************************************timeSlot*************************************************************************//
router.put("/timeSlot", auth, isVendor, addTimeSlot);

//*************************************leave/emergencyLeaveRequest*************************************************************************//
router.put("/requestEmergencyLeave", auth, isVendor, requestEmergencyLeave);
router.put("/requestLeave", auth, isVendor, requestLeave);

//*************************************timeSlot*************************************************************************//
router.put("/loginTime", auth, isVendor, loginTime);
router.put("/logoutTime", auth, isVendor, logoutTime);

module.exports = router;
