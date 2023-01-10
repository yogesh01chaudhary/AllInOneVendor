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
  addTimeSlot,
  requestLeave,
  requestEmergencyLeave,
  logoutTime,
  loginTime,
  updateEmail,
  getReviews,
  base64ImageUpload,
  addMultipleImageToS3,
  deleteFormDataImage,
  checkFormStatus,
  sendMailOTP,
  verifyMailOTP,
  getMyProfile,
  checkLeaveStatus,
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

//*************************************getVendorProfile*******************************************************************************//
router.get("/profile", auth, isVendor, getMyProfile);

//*************************************updateEmail-SendMailOTP/VerifyMailOtp********************************************************************************//
router.put("/sendMail", auth, isVendor, sendMailOTP);
router.post("/verifyMailOTP", auth, isVendor, verifyMailOTP);

//*************************************vendorRequestForService************************************************************************//
router.put("/serviceRequested", auth, isVendor, requestForService);

//*************************************checkFormStatus*************************************************************************//
router.get("/checkFormStatus", auth, isVendor, checkFormStatus);

//*************************************loginVendorByIDPasword*************************************************************************//
router.post("/loginVendor2", loginVendor2);
router.put("/updatePassword", auth, isVendor, updatePassword);

//*************************************leave/emergencyLeaveRequest*************************************************************************//
router.put("/requestEmergencyLeave", auth, isVendor, requestEmergencyLeave);
router.put("/requestLeave", auth, isVendor, requestLeave);

//************************************checkLeaveStatus*************************************************************************//
router.put("/leaveStatus", auth, isVendor, checkLeaveStatus);

//*************************************login/logoutTime*************************************************************************//
router.put("/loginTime", auth, isVendor, loginTime);
router.put("/logoutTime", auth, isVendor, logoutTime);

//************************************checkReviews*************************************************************************//
router.get("/reviews", auth, isVendor, getReviews);

//************************************imageUploadForImageUrlAndVerification/Delete************************************************************************//
router.put("/base64ImageUpload", auth, isVendor, base64ImageUpload);
router.delete("/deleteFormDataImage", auth, isVendor, deleteFormDataImage);

//testing
//************************************multipleImageUpload************************************************************************//
router.put("/addMultipleImageToS3", auth, isVendor, addMultipleImageToS3);

//NOT_USED
//*************************************timeSlot*************************************************************************//
router.put("/timeSlot", auth, isVendor, addTimeSlot);

//NOT_USED
//************************************emailUpdateWithoutOTPVerification************************************************************************//
router.put("/email", auth, isVendor, updateEmail);

//*************************************PHOTO_UPLOAD***********************************************************************************//
//NOT_USED
//************************************express-fileupload***************************************************************************//
router.put("/photo", auth, isVendor, uploadProfilePhoto);

//*************************************s3Bucket***************************************************************************************//
//NOT_USED
router.get("/s3Url", auth, isVendor, s3Url);

//NOT_USED
//*************************************vendorImageUrlUpload/deleteImageUrlFromS3********************************************************************************//
router.get("/s3Url1", auth, isVendor, s3Url1);
router.put("/imageUrl", auth, isVendor, updateImageUrl);
router.delete("/imageUrl", auth, isVendor, deleteImageUrl);

//*****************************************************end*******************************************************************************//

module.exports = router;
