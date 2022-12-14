const express = require("express");
const {
  sendOTPToMail,
  verifyOTP,
  phoneOTP,
  verifyPhoneOTP,
} = require("../controllers/otp");

const router = express.Router();

//NOT_USED
//TESTING_PURPOSE
//****************************************getAllCategory*******************************************************************************//
router.post("/emailOTP", sendOTPToMail);
router.post("/phoneOTP", phoneOTP);
router.post("/verifyOTP", verifyOTP);
router.post("/verifyPhoneOTP", verifyPhoneOTP);

module.exports = router;
