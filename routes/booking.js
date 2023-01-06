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
  checkBookingStatus,
  uploadBookingImage,
  deleteBookingImage,
} = require("../controllers/booking");
const { auth } = require("../middleware/auth");
const { isVendor } = require("../middleware/isVendor");

const router = express.Router();

//*************************************booking*************************************************************************//
//*********************************confirm-and-transfer-booking************************************************************************//
router.put("/confirm", auth, isVendor, confirmBooking);
router.put("/transfer", auth, isVendor, transferBooking);

//TESTING NOT_IN_USE
router.put("/transferCount", auth, isVendor, transferCount);

//*************************************checkBookingStatusById/getBookingById*********************************************************************//
router.get("/checkBookingStatus/:bookingId", auth, isVendor, checkBookingStatus);
router.get("/byId/:bookingId", auth, isVendor, getBookingsById);

//************************************getAllBookings/today/upcoming/confirmedBookings***********************************************************************//
router.get("/", auth, isVendor, getBookingsVendor);
router.get("/today", auth, isVendor, getTodayBookings);
router.get("/upcoming", auth, isVendor, getUpcomingBookings);
router.get("/confirmed", auth, isVendor, getConfirmedBookings);

//************************************sendStartAndEndBookingOTP/verifyOTPForBooking************************************************************************//
router.put("/sendOTP", auth, isVendor, sendOTPToMailAndPhone);
router.put("/verifyOTP", auth, isVendor, verifyOTP);

//*************************************bookingStartTime/complete*************************************************************************//
router.put("/bookingStartTime", auth, isVendor, bookingStartTime);
router.put("/complete", auth, isVendor, completeBooking);

//*********************************upload/deleteBookingImage*************************************************************************//
router.put("/uploadBookingImage", auth, isVendor, uploadBookingImage);
router.delete("/deleteBookingImage", auth, isVendor, deleteBookingImage);

//EXTRA
//************************************************bookingImageUpload******************************************************************************//
router.put("/bookingImageUpload", auth, isVendor, bookingImageUpload);

module.exports = router;
