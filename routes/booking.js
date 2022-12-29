const express = require("express");
const {
  confirmBooking,
  transferBooking,
  completeBooking,
  getBookingsVendor,
  transferCount,
  bookingStartTime,
  bookingImageUpload,
  getBookingsById,
  getConfirmedBookings,
  getTodayBookings,
  getUpcomingBookings,
  sendOTPToMail,
  verifyOTP,
  sendOTPToMailAndPhone,
} = require("../controllers/booking");
const { auth } = require("../middleware/auth");
const { isVendor } = require("../middleware/isVendor");

const router = express.Router();

//*************************************booking*************************************************************************//
router.put("/confirm", auth, isVendor, confirmBooking);
router.put("/transfer", auth, isVendor, transferBooking);
router.put("/transferCount", auth, isVendor, transferCount);
router.put("/complete", auth, isVendor, completeBooking);

router.get("/byId/:bookingId", auth, isVendor, getBookingsById);
router.get("/", auth, isVendor, getBookingsVendor);
router.get("/today", auth, isVendor, getTodayBookings);
router.get("/upcoming", auth, isVendor, getUpcomingBookings);
router.get("/confirmed", auth, isVendor, getConfirmedBookings);

router.put("/sendOTP", auth, isVendor, sendOTPToMailAndPhone);
router.put("/verifyOTP", auth, isVendor, verifyOTP);
router.put("/bookingStartTime", auth, isVendor, bookingStartTime);

router.put("/bookingImageUpload", auth, isVendor, bookingImageUpload);

module.exports = router;
