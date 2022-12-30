const { Vendor } = require("../models/vendor");
const Joi = require("joi");
const Booking = require("../models/booking");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const TransferCount = require("../models/transferCount");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");

const OTP = require("../models/otp");
var otpGenerator = require("otp-generator");
const axios = require("axios");
const fast2sms = require("fast-two-sms");
const emailValidator = require("deep-email-validator");
const { findById } = require("../models/refreshToken");

//@desc admin send booking to nearbyvendors and vendor will confirm the booking
//@route PUT vendor/booking/confirmBooking
//@access Private
exports.confirmBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        booking: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    let matchQuery = {
      $match: {
        $and: [
          { _id: mongoose.Types.ObjectId(body.booking) },
          {
            $or: [
              { bookingStatus: "Pending" },
              { bookingStatus: "Transferred" },
            ],
          },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
          ],
        },
      },
    ]);

    let result = data[0].totalData;
    if (result.length === 0) {
      return res.status(404).send({ success: false, message: "No Data Found" });
    }
    result = result[0];
    if (!result.userData[0].email && !result.userData[0].phone) {
      return res
        .status(400)
        .send({ success: false, mesage: "User Mail Id Or Phone Is Required" });
    }

    let booking = await Booking.findByIdAndUpdate(
      body.booking,
      {
        bookingStatus: "Confirmed",
        vendor: user.id,
      },
      { new: true, session }
    );
    if (!booking) {
      return res
        .status(400)
        .send({ success: false, message: "Something went wrong" });
    }
    let vendor = await Vendor.findByIdAndUpdate(
      user.id,
      {
        $addToSet: {
          bookings: { bookingId: new mongoose.Types.ObjectId(body.booking) },
        },
        $addToSet: {
          timeSlot: {
            start: result.timeSlot.start,
            end: result.timeSlot.end,
            bookingDate: result.timeSlot.bookingDate,
            booked: true,
          },
        },
      },
      { new: true, session }
    );
    if (!vendor) {
      return res
        .status(400)
        .send({ success: false, message: "Something went wrong" });
    }

    // send mail or sms to user to let him know that his booking is confirmed
    let transporter = await nodemailer.createTransport({
      service: process.env.SERVICE,
      host: process.env.HOST,
      port: process.env.PORTMAIL,
      secure: false,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });

    const mailResponse = await transporter.sendMail({
      from: `"Yogesh Chaudhary" <${process.env.USER}>`,
      to: `${result.userData[0].email}`,
      subject: `OrderID ${body.booking} Status`,
      text:
        `Dear User, \n\n` +
        `Your booking having booking id ${body.booking} is confirmed. \n\n` +
        "This is a auto-generated email. Please do not reply to this email.\n\n" +
        "Regards\n" +
        "Yogesh Chaudhary\n\n",
    });

    if (!mailResponse) {
      return res
        .status(400)
        .send({ success: true, message: "Something went wrong" });
    }
    if (mailResponse.accepted.length === 0) {
      return res.status(400).send({ success: false, mailResponse });
    }
    await session.commitTransaction();
    await session.endSession();
    return res.status(200).send({
      success: true,
      message: "Booking Confirmed",
      // booking,
      // vendor,
      // mailResponse,
    });
  } catch (e) {
    await session.abortTransaction();
    await session.endSession();
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

//@desc admin send booking to nearbyvendors and vendor will transfer the booking and admin will hit api to find nearby vendors and then vendors will confirm/transfer
//@route PUT vendor/booking/transferBooking
//@access Private
exports.transferBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        bookingId: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    let matchQuery = {
      $match: {
        $and: [
          { _id: mongoose.Types.ObjectId(body.bookingId) },
          {
            $or: [
              { bookingStatus: "Pending" },
              { bookingStatus: "Transferred" },
            ],
          },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
          ],
        },
      },
    ]);

    let result = data[0].totalData;

    if (result.length === 0) {
      return res
        .status(404)
        .send({ success: false, message: "Booking Not Found" });
    }
    result = result[0];

    let vendor = await Vendor.findById(user.id);
    if (!vendor) {
      return res
        .status(400)
        .send({ success: false, message: "Vendor Not Found" });
    }

    session.startTransaction();
    if (!vendor.transferCount) {
      let transferCount = new TransferCount({ vendor: user.id, count: 1 });
      transferCount = await transferCount.save({ session });
      if (!transferCount) {
        return res.status(400).send({
          success: false,
          message: "Something went wrong in transfer count ",
        });
      }
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          transferCount: transferCount._id,
          $addToSet: { transferredBookings: body.bookingId },
        },
        { new: true, session }
      );
      await Booking.findByIdAndUpdate(
        body.bookingId,
        {
          bookingStatus: "Transferred",
        },
        { new: true, session }
      );

      await session.commitTransaction();
      await session.endSession();
      return res.status(200).send({
        success: true,
        message: "Transfer",
        transferCount: vendor.transferCount,
        transferredBookings: vendor.transferredBookings,
        count: transferCount.count,
      });
    }
    let transferCount = await TransferCount.findById(vendor.transferCount);
    if (!transferCount) {
      let transferCount = new TransferCount({ vendor: user.id, count: 1 });
      transferCount = await transferCount.save({ session });
      if (!transferCount) {
        return res.status(400).send({
          success: false,
          message: "Something went wrong in transfer count ",
        });
      }
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          transferCount: transferCount._id,
          $addToSet: { transferredBookings: body.bookingId },
        },
        { new: true, session }
      );
      await Booking.findByIdAndUpdate(
        body.bookingId,
        {
          bookingStatus: "Transferred",
        },
        { new: true, session }
      );

      await session.commitTransaction();
      await session.endSession();
      return res.status(200).send({
        success: true,
        message: "Transfer",
        transferCount: vendor.transferCount,
        transferredBookings: vendor.transferredBookings,
        count: transferCount.count,
      });
    }
    if (transferCount.count !== 3) {
      transferCount = await TransferCount.findByIdAndUpdate(
        vendor.transferCount,
        {
          count: transferCount.count + 1,
          $addToSet: { transferredBookings: body.bookingId },
        },
        { new: true, session }
      );
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          $addToSet: { transferredBookings: body.bookingId },
        },
        { new: true, session }
      );
      await Booking.findByIdAndUpdate(
        body.bookingId,
        {
          bookingStatus: "Transferred",
        },
        { new: true, session }
      );

      await session.commitTransaction();
      await session.endSession();
      return res.status(200).send({
        success: true,
        message: "Transfer",
        transferCount: vendor.transferCount,
        transferredBookings: vendor.transferredBookings,
        count: transferCount.count,
      });
    }

    await session.commitTransaction();
    await session.endSession();
    return res.status(200).send({
      success: true,
      message:
        "Your Account Is Blocked You Have Reached Maximum Transfer Limit",
      transferCount: vendor.transferCount,
      transferredBookings: vendor.transferredBookings,
      count: transferCount.count,
    });
  } catch (e) {
    await session.abortTransaction();
    await session.endSession();
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

//@desc admin send booking to nearbyvendors and vendor will transfer the booking and admin will hit api to find nearby vendors and then vendors will confirm/transfer
//@route PUT vendor/booking/transferCount
//@access Private
exports.transferCount = async (req, res) => {
  try {
    const { body, user } = req;
    //   const { error } = Joi.object()
    //     .keys({
    //       bookingId: Joi.string().required(),
    //     })
    //     .required()
    //     .validate(body);
    //   if (error) {
    //     return res
    //       .status(400)
    //       .send({ success: false, message: error.details[0].message });
    //   }
    //   let matchQuery = {
    //     $match: {
    //       $and: [
    //         { _id: mongoose.Types.ObjectId(body.bookingId) },
    //         { bookingStatus: "Confirmed" },
    //       ],
    //     },
    //   };

    //   let data = await Booking.aggregate([
    //     {
    //       $facet: {
    //         totalData: [
    //           matchQuery,
    //           { $project: { __v: 0 } },
    //           {
    //             $lookup: {
    //               from: "users",
    //               localField: "userId",
    //               foreignField: "_id",
    //               as: "userData",
    //             },
    //           },
    //         ],
    //       },
    //     },
    //   ]);

    //   let result = data[0].totalData;

    //   if (result.length === 0) {
    //     return res
    //       .status(404)
    //       .send({ success: false, message: "Booking Not Found" });
    //   }
    //   result = result[0];

    let vendor = await Vendor.findById(user.id);
    if (!vendor) {
      return res
        .status(400)
        .send({ success: false, message: "Vendor Not Found" });
    }
    // console.log(vendor.transferCount);
    if (!vendor.transferCount) {
      let transferCount = new TransferCount({ vendor: user.id, count: 1 });
      transferCount = await transferCount.save();
      if (!transferCount) {
        return res.status(400).send({
          success: false,
          message: "Something went wrong in transfer count ",
        });
      }
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          transferCount: transferCount._id,
          $addToSet: { transferredBookings: body.bookingId },
        },
        { new: true }
      );
      return res.status(200).send({
        success: true,
        message: "Transfer",
        vendor,
      });
    }
    // console.log(vendor.transferCount);
    let transferCount = await TransferCount.findById(vendor.transferCount);
    if (!transferCount) {
      let transferCount = new TransferCount({ vendor: user.id, count: 1 });
      transferCount = await transferCount.save();
      if (!transferCount) {
        return res.status(400).send({
          success: false,
          message: "Something went wrong in transfer count ",
        });
      }
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          transferCount: transferCount._id,
          $addToSet: { transferredBookings: body.bookingId },
        },
        { new: true }
      );
      return res.status(200).send({
        success: true,
        message: "Transfer",
        vendor,
      });
    }
    if (transferCount.count !== 3) {
      vendor = await TransferCount.findByIdAndUpdate(
        vendor.transferCount,
        {
          count: transferCount.count + 1,
        },
        { new: true }
      );
      return res.status(200).send({
        success: true,
        message: "Transfer",
        vendor,
      });
    }
    return res.status(200).send({
      success: true,
      message:
        "Your Account Is Blocked You Have Reached Maximum Transfer Limit",
      vendor,
    });
  } catch (e) {
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

exports.bookingStartTime = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        bookingId: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    let matchQuery = {
      $match: {
        $and: [
          { _id: mongoose.Types.ObjectId(body.bookingId) },
          // { vendor: mongoose.Types.ObjectId("63a97ab71d8118537d98bedb") },
          { vendor: mongoose.Types.ObjectId(user.id) },
          { bookingStatus: "Confirmed" },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
          ],
        },
      },
    ]);

    let result = data[0].totalData;

    if (result.length === 0) {
      let booking = await Booking.find({
        $and: [
          { _id: mongoose.Types.ObjectId(body.bookingId) },
          // { vendor: mongoose.Types.ObjectId("63a97ab71d8118537d98bedb") },
          { vendor: mongoose.Types.ObjectId(user.id) },
          { bookingStatus: "Started" },
        ],
      });
      if (!booking) {
        return res
          .status(500)
          .send({ success: false, message: "Something went wrong" });
      }
      if (booking.length !== 0) {
        return res
          .status(200)
          .send({ success: false, message: "Booking Already Started" });
      }
      return res
        .status(404)
        .send({ success: false, message: "Booking Not Found" });
    }
    result = result[0];
    let booking = await Booking.findByIdAndUpdate(
      body.bookingId,
      {
        bookingStatus: "Started",
      },
      { new: true, session }
    );
    if (!booking) {
      await session.abortTransaction();
      await session.endSession();
      return res
        .status(404)
        .send({ success: false, message: "Something went wrong" });
    }
    let vendor = await Vendor.findOneAndUpdate(
      {
        _id: mongoose.Types.ObjectId(user.id),
        // _id: mongoose.Types.ObjectId("63a97ab71d8118537d98bedb"),
        // bookings: { $all: [{ $elemMatch: { bookingId: body.bookingId } }] },
      },
      {
        $set: {
          "bookings.$[elem].startTime": Date.now(),
          //   "bookings.$[elem].endTime": Date.now(),
        },
      },
      {
        arrayFilters: [
          { "elem.bookingId": mongoose.Types.ObjectId(body.bookingId) },
        ],
        new: true,
        session,
      }
    );
    if (!vendor) {
      await session.abortTransaction();
      await session.endSession();
      return res
        .status(404)
        .send({ success: false, message: "Something went wrong" });
    }

    await session.commitTransaction();
    await session.endSession();
    return res.status(200).send({ success: true, message: "Booking Started" });
  } catch (e) {
    await session.abortTransaction();
    await session.endSession();
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

//@desc admin send booking to nearbyvendors and vendor will confirm the booking
//@route PUT vendor/booking/complete
//@access Private
exports.completeBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { body, user } = req;
    console.log(body, user);
    const { error } = Joi.object()
      .keys({
        bookingId: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    let matchQuery = {
      $match: {
        $and: [
          { _id: mongoose.Types.ObjectId(body.bookingId) },
          { bookingStatus: "Started" },
          { vendor: mongoose.Types.ObjectId(user.id) },
          // { vendor: mongoose.Types.ObjectId("63a97ab71d8118537d98bedb") },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
          ],
        },
      },
    ]);

    let result = data[0].totalData;

    if (result.length === 0) {
      let booking = await Booking.find({
        $and: [
          { _id: mongoose.Types.ObjectId(body.bookingId) },
          // { vendor: mongoose.Types.ObjectId("63a97ab71d8118537d98bedb") },
          { vendor: mongoose.Types.ObjectId(user.id) },
          { bookingStatus: "Completed" },
        ],
      });
      if (!booking) {
        return res
          .status(500)
          .send({ success: false, message: "Something went wrong" });
      }
      if (booking.length !== 0) {
        return res
          .status(200)
          .send({ success: false, message: "Booking Already Completed" });
      }
      return res
        .status(404)
        .send({ success: false, message: "Booking Not Found" });
    }
    result = result[0];
    if (!result.userData[0].email && !result.userData[0].phone) {
      return res
        .status(400)
        .send({ success: false, mesage: "User Mail Id Or Phone Is Required" });
    }

    await Booking.findByIdAndUpdate(
      body.bookingId,
      {
        bookingStatus: "Completed",
      },
      { new: true, session }
    );

    let vendor = await Vendor.findOneAndUpdate(
      {
        _id: mongoose.Types.ObjectId(user.id),
        // _id: mongoose.Types.ObjectId("63a97ab71d8118537d98bedb"),
        // bookings: { $all: [{ $elemMatch: { bookingId: body.bookingId } }] },
      },
      {
        $set: {
          // "bookings.$[elem].startTime": Date.now() + 60 * 60 * 24 * 1000,
          "bookings.$[elem].endTime": Date.now(),
        },
        $pull: {
          timeSlot: {
            start: result.timeSlot.start,
            end: result.timeSlot.end,
            bookingDate: result.timeSlot.bookingDate,
            booked: true,
          },
        },
      },
      {
        arrayFilters: [
          { "elem.bookingId": mongoose.Types.ObjectId(body.bookingId) },
        ],
        new: true,
        session,
      }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Something went wrong" });
    }

    // send mail or sms to user to let him know that his booking is confirmed
    let transporter = await nodemailer.createTransport({
      service: process.env.SERVICE,
      host: process.env.HOST,
      port: process.env.PORTMAIL,
      secure: false,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });

    const mailResponse = await transporter.sendMail({
      from: `"Yogesh Chaudhary" <${process.env.USER}>`,
      to: `${result.userData[0].email}`,
      subject: `OrderID ${body.bookingId} Status`,
      text:
        `Dear User, \n\n` +
        `Your booking having booking id ${body.bookingId} is completed. \n\n` +
        "This is an auto-generated email. Please do not reply to this email.\n\n" +
        "Regards\n" +
        "Yogesh Chaudhary\n\n",
    });

    if (!mailResponse) {
      return res
        .status(400)
        .send({ success: true, message: "Something went wrong" });
    }
    if (mailResponse.accepted.length === 0) {
      return res.status(400).send({ success: false, mailResponse });
    }
    await session.commitTransaction();
    await session.endSession();
    return res.status(200).send({
      success: true,
      message: "Booking Completed",
      // booking,
      // vendor,
      // mailResponse,
    });
  } catch (e) {
    await session.commitTransaction();
    await session.endSession();
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// @desc see  all booking of an user using userId
// @route GET vendor/booking/checkBookingStatus/:bookingId
// @acess Private
exports.checkBookingStatus = async (req, res) => {
  try {
    const { params } = req;
    let matchQuery = {
      $match: {
        $and: [
          { _id: mongoose.Types.ObjectId(params.bookingId) },
          { vendor: mongoose.Types.ObjectId(user.id) },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { bookingStatus: 1, vendor: 1 } },
            // {
            //   $lookup: {
            //     from: "users",
            //     localField: "userId",
            //     foreignField: "_id",
            //     as: "userData",
            //   },
            // },
            // {
            //   $lookup: {
            //     from: "services",
            //     localField: "service",
            //     foreignField: "_id",
            //     as: "serviceData",
            //   },
            // },
          ],
          // totalCount: [matchQuery, { $count: "count" }],
        },
      },
    ]);

    let result = data[0].totalData;

    if (result.length === 0) {
      return res.status(200).send({ success: false, message: "No Data Found" });
    }

    result = result[0];

    return res.status(200).send({
      success: true,
      message: "Bookings Fetched Successfully",
      result,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// @desc see  all booking of an user using userId
// @route GET vendor/booking/byId/:bookingId
// @acess Private
exports.getBookingsById = async (req, res) => {
  try {
    const { params } = req;
    let matchQuery = {
      $match: { _id: mongoose.Types.ObjectId(params.bookingId) },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData",
              },
            },
          ],
          // totalCount: [matchQuery, { $count: "count" }],
        },
      },
    ]);

    let result = data[0].totalData;

    if (result.length === 0) {
      return res.status(200).send({ success: false, message: "No Data Found" });
    }

    result = result[0];

    let package;
    if (
      result.item.packageId.toString() ===
      result.serviceData[0].silver._id.toString()
    ) {
      package = result.serviceData[0].silver;
    }
    if (
      result.item.packageId.toString() ===
      result.serviceData[0].gold._id.toString()
    ) {
      package = result.serviceData[0].gold;
    }
    if (
      result.item.packageId.toString() ===
      result.serviceData[0].platinum._id.toString()
    ) {
      package = result.serviceData[0].platinum;
    }
    var dob = new Date(
      result.userData[0].dateOfBirth.split("/").reverse().join("/")
    );
    var year = dob.getFullYear();
    var month = dob.getMonth();
    var day = dob.getDate();
    var today = new Date();
    var age = today.getFullYear() - year;

    if (
      today.getMonth() < month ||
      (today.getMonth() == month && today.getDate() < day)
    ) {
      age--;
    }

    result = {
      // _id: result._id,
      // packageName: package.description,
      // bookingDate: result.timeSlot.bookingDate,
      // time: `${result.timeSlot.start} - ${result.timeSlot.end}`,
      // userName: `${result.userData[0].firstName} ${result.userData[0].lastName}`,
      // address: `${result.userData[0].city}, ${result.userData[0].pincode}`,
      // location: result.userData[0].location.coordinates,

      bookingId: result._id,
      packageName: package.description,
      bookingDate: result.timeSlot.bookingDate,
      time: `${result.timeSlot.start} - ${result.timeSlot.end}`,
      userName: `${result.userData[0].firstName} ${result.userData[0].lastName}`,
      email: result.userData[0].email,
      age,
      mobile: result.userData[0].phone,
      gender: result.userData[0].gender,
      bookingStatus: result.bookingStatus,
      address: `${result.userData[0].city}, ${result.userData[0].pincode}`,
      location: result.userData[0].location.coordinates,
      userId: result.userId,
      service: result.service,
      packageId: package._id,
      amountToBePaid: result.total,
      payby: result.payby,
      paid: result.paid,
      paymentStatus: result.paymentStatus,
    };

    return res.status(200).send({
      success: true,
      message: "Bookings Fetched Successfully",
      result,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// @desc see  all booking of an user using userId
// @route GET vendor/booking
// @acess Private
exports.getBookingsVendor = async (req, res) => {
  try {
    const { user } = req;

    let matchQuery = {
      $match: { vendor: mongoose.Types.ObjectId(user.id) },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData",
              },
            },
            {
              $lookup: {
                from: "vendors",
                localField: "vendor",
                foreignField: "_id",
                as: "vendorData",
              },
            },
          ],
          totalCount: [matchQuery, { $count: "count" }],
        },
      },
    ]);

    let resultData = data[0].totalData;
    let count = data[0].totalCount;

    if (resultData.length === 0) {
      return res.status(200).send({ success: false, message: "No Data Found" });
    }

    let package;
    let newData = [];
    for (let result of resultData) {
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].silver._id.toString()
      ) {
        package = result.serviceData[0].silver;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].gold._id.toString()
      ) {
        package = result.serviceData[0].gold;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].platinum._id.toString()
      ) {
        package = result.serviceData[0].platinum;
      }

      var dob = new Date(
        result.userData[0].dateOfBirth.split("/").reverse().join("/")
      );
      var year = dob.getFullYear();
      var month = dob.getMonth();
      var day = dob.getDate();
      var today = new Date();
      var age = today.getFullYear() - year;

      if (
        today.getMonth() < month ||
        (today.getMonth() == month && today.getDate() < day)
      ) {
        age--;
      }

      let newResult = {
        bookingId: result._id,
        packageName: package.description,
        bookingDate: result.timeSlot.bookingDate,
        time: `${result.timeSlot.start} - ${result.timeSlot.end}`,
        userName: `${result.userData[0].firstName} ${result.userData[0].lastName}`,
        email: result.userData[0].email,
        age,
        mobile: result.userData[0].phone,
        gender: result.userData[0].gender,
        bookingStatus: result.bookingStatus,
        address: `${result.userData[0].city}, ${result.userData[0].pincode}`,
        location: result.userData[0].location.coordinates,
        userId: result.userId,
        service: result.service,
        packageId: package._id,
        amountToBePaid: result.total,
        payby: result.payby,
        paid: result.paid,
        paymentStatus: result.paymentStatus,
        // item: result.item,
        // package,
        // timeSlot: result.timeSlot,
        // bookingVerificationImage: result.bookingVerificationImage,
        // userData: result.userData[0],
        // vendorData: result.vendorData[0],
      };
      newData.push(newResult);
    }

    return res.status(200).send({
      success: true,
      message: "Bookings Fetched Successfully",
      newData,
      count,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// @desc see  all booking of an user using userId
// @route GET vendor/booking/today
// @acess Private
exports.getTodayBookings = async (req, res) => {
  try {
    const { user } = req;
    let date = `${new Date().getDate()}/${
      new Date().getMonth() + 1
    }/${new Date().getFullYear()}`;
    console.log(date);
    let matchQuery = {
      $match: {
        $and: [
          { vendor: mongoose.Types.ObjectId(user.id) },
          { "timeSlot.bookingDate": date },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData",
              },
            },
            {
              $lookup: {
                from: "vendors",
                localField: "vendor",
                foreignField: "_id",
                as: "vendorData",
              },
            },
          ],
          totalCount: [matchQuery, { $count: "count" }],
        },
      },
    ]);

    let resultData = data[0].totalData;
    let count = data[0].totalCount;

    if (resultData.length === 0) {
      return res.status(200).send({ success: false, message: "No Data Found" });
    }

    let package;
    let newData = [];
    for (let result of resultData) {
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].silver._id.toString()
      ) {
        package = result.serviceData[0].silver;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].gold._id.toString()
      ) {
        package = result.serviceData[0].gold;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].platinum._id.toString()
      ) {
        package = result.serviceData[0].platinum;
      }

      var dob = new Date(
        result.userData[0].dateOfBirth.split("/").reverse().join("/")
      );
      var year = dob.getFullYear();
      var month = dob.getMonth();
      var day = dob.getDate();
      var today = new Date();
      var age = today.getFullYear() - year;

      if (
        today.getMonth() < month ||
        (today.getMonth() == month && today.getDate() < day)
      ) {
        age--;
      }

      let newResult = {
        bookingId: result._id,
        packageName: package.description,
        bookingDate: result.timeSlot.bookingDate,
        time: `${result.timeSlot.start} - ${result.timeSlot.end}`,
        userName: `${result.userData[0].firstName} ${result.userData[0].lastName}`,
        email: result.userData[0].email,
        age,
        mobile: result.userData[0].phone,
        gender: result.userData[0].gender,
        bookingStatus: result.bookingStatus,
        address: `${result.userData[0].city}, ${result.userData[0].pincode}`,
        location: result.userData[0].location.coordinates,
        userId: result.userId,
        service: result.service,
        packageId: package._id,
        amountToBePaid: result.total,
        payby: result.payby,
        paid: result.paid,
        paymentStatus: result.paymentStatus,
        // item: result.item,
        // package,
        // timeSlot: result.timeSlot,
        // bookingVerificationImage: result.bookingVerificationImage,
        // userData: result.userData[0],
        // vendorData: result.vendorData[0],
      };
      newData.push(newResult);
    }

    return res.status(200).send({
      success: true,
      message: "Bookings Fetched Successfully",
      newData,
      count,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// @desc see  all booking of an user using userId
// @route GET vendor/booking/upcoming
// @acess Private
exports.getUpcomingBookings = async (req, res) => {
  try {
    const { user } = req;

    let date = `${new Date().getDate()}/${
      new Date().getMonth() + 1
    }/${new Date().getFullYear()}`;
    console.log(date);
    let matchQuery = {
      $match: {
        $and: [
          { vendor: mongoose.Types.ObjectId(user.id) },
          {
            bookingStatus: "Confirmed",
          },
          { "timeSlot.bookingDate": { $gt: date } },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData",
              },
            },
            {
              $lookup: {
                from: "vendors",
                localField: "vendor",
                foreignField: "_id",
                as: "vendorData",
              },
            },
          ],
          totalCount: [matchQuery, { $count: "count" }],
        },
      },
    ]);

    let resultData = data[0].totalData;
    let count = data[0].totalCount;

    if (resultData.length === 0) {
      return res.status(200).send({ success: false, message: "No Data Found" });
    }

    let package;
    let newData = [];
    for (let result of resultData) {
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].silver._id.toString()
      ) {
        package = result.serviceData[0].silver;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].gold._id.toString()
      ) {
        package = result.serviceData[0].gold;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].platinum._id.toString()
      ) {
        package = result.serviceData[0].platinum;
      }

      var dob = new Date(
        result.userData[0].dateOfBirth.split("/").reverse().join("/")
      );
      var year = dob.getFullYear();
      var month = dob.getMonth();
      var day = dob.getDate();
      var today = new Date();
      var age = today.getFullYear() - year;

      if (
        today.getMonth() < month ||
        (today.getMonth() == month && today.getDate() < day)
      ) {
        age--;
      }

      let newResult = {
        bookingId: result._id,
        packageName: package.description,
        bookingDate: result.timeSlot.bookingDate,
        time: `${result.timeSlot.start} - ${result.timeSlot.end}`,
        userName: `${result.userData[0].firstName} ${result.userData[0].lastName}`,
        email: result.userData[0].email,
        age,
        mobile: result.userData[0].phone,
        gender: result.userData[0].gender,
        bookingStatus: result.bookingStatus,
        address: `${result.userData[0].city}, ${result.userData[0].pincode}`,
        location: result.userData[0].location.coordinates,
        userId: result.userId,
        service: result.service,
        packageId: package._id,
        amountToBePaid: result.total,
        payby: result.payby,
        paid: result.paid,
        paymentStatus: result.paymentStatus,
        // item: result.item,
        // package,
        // timeSlot: result.timeSlot,
        // bookingVerificationImage: result.bookingVerificationImage,
        // userData: result.userData[0],
        // vendorData: result.vendorData[0],
      };
      newData.push(newResult);
    }

    return res.status(200).send({
      success: true,
      message: "Bookings Fetched Successfully",
      newData,
      count,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// @desc see  all booking of an user using userId
// @route GET vendor/booking/confirmed
// @acess Private
exports.getConfirmedBookings = async (req, res) => {
  try {
    const { user } = req;
    let matchQuery = {
      $match: {
        $and: [
          { vendor: mongoose.Types.ObjectId(user.id) },
          { bookingStatus: "Confirmed" },
        ],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
            { $project: { __v: 0 } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
            {
              $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData",
              },
            },
            {
              $lookup: {
                from: "vendors",
                localField: "vendor",
                foreignField: "_id",
                as: "vendorData",
              },
            },
          ],
          totalCount: [matchQuery, { $count: "count" }],
        },
      },
    ]);

    let resultData = data[0].totalData;
    let count = data[0].totalCount;

    if (resultData.length === 0) {
      return res.status(200).send({ success: false, message: "No Data Found" });
    }

    let package;
    let newData = [];
    for (let result of resultData) {
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].silver._id.toString()
      ) {
        package = result.serviceData[0].silver;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].gold._id.toString()
      ) {
        package = result.serviceData[0].gold;
      }
      if (
        result.item.packageId.toString() ===
        result.serviceData[0].platinum._id.toString()
      ) {
        package = result.serviceData[0].platinum;
      }

      var dob = new Date(
        result.userData[0].dateOfBirth.split("/").reverse().join("/")
      );
      var year = dob.getFullYear();
      var month = dob.getMonth();
      var day = dob.getDate();
      var today = new Date();
      var age = today.getFullYear() - year;

      if (
        today.getMonth() < month ||
        (today.getMonth() == month && today.getDate() < day)
      ) {
        age--;
      }

      let newResult = {
        bookingId: result._id,
        serviceName: package.description,
        bookingDate: result.timeSlot.bookingDate,
        time: `${result.timeSlot.start} - ${result.timeSlot.end}`,
        userName: `${result.userData[0].firstName} ${result.userData[0].lastName}`,
        email: result.userData[0].email,
        age,
        mobile: result.userData[0].phone,
        gender: result.userData[0].gender,
        bookingStatus: result.bookingStatus,
        address: `${result.userData[0].city}, ${result.userData[0].pincode}`,
        location: result.userData[0].location.coordinates,
        userId: result.userId,
        service: result.service,
        packageId: package._id,
        amountToBePaid: result.total,
        payby: result.payby,
        paid: result.paid,
        paymentStatus: result.paymentStatus,
        // item: result.item,
        // package,
        // timeSlot: result.timeSlot,
        // bookingVerificationImage: result.bookingVerificationImage,
        // userData: result.userData[0],
        // vendorData: result.vendorData[0],
      };
      newData.push(newResult);
    }

    return res.status(200).send({
      success: true,
      message: "Bookings Fetched Successfully",
      newData,
      count,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// TESTING
exports.bookingImageUpload = async (req, res) => {
  try {
    // var buf = Buffer.from(
    //   req.body.image.replace(/^data:image\/\w+;base64,/, ""),
    //   "base64"
    // );
    // const { id } = req.user;
    console.log(req.files);
    const { bookingId, type } = req.body;
    console.log(req.body);
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });
    if (!req.files) {
      return res
        .status(400)
        .send({ success: false, message: "Please upload the file" });
    }
    if (req.files.image.length > 1) {
      return res
        .status(400)
        .send({ success: false, message: "Can Upload Only 1 image" });
    }
    if (!req.files.image.mimetype.startsWith("image")) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide valid image" });
    }
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${bookingId}/${uuidv4()}.jpeg`,
      Body: req.files.image.data,
      ContentEncoding: "base64",
      ContentType: `image/jpeg`,
    };
    s3.upload(params, async (error, data) => {
      if (error) {
        return res.status(500).send(error.message);
      } else {
        let dbUrl = `bookingVerificationImage.${type}`;
        console.log(dbUrl);
        if (type === "maskSelfie") {
          const booking = await Booking.findByIdAndUpdate(
            bookingId,
            {
              "bookingVerificationImage.maskSelfie": data.Location,
            },
            { new: true }
          );
          console.log(booking);
          if (booking) {
            return res.status(200).json({
              status: true,
              message: `${type} Uploaded successfully`,
              url: booking.dbUrl,
            });
          } else {
            return res.status(400).json({
              status: false,
              message: `${type} Not uploaded`,
            });
          }
        }
        if (type === "productImage") {
          // let dbUrl = `bookingVerification.${type}`;
          // console.log(dbUrl);
          const booking = await Booking.findByIdAndUpdate(bookingId, {
            "bookingVerificationImage.productImage": data.Location,
          });
          if (booking) {
            return res.status(200).json({
              status: true,
              message: `${type} Uploaded successfully`,
              url: booking.dbUrl,
            });
          } else {
            return res.status(400).json({
              status: false,
              message: `${type} Not uploaded`,
            });
          }
        }
        return res.status(400).send({
          success: false,
          message: "Please provide the suitable type",
        });
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.toString(),
    });
  }
};

exports.deleteFormDataImage = async (req, res) => {
  try {
    const { id } = req.user;
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    let fileName = req.body.imageUrl.split("/");
    fileName =
      fileName[fileName.length - 2] + "/" + fileName[fileName.length - 1];
    const key = `${fileName}`;
    var params = { Bucket: process.env.AWS_BUCKET_NAME, Key: key };
    let booking = await booking.findById(id);

    if (!booking) {
      return res
        .status(404)
        .send({ success: false, message: "booking Doesn't Exists" });
    }

    if (booking.imageUrl !== req.body.imageUrl) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted imageUrl doesn't match with booking's imageUrl",
      });
    }

    s3.deleteObject(params, async (err) => {
      if (err)
        return res.status(500).send({
          success: false,
          message: "Something went wrong",
          error: err.message,
        });
      let booking = await booking.findByIdAndUpdate(
        id,
        { imageUrl: "" },
        { new: true }
      );
      return res.status(200).send({
        success: true,
        message: "Successfully Deleted",
        imageUrl: booking.imageUrl,
      });
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// To add minutes to the current time
function AddMinutesToDate(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

exports.sendOTPToMailAndPhone = async (req, res) => {
  try {
    const { body } = req;
    const { error, value } = Joi.object()
      .keys({
        email: Joi.string().lowercase().trim().email().required(),
        bookingId: Joi.string().required(),
        phone: Joi.string()
          .regex(/^[6-9]{1}[0-9]{9}$/)
          .required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    // async function isEmailValid(email) {
    //   return emailValidator.validate(email);
    // }

    // const { valid, reason, validators } = await isEmailValid(value.email);

    // if (!valid)
    //   return res.status(400).send({
    //     message: "Please provide a valid email address.",
    //     reason: validators[reason].reason,
    //   });

    let email_subject, email_message;

    let result = await OTP.find({
      $and: [{ _id: body.bookingId }, { verified: true }],
    });
    if (!result) {
      return res
        .status(200)
        .send({ success: false, message: "Something went wrong" });
    }
    if (result.length !== 0) {
      return res
        .status(200)
        .send({ success: true, message: "OTP is already verified" });
    }
    // Generate OTP
    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
    });
    const now = new Date();
    const expiredAt = AddMinutesToDate(now, 2);

    otp_instance = await OTP.findByIdAndUpdate(
      { _id: body.bookingId },
      {
        email: body.email,
        phone: body.phone,
        otp: otp,
        expiredAt,
        verified: false,
      },
      { new: true, upsert: true }
    );

    if (!otp_instance) {
      return res
        .status(400)
        .send({ success: false, message: "OTP instance not saved" });
    }
    const phoneMessage = require("../templates/sms/phone_verification");
    let phone_message = phoneMessage(otp);
    var options = {
      authorization:
        "XyzuMWfakTDjJdA1evG3Zncb8xmIP5BiF2LU6OgloESsqpH7YwnB4dpYPb3Hm2gyzclwA8ifZEjL691U",
      message: phone_message,
      numbers: [`${body.phone}`],
    };
    const response = await fast2sms.sendMessage(options);
    if (!response.return) {
      return res
        .status(500)
        .send({ success: false, message: "OTP Not Sent", response });
    }

    const {
      message,
      subject_mail,
    } = require("../templates/email/email_verification");
    email_message = message(otp);
    email_subject = subject_mail;
    let transporter = await nodemailer.createTransport({
      service: process.env.SERVICE,
      host: process.env.HOST,
      port: process.env.PORTMAIL,
      secure: false,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });

    const mailResponse = await transporter.sendMail({
      from: `"Yogesh Chaudhary" <${process.env.USER}>`,
      to: `${body.email}`,
      subject: email_subject,
      text: email_message,
    });

    if (!mailResponse) {
      return res.status(400).send({
        success: true,
        message: "OTP Sent Only TO Number, Something Went Wrong",
      });
    }
    if (mailResponse.accepted.length === 0) {
      return res.status(400).send({
        success: false,
        message: "OTP Sent Only TO Number, Something wrong with email",
        mailResponse,
      });
    }
    return res.status(200).send({
      success: true,
      message: "OTP Sent Successfully To Email And Phone",
      // mailResponse,
      // otp_instance,
      // response,
    });
  } catch (err) {
    const response = { Status: "Failure", Details: err.message };
    return res.status(400).send(response);
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    var currentdate = new Date();
    const { otp, email, bookingId, phone } = req.body;

    const verifySchema = Joi.object()
      .keys({
        otp: Joi.number().required(),
        email: Joi.string().lowercase().trim().email(),
        bookingId: Joi.string().required(),
        phone: Joi.string()
          .regex(/^[6-9]{1}[0-9]{9}$/)
          .required(),
      })
      .required();
    const { error } = verifySchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }

    let otp_instance = await OTP.aggregate([
      {
        $match: {
          $and: [
            { _id: mongoose.Types.ObjectId(bookingId) },
            { $or: [{ email }, { phone }] },
          ],
        },
      },
    ]);
    if (!otp_instance) {
      return res
        .status(500)
        .send({ success: false, message: "Something went wrong" });
    }
    if (otp_instance.length === 0) {
      return res.status(404).send({ success: false, message: "No Data Found" });
    }
    otp_instance = otp_instance[0];

    //Check if OTP is available in the DB
    if (otp_instance != null) {
      //Check if OTP is already used or not
      if (otp_instance.verified != true) {
        //Check if OTP is expired or not
        console.log(otp_instance.expiredAt.getTime(), currentdate.getTime());
        if (otp_instance.expiredAt.getTime() > currentdate.getTime()) {
          //Check if OTP is equal to the OTP in the DB
          if (+otp === otp_instance.otp) {
            await OTP.findByIdAndUpdate(
              bookingId,
              { verified: true },
              { new: true }
            );
            const response = {
              Status: "Success",
              Details: "OTP Matched",
              email,
              phone,
            };
            return res.status(200).send(response);
          } else {
            const response = { Status: "Failure", Details: "OTP NOT Matched" };
            return res.status(400).send(response);
          }
        } else {
          const response = { Status: "Failure", Details: "OTP Expired" };
          return res.status(400).send(response);
        }
      } else {
        const response = { Status: "Failure", Details: "OTP Already Used" };
        return res.status(400).send(response);
      }
    } else {
      const response = { Status: "Failure", Details: "Bad Request" };
      return res.status(400).send(response);
    }
  } catch (err) {
    const response = { Status: "Failure", Details: err.message };
    return res.status(400).send(response);
  }
};
