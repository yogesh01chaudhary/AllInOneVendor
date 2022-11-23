const { Vendor } = require("../models/vendor");
const Joi = require("joi");
const Booking = require("../models/booking");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

//@desc admin send booking to nearbyvendors and vendor will confirm the booking
//@route PUT vendor/booking/confirmBooking
//@access Private
exports.confirmBooking = async (req, res) => {
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
          { bookingStatus: "Pending" },
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
      body.bookingId,
      {
        bookingStatus: "Confirmed",
        vendor: user.id,
      },
      { upsert: true, new: true }
    );
    if (!booking) {
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
      subject: `OrderID ${body.bookingId} Status`,
      text:
        `Dear User, \n\n` +
        `Your booking having booking id ${body.bookingId} is confirmed. \n\n` +
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
    return res.status(200).send({
      success: true,
      message: "Booking Confirmed",
      booking,
      mailResponse,
    });
  } catch (e) {
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
exports.transferBooking = async (req, res) => {try {
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
            { bookingStatus: "Pending" },
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
    console.log(vendor.transferCount);
    if (!vendor.transferCount) {
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          "transferCount.count": 1,
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
    console.log(vendor.transferCount.count);
    if (vendor.transferCount.count !== 3) {
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          "transferCount.count": vendor.transferCount.count + 1,
        },
        { new: true }
      );
      return res.status(200).send({
        success: true,
        message: "Transfer",
        vendor,
      });
    }
    return res
      .status(200)
      .send({
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
  }};

//@desc admin send booking to nearbyvendors and vendor will confirm the booking
//@route PUT vendor/booking/complete
//@access Private
exports.completeBooking = async (req, res) => {
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
          { bookingStatus: "Confirmed" },
          { vendor: user.id },
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
      body.bookingId,
      {
        bookingStatus: "Completed",
      },
      { new: true }
    );

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
    return res.status(200).send({
      success: true,
      message: "Booking Completed",
      booking,
      mailResponse,
    });
  } catch (e) {
    return res.status(400).send({
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

    let result = data[0].totalData;
    let count = data[0].totalCount;

    if (result.length === 0) {
      return res.status(200).send({ success: false, message: "No Data Found" });
    }

    return res.status(200).send({
      success: true,
      message: "Bookings Fetched Successfully",
      result,
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

// ******************************************SELFIE_WITH_MASK******************************************************************************//
//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3Url1
//@access Private
exports.s3UrlMaskSelfie = async (req, res) => {
  try {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });
    const { id } = req.user;
    let vendor = await Vendor.findById(id);
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    if (!vendor.imageUrl) {
      const key = `${id}/${uuidv4()}.jpeg`;
      const url = await s3.getSignedUrlPromise("putObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        ContentType: "image/jpeg",
        Key: key,
        Expires: 120,
      });
      return res.status(200).send({
        success: true,
        message: "Url generated , imageUrl doesn't exists in DB",
        url,
        key,
      });
    }

    let fileName = vendor.imageUrl.split("/");
    fileName =
      fileName[fileName.length - 2] + "/" + fileName[fileName.length - 1];
    console.log("filename", fileName);
    const key = `${fileName}`;
    const url = await s3.getSignedUrlPromise("putObject", {
      Bucket: process.env.AWS_BUCKET_NAME,
      ContentType: "image/jpeg",
      Key: key,
      Expires: 60,
    });
    return res
      .status(200)
      .send({ success: true, message: "Url generated", url, key });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc Upload imageUrl in DB using  S3
//@route PUT/vendor/imageUrl
//@access Private
exports.updateMaskSelfie = async (req, res) => {
  try {
    const { user, body } = req;
    Joi.object()
      .keys({
        body: Joi.object().keys({
          imageUrl: Joi.string().required(),
        }),
        user: Joi.object().keys({
          id: Joi.string().required(),
        }),
      })
      .required()
      .validate(req);
    let vendor = await Vendor.findByIdAndUpdate(
      user.id,
      { imageUrl: body.imageUrl },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res
      .status(200)
      .send({ success: true, message: "Image Url Updated", vendor });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc delete image from s3 Bucket and DB
//@route DELETE vendor/imageUrl
//@access Private
exports.deleteMaskSelfie = async (req, res) => {
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
    let vendor = await Vendor.findById(id);

    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }

    if (vendor.imageUrl !== req.body.imageUrl) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted imageUrl doesn't match with Vendor's imageUrl",
      });
    }

    s3.deleteObject(params, async (err) => {
      if (err)
        return res.status(500).send({
          success: false,
          message: "Something went wrong",
          error: err.message,
        });
      let vendor = await Vendor.findByIdAndUpdate(
        id,
        { imageUrl: "" },
        { new: true }
      );
      return res
        .status(200)
        .send({ success: true, message: "Successfully Deleted", vendor });
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// ******************************************PRODUCTS_IMAGE_UPLOAD******************************************************************************//
//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3Url1
//@access Private
exports.s3UrlProduct = async (req, res) => {
  try {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });
    const { id } = req.user;
    let vendor = await Vendor.findById(id);
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    if (!vendor.imageUrl) {
      const key = `${id}/${uuidv4()}.jpeg`;
      const url = await s3.getSignedUrlPromise("putObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        ContentType: "image/jpeg",
        Key: key,
        Expires: 120,
      });
      return res.status(200).send({
        success: true,
        message: "Url generated , imageUrl doesn't exists in DB",
        url,
        key,
      });
    }

    let fileName = vendor.imageUrl.split("/");
    fileName =
      fileName[fileName.length - 2] + "/" + fileName[fileName.length - 1];
    console.log("filename", fileName);
    const key = `${fileName}`;
    const url = await s3.getSignedUrlPromise("putObject", {
      Bucket: process.env.AWS_BUCKET_NAME,
      ContentType: "image/jpeg",
      Key: key,
      Expires: 60,
    });
    return res
      .status(200)
      .send({ success: true, message: "Url generated", url, key });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc Upload imageUrl in DB using  S3
//@route PUT/vendor/imageUrl
//@access Private
exports.updateProductUrl = async (req, res) => {
  try {
    const { user, body } = req;
    Joi.object()
      .keys({
        body: Joi.object().keys({
          imageUrl: Joi.string().required(),
        }),
        user: Joi.object().keys({
          id: Joi.string().required(),
        }),
      })
      .required()
      .validate(req);
    let vendor = await Vendor.findByIdAndUpdate(
      user.id,
      { imageUrl: body.imageUrl },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res
      .status(200)
      .send({ success: true, message: "Image Url Updated", vendor });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc delete image from s3 Bucket and DB
//@route DELETE vendor/imageUrl
//@access Private
exports.deleteProductUrl = async (req, res) => {
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
    let vendor = await Vendor.findById(id);

    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }

    if (vendor.imageUrl !== req.body.imageUrl) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted imageUrl doesn't match with Vendor's imageUrl",
      });
    }

    s3.deleteObject(params, async (err) => {
      if (err)
        return res.status(500).send({
          success: false,
          message: "Something went wrong",
          error: err.message,
        });
      let vendor = await Vendor.findByIdAndUpdate(
        id,
        { imageUrl: "" },
        { new: true }
      );
      return res
        .status(200)
        .send({ success: true, message: "Successfully Deleted", vendor });
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// TESTING
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
    console.log(vendor.transferCount);
    if (!vendor.transferCount) {
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          "transferCount.count": 1,
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
    console.log(vendor.transferCount.count);
    if (vendor.transferCount.count !== 3) {
      vendor = await Vendor.findByIdAndUpdate(
        user.id,
        {
          "transferCount.count": vendor.transferCount.count + 1,
        },
        { new: true }
      );
      return res.status(200).send({
        success: true,
        message: "Transfer",
        vendor,
      });
    }
    return res
      .status(200)
      .send({
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
