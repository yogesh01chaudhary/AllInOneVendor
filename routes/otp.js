const express = require("express");
const {
  sendOTPToMail,
  verifyOTP,
  phoneOTP,
  verifyPhoneOTP,
  sendOTPDetails,
  verifyOTPDetails,
} = require("../controllers/otp");

const router = express.Router();

router.post("/emailOTP", sendOTPToMail);
router.post("/phoneOTP", phoneOTP);
router.post("/verifyOTP", verifyOTP);
router.post("/verifyPhoneOTP", verifyPhoneOTP);

//VENDOR
router.post("/sendOTPDetails", sendOTPDetails);
router.post("/verifyOTPDetails", verifyOTPDetails);

module.exports = router;
