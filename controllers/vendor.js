const { Vendor } = require("../models/vendor");
const path = require("path");
const Joi = require("joi");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const axios = require("axios");
const { createToken } = require("../helpers/refreshToken");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const { geocoder } = require("../helpers/geoCoder");
const Booking = require("../models/booking");
const nodemailer = require("nodemailer");

// ************************************Vendor************************************************************************************//
//@desc login using number
//@route POST/vendor/loginVendor
//@access Private
exports.loginVendor = async (req, res) => {
  try {
    const { body } = req;
    const { error } = Joi.object()
      .keys({
        mobileNumber: Joi.string()
          .regex(/^[6-9]{1}[0-9]{9}$/)
          .required(),
      })
      .required()
      .validate(body);

    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    // https://2factor.in/API/V1/API_KEY/SMS/PHONE_NUMBER/AUTOGEN
    const result = await axios.get(
      `https://2factor.in/API/V1/c7573668-cfde-11ea-9fa5-0200cd936042/SMS/${body.mobileNumber}/AUTOGEN`
    );
    res.status(200).json({ success: true, message: "OTP Sent Successfully" });
  } catch (e) {
    res
      .status(500)
      .json({ success: false, message: "Something went wrong", error: e.name });
  }
};

//@desc verify OTP for vendor using number
//@route POST/vendor/verifyOTP
//@access Private
exports.verifyOTP = async (req, res) => {
  try {
    const { body } = req;

    const verifySchema = Joi.object()
      .keys({
        otp: Joi.number().min(100000).max(999999).required(),
        mobileNumber: Joi.string()
          .regex(/^[6-9]{1}[0-9]{9}$/)
          .required(),
      })
      .required();
    const { error } = verifySchema.validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }

    try {
      const { otp, mobileNumber } = body;
      // https://2factor.in/API/V1/API_KEY/SMS/VERIFY/SESSION_ID/OTP_VALUE
      const result = await axios.get(
        `https://2factor.in/API/V1/c7573668-cfde-11ea-9fa5-0200cd936042/SMS/VERIFY3/${mobileNumber}/${otp}`
      );

      if (result.data.Details === "OTP Expired") {
        return res.status(410).send({ success: false, message: "OTP Expired" });
      }

      if (result.data.Details !== "OTP Matched") {
        return res
          .status(401)
          .send({ success: false, message: "OTP Not Matched" });
      }

      let vendor = await Vendor.findOne({ mobileNumber });

      if (!vendor) {
        vendor = new Vendor({ mobileNumber: body.mobileNumber });

        vendor = await vendor.save();

        let token = jwt.sign({ id: vendor._id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRY,
        });
        let refreshToken = await createToken(vendor);
        return res.status(201).send({
          success: true,
          message: "Vendor doesn't exist but data saved wth phone number",
          vendor,
          token,
          refreshToken,
        });
      }

      let token = jwt.sign({ id: vendor._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRY,
      });

      let refreshToken = await createToken(vendor);
      return res.status(200).send({
        success: true,
        message: "Welcome Back",
        token,
        vendor,
        refreshToken,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Invalid OTP", error: e.message });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: e.name });
  }
};

//@desc update the vendors details
//@route GET/vendor/signUp
//@access Private
exports.signUp = async (req, res) => {
  try {
    const { id } = req.user;
    const { body } = req;
    const { error } = Joi.object()
      .keys({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        DOB: Joi.date().required(),
        workExperience: Joi.string(),
        gender: Joi.string().required(),
        alternateNumber: Joi.number(),
        emergencyNumber: Joi.number(),
        currentAddress: Joi.object().keys({
          address: Joi.string().required(),
          city: Joi.string().required(),
          state: Joi.string().required(),
          pin: Joi.number().required(),
        }),
        permanentAddress: Joi.object().keys({
          address: Joi.string().required(),
          city: Joi.string().required(),
          state: Joi.string().required(),
          pin: Joi.number().required(),
        }),
        email: Joi.string().email().required(),
        timeSlot: Joi.array().items(
          Joi.object().keys({
            start: Joi.string(),
            end: Joi.string(),
            booked: Joi.boolean(),
          })
        ),
        longitude: Joi.number(),
        latitude: Joi.number(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const vendor = await Vendor.findByIdAndUpdate(id, body, { new: true });
    if (!vendor) {
      return res.status(404).send({
        success: false,
        message:
          "No data found, id you are passing in token not exists,If you have logged in by your number please provide valid token otherwise login/signup first with your number",
      });
    }

    let address = `${vendor.currentAddress.city},${vendor.currentAddress.state},${vendor.currentAddress.pin}`;

    const loc = await geocoder.geocode(address);

    let longitude = req.body.longitude || loc[0].longitude;
    let latitude = req.body.latitude || loc[0].latitude;
    vendor.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    vendor
      .save()
      .then(async (vendor) => {
        return res.status(200).send({
          success: true,
          message: "Vendor saved successfully",
          vendor,
        });
      })
      .catch((e) => {
        return res
          .status(400)
          .send({ success: false, message: "Vendor not saved", e: e.message });
      });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc update the vendors verification
//@route PUT/vendor/aadharVerification
//@access Private
exports.aadharVerification = async (req, res) => {
  try {
    const { id } = req.user;
    const { body } = req;
    const { error } = Joi.object()
      .keys({
        aadharFront: Joi.string().required(),
        aadharBack: Joi.string().required(),
        selfie1: Joi.string().required(),
        selfie2: Joi.string().required(),
        pancard: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      id,
      {
        verification: {
          aadharFront: body.aadharFront,
          aadharBack: body.aadharBack,
          selfie1: body.selfie1,
          selfie2: body.selfie2,
          pancard: body.pancard,
        },
      },
      { new: true }
    );
    if (!vendor) {
      return res.status(200).send({
        success: true,
        message:
          "No data found, id you are passing in token not exists,If you have logged in by your number please provide valid token otherwise login/signup first with your number",
      });
    }

    vendor
      .save()
      .then(async (vendor) => {
        return res.status(200).send({
          success: true,
          message: "Vendor saved successfully",
          vendor,
        });
      })
      .catch((e) => {
        return res
          .status(400)
          .send({ success: false, message: "Vendor not saved" });
      });
  } catch (e) {
    res.status(500).send({ success: false, message: e.name });
  }
};

//@desc update the vendor bankAccountDetails
//@route PUT/vendor/bankDetails
//@access Private
exports.addBankAccountDetails = async (req, res) => {
  try {
    const { id } = req.user;
    const { body } = req;
    const { error } = Joi.object()
      .keys({
        bankName: Joi.string().required(),
        accountNumber: Joi.number().required(),
        accountHolder: Joi.string().required(),
        ifscCode: Joi.string().required(),
        upi: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      id,
      {
        bankDetails: {
          bankName: body.bankName,
          accountNumber: body.accountNumber,
          accountHolder: body.accountHolder,
          ifscCode: body.ifscCode,
          upi: body.upi,
        },
      },
      { new: true }
    );
    if (!vendor) {
      return res.status(200).send({
        success: true,
        message:
          "No data found, id you are passing in token not exists,If you have logged in by your number please provide valid token otherwise login/signup first with your number",
      });
    }

    vendor
      .save()
      .then(async (vendor) => {
        return res.status(200).send({
          success: true,
          message: "Vendor saved successfully",
          vendor,
        });
      })
      .catch((e) => {
        return res
          .status(400)
          .send({ success: false, message: "Vendor not saved" });
      });
  } catch (e) {
    res.status(500).send({ success: false, message: e.name });
  }
};

//@desc update the vendors liveCoordinates
//@route PUT/vendor/coordinates
//@access Private
exports.updateCoordinates = async (req, res) => {
  try {
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        longitude: Joi.number().required(),
        latitude: Joi.number().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      { _id: user.id },
      { "location.coordinates": [body.longitude, body.latitude] },
      { new: true }
    );
    if (!vendor) {
      return res.status(404).send({
        success: false,
        message: "No data found",
      });
    }
    return res.status(200).send({
      success: true,
      message: "Vendor coordiantes updated successfully",
      vendor,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc vendor Request For Services
//@route PUT/vendor/requestService
//@access Private
exports.requestForService = async (req, res) => {
  try {
    const { user, body } = req;
    const { error } = Joi.object()
      .keys({
        requestedService: Joi.array().items(Joi.string()).required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    let vendor = await Vendor.findByIdAndUpdate(
      { _id: user.id },
      { $addToSet: { requestedService: { $each: body.requestedService } } },
      { new: true }
    );
    if (!vendor) {
      return res.status(400).send({
        success: false,
        message: "Vendor Doesn't Exists",
      });
    }
    return res.status(200).send({
      success: true,
      message:
        "Requested For Service successfully,Your services will be activated withing 24 hrs",
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

//@desc login with vendor's Id password after admin's confirmtion admin send the Id and password over mail
//@route PUT/vendor/login2
//@access Private
exports.loginVendor2 = async (req, res) => {
  try {
    let { vendorId, password } = req.body;
    const { error } = Joi.object()
      .keys({
        vendorId: Joi.string().required(),
        password: Joi.string().required(),
      })
      .required()
      .validate(req.body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    if (!(vendorId && password)) {
      return res
        .status(400)
        .send({ success: false, message: "Please fill all the details" });
    }

    let vendor = await Vendor.findOne({ email: vendorId });

    if (!vendor) {
      return res.status(400).send({
        success: false,
        message: "Invalid credentials,Email Incorrect",
      });
    }
    const isPasswordMatched = await bcrypt.compare(password, vendor.password);
    if (!isPasswordMatched) {
      return res.status(400).send({
        success: false,
        message: "Invalid credentials,Pasword Incorrect",
      });
    }
    let token = jwt.sign({ id: vendor._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY,
    });

    return res.status(200).send({
      success: true,
      message: "Vendor logged in Successsfully!",
      token,
      vendor,
    });
  } catch (e) {
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.name,
    });
  }
};

//@desc update the vendor's password
//@route PUT/vendor/password
//@access Private
exports.updatePassword = async (req, res) => {
  try {
    const { id } = req.user;
    const { password, updatePassword } = req.body;
    const { error } = Joi.object()
      .keys({
        password: Joi.string().required(),
        updatePassword: Joi.string().required(),
      })
      .required()
      .validate(req.body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    let vendor = await Vendor.findById(id);
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "No Vendor Exists" });
    }

    const isPasswordMatched = await bcrypt.compare(password, vendor.password);

    if (!isPasswordMatched) {
      return res.status(400).send({
        success: false,
        message:
          "Pasword Incorrect, Please Enter Correct Password To Update Password",
      });
    }
    let hashedPassword = await bcrypt.hash(updatePassword, 10);
    vendor = await Vendor.findByIdAndUpdate(
      id,
      { password: hashedPassword },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(400)
        .send({ success: false, message: "Password not updated" });
    }
    return res.status(200).send({
      success: true,
      message: "Password updated successfully",
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

//@desc admin send booking to nearbyvendors and vendor will confirm/transfer the booking
//@route PUT vendor/confirmBooking
//@access Private
exports.confirmBooking = async (req, res) => {
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
        totalCount: [matchQuery, { $count: "count" }],
      },
    },
  ]);

  let result = data[0].totalData;
  let count = data[0].totalCount;

  if (result.length === 0) {
    return res.status(404).send({ success: false, message: "No Data Found" });
  }
  result = result[0];
  console.log(result);
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
};

// *********************************************UPLOAD_IMAGE************************************************************************ //

//@desc Upload profile photo express-fileupload
//@route PUT/vendor/photo
//@access Private
//DON'T USE IT
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const { id } = req.user;
    // console.log(req.files.profilePhoto);
    const { files } = req;

    let vendor = await Vendor.findById(id);
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    if (!files) {
      return res
        .status(400)
        .send({ success: false, message: "Please upload the file" });
    }

    // const arr = [];
    // for (let profilePhoto of profilePhoto) {
    //   for (let key in profilePhoto) {
    //     if (key === "name") arr.push(profilePhoto[key]);
    //   }
    // }

    console.log(files.profilePhoto);
    if (!files.profilePhoto.mimetype.startsWith("image")) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide valid image" });
    }
    // if (files.profilePhoto.size > process.env.MAX_FILE_UPLOAD) {
    //   return res.status(400).send({
    //     success: false,
    //     message: `Please Upload an image less than ${process.env.MAX_FILE_UPLOAD}`,
    //   });
    // }
    files.profilePhoto.name = `photo_${vendor._id}${
      path.parse(files.profilePhoto.name).ext
    }`;
    files.profilePhoto.mv(
      `${process.env.FILE_UPLOAD_PATH}/${files.profilePhoto.name}`,
      async (error) => {
        if (error) {
          return res
            .status(500)
            .send({ success: false, message: "Problem with upload", error });
        }
        vendor = await Vendor.findByIdAndUpdate(
          id,
          { profilePhoto: files.profilePhoto.name },
          { new: true }
        );

        return res.status(200).send({
          success: true,
          message: "Photo Uploaded successfully",
          vendor,
        });
        // if (!vendor) {
        //   return res.status(200).send({
        //     success: true,
        //     message:
        //       "No data found, id you are passing in token not exists,If you have logged in by your number please provide valid token otherwise login/signup first with your number",
        //   });
        // }
        // vendor
        //   .save()
        //   .then(async (vendor) => {
        //     return res.status(200).send({
        //       success: true,
        //       message: "Vendor saved successfully",
        //       vendor,
        //     });
        //   })
        //   .catch((e) => {
        //     return res
        //       .status(400)
        //       .send({ success: false, message: "Vendor not saved" });
        //   });
      }
    );

    // console.log(arr);
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc get Signed Url S3
//@route GET/vendor/s3Url
//@access Private
//DON'T USE IT
exports.s3Url = async (req, res) => {
  try {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });
    const { id } = req.user;
    const key = `${id}/${uuidv4()}.jpeg`;
    const url = await s3.getSignedUrlPromise("putObject", {
      Bucket: process.env.AWS_BUCKET_NAME,
      ContentType: "image/jpeg",
      Key: key,
      Expires: 120,
    });
    return res
      .status(200)
      .send({ success: true, message: "Url generated", url, key });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3Url1
//@access Private
exports.s3Url1 = async (req, res) => {
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
exports.updateImageUrl = async (req, res) => {
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
exports.deleteImageUrl = async (req, res) => {
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
