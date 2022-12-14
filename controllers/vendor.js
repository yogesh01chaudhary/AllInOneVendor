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
const mongoose = require("mongoose");
const Mail = require("../models/mail");
const nodemailer = require("nodemailer");
const emailValidator = require("deep-email-validator");

// ************************************Vendor************************************************************************************//

// **********************************loginAndVerifyVendorUsingNumber********************************************************************************//
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
      const result = await axios.get(
        `https://2factor.in/API/V1/c7573668-cfde-11ea-9fa5-0200cd936042/SMS/VERIFY3/${mobileNumber}/${otp}`
      );

      if (result.data.Details === "OTP Expired") {
        return res.status(410).send({ success: false, message: "OTP Expired" });
      }

      if (result.data.Details === "OTP Mismatch") {
        return res
          .status(401)
          .send({ success: false, message: "OTP Mismatch" });
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
          message: "Registered Successfully",
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

// *********************************signUp****************************************************************************//
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
        alternateNumber: Joi.string()
          .regex(/^[6-9]{1}[0-9]{9}$/)
          .required(),
        emergencyNumber: Joi.string()
          .regex(/^[6-9]{1}[0-9]{9}$/)
          .required(),
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
        longitude: Joi.number(),
        latitude: Joi.number(),
        deviceToken: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }

    let vendor = await Vendor.findByIdAndUpdate(id, body, { new: true });

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
          message: "Vendor Profile Updated successfully",
        });
      })
      .catch((e) => {
        return res.status(400).send({
          success: false,
          message: "SignedUp Failed",
          error: e.message,
        });
      });
  } catch (e) {
    res.status(500).send({
      success: false,
      error: e.message,
      message: "Something went wrong",
    });
  }
};

// **********************************updateEmailWithoutOTPVerification**********************************************************************************//
//@desc update the vendors details
//@route GET/vendor/email
//@access Private
exports.updateEmail = async (req, res) => {
  try {
    const { id } = req.user;
    const { body } = req;
    const { error, value } = Joi.object()
      .keys({
        email: Joi.string().lowercase().trim().email().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    let vendor = await Vendor.find({ email: value.email });
    if (!vendor) {
      return res.status(500).send({
        success: false,
        message: "Something went wrong",
      });
    }
    if (vendor[0]) {
      return res.status(400).send({
        success: false,
        message: "Email must be unique",
      });
    }
    vendor = await Vendor.findByIdAndUpdate(id, value, { new: true });

    vendor
      .save()
      .then(async (vendor) => {
        return res.status(200).send({
          success: true,
          message: "Email Updated Successfully",
        });
      })
      .catch((e) => {
        return res.status(400).send({
          success: false,
          message: "Email Not Updated",
          error: e.message,
        });
      });
  } catch (e) {
    res.status(500).send({
      success: false,
      error: e.message,
      message: "Something went wrong",
    });
  }
};

// *************************************addBankDetails*****************************************************************************//
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
        message: "No vendor Found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "Bank Details saved successfully",
      bankDetails: vendor.bankDetails,
    });
  } catch (e) {
    res
      .status(500)
      .send({ success: false, error: e.name, message: "Something went wrong" });
  }
};

// **************************************updateCoordinates*****************************************************************************//
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
      location: vendor.location,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// *************************************vendorRequestingForService******************************************************************************//
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
      requestedService: vendor.requestedService,
    });
  } catch (e) {
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// *********************************************getMyProfile**************************************************************************//
//@desc vendor Request For Services
//@route PUT/vendor/profile
//@access Private
exports.getMyProfile = async (req, res) => {
  try {
    const myProfile = await Vendor.findById(req.user.id);
    if (myProfile) {
      let result = {
        UID: myProfile._id,
        // name: `${myProfile.firstName} ${myProfile.lastName}`,
        firstName: myProfile.firstName,
        lastName: myProfile.lastName,
        DOB: myProfile.DOB,
        email: myProfile.email,
        mobileNumber: myProfile.mobileNumber,
        alternateNumber: myProfile.alternateNumber,
        emergencyNumber: myProfile.emergencyNumber,
        workExperence: myProfile.workExperience,
        city: myProfile.currentAddress.city,
        imageUrl: myProfile.imageUrl,
        deviceToken: myProfile.deviceToken,
        permanentAddress: myProfile.permanentAddress,
        currentAddress: myProfile.currentAddress,
        gender: myProfile.gender,
      };
      return res.status(200).json({
        success: true,
        message: "Profile Fetched Successfully",
        result,
        // myProfile,
      });
    }
    return res
      .status(404)
      .json({ success: false, message: "Vendor Doesn't Exist" });
  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// **************************************loginVendorUsingEmailAndUpdatePassword******************************************************************************//
//@desc login with vendor's Id password after admin's confirmtion admin send the Id and password over mail
//@route PUT/vendor/login2
//@access Private
exports.loginVendor2 = async (req, res) => {
  try {
    let { email, password } = req.body;
    const { error, value } = Joi.object()
      .keys({
        email: Joi.string().trim().lowercase().email().required(),
        password: Joi.string().required(),
      })
      .required()
      .validate(req.body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    if (!(email && password)) {
      return res
        .status(400)
        .send({ success: false, message: "Please fill all the details" });
    }

    let vendor = await Vendor.findOne({ email: value.email });

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
    let refreshToken = await createToken(vendor);
    return res.status(200).send({
      success: true,
      message: "Vendor logged in Successsfully!",
      token,
      refreshToken,
    });
  } catch (e) {
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
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

    const isPasswordMatched = bcrypt.compare(password, vendor.password);

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
    });
  } catch (e) {
    return res.status(400).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// *********************************************UPLOAD_IMAGE*******NOT_IN_USE*****REFERENCE_PURPOSE************************************************************ //
//NOT_IN_USE ONLY FOR REFERENCE
//EXTRA
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

//EXTRA
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

//NOT_USED REFERENCE
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.addTimeSlot = async (req, res) => {
  try {
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        timeSlot: Joi.array().items({
          start: Joi.string().required(),
          end: Joi.string().required(),
          bookingDate: Joi.string(),
        }),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      user.id,
      {
        $addToSet: { timeSlot: { $each: body.timeSlot } },
      },
      { new: true }
    );
    if (!vendor) {
      return res.status(200).send({
        success: true,
        message: "No vendor Found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "Vendor saved successfully with timeSlot",
      timeSlot: vendor.timeSlot,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// *****************************requestForLeave/EmergencyLeave*****************************************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.requestLeave = async (req, res) => {
  try {
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        start: Joi.string().required(),
        end: Joi.string().required(),
        reason: Joi.string().required(),
      })

      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      user.id,
      {
        $addToSet: {
          onLeave: { start: body.start, end: body.end, reason: body.reason },
        },
      },
      { new: true }
    );
    if (!vendor) {
      return res.status(200).send({
        success: true,
        message: "No vendor Found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "Vendor Requested For leave",
      onLeave: vendor.onLeave,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.requestEmergencyLeave = async (req, res) => {
  try {
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        date: Joi.string().required(),
        reason: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const vendor = await Vendor.findByIdAndUpdate(
      user.id,
      {
        $addToSet: { emergencyLeave: { date: body.date, reason: body.reason } },
      },
      { new: true }
    );
    if (!vendor) {
      return res.status(200).send({
        success: true,
        message: "No vendor Found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "Vendor Requested For leave",
      emergencyLeave: vendor.emergencyLeave,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// **********************************login/logoutTime***************************************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.loginTime = async (req, res) => {
  try {
    const { body, user } = req;
    // const { error } = Joi.object()
    //   .keys({
    //     bookingId: Joi.string().required(),
    //   })
    //   .required()
    //   .validate(body);
    // if (error) {
    //   return res
    //     .status(400)
    //     .send({ success: false, message: error.details[0].message });
    // }
    // let matchQuery = {
    //   $match: {
    //     $and: [
    //       { _id: mongoose.Types.ObjectId(body.bookingId) },
    //       { bookingStatus: "Confirmed" },
    //     ],
    //   },
    // };

    // let data = await Booking.aggregate([
    //   {
    //     $facet: {
    //       totalData: [
    //         matchQuery,
    //         { $project: { __v: 0 } },
    //         {
    //           $lookup: {
    //             from: "users",
    //             localField: "userId",
    //             foreignField: "_id",
    //             as: "userData",
    //           },
    //         },
    //       ],
    //     },
    //   },
    // ]);

    // let result = data[0].totalData;

    // if (result.length === 0) {
    //   return res
    //     .status(404)
    //     .send({ success: false, message: "Booking Not Found" });
    // }
    // result = result[0];
    let vendor = await Vendor.findOneAndUpdate(
      {
        _id: user.id,
        onDutyStatus: false,
      },
      {
        $addToSet: { onDuty: { loginTime: Date.now() } },
        // "onDuty.loginTime": Date.now(),
        onDutyStatus: true,
        //   "bookings.$[elem].endTime": Date.now(),
      },
      {
        // arrayFilters: [
        //   { "elem.bookingId": mongoose.Types.ObjectId(body.bookingId) },
        // ],
        new: true,
      }
    );
    if (!vendor) {
      return res.status(404).send({
        success: false,
        message:
          "May Be Vendor is onDuty Already Logged In or Vendor not found",
      });
    }
    return res.status(200).send({
      success: true,
      onDutyStatus: vendor.onDutyStatus,
      onDuty: vendor.onDuty,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.logoutTime = async (req, res) => {
  try {
    const { body, user } = req;
    // const { error } = Joi.object()
    //   .keys({
    //     bookingId: Joi.string().required(),
    //   })
    //   .required()
    //   .validate(body);
    // if (error) {
    //   return res
    //     .status(400)
    //     .send({ success: false, message: error.details[0].message });
    // }
    // let matchQuery = {
    //   $match: {
    //     $and: [
    //       { _id: mongoose.Types.ObjectId(body.bookingId) },
    //       { bookingStatus: "Confirmed" },
    //     ],
    //   },
    // };

    // let data = await Booking.aggregate([
    //   {
    //     $facet: {
    //       totalData: [
    //         matchQuery,
    //         { $project: { __v: 0 } },
    //         {
    //           $lookup: {
    //             from: "users",
    //             localField: "userId",
    //             foreignField: "_id",
    //             as: "userData",
    //           },
    //         },
    //       ],
    //     },
    //   },
    // ]);

    // let result = data[0].totalData;

    // if (result.length === 0) {
    //   return res
    //     .status(404)
    //     .send({ success: false, message: "Booking Not Found" });
    // }
    // result = result[0];

    let vendor = await Vendor.findOneAndUpdate(
      {
        _id: user.id,
        onDutyStatus: true,
        // onDuty: {
        //   loginTime: { $exists: true },
        //   logoutTime: { $exists: false },
        // },
      },
      {
        // $addToSet: { onDuty: { logoutTime: Date.now() } },
        // "onDuty.loginTime": Date.now(),
        onDutyStatus: false,
        "onDuty.$[elem].logoutTime": Date.now(),
      },
      {
        arrayFilters: [
          {
            "elem.logoutTime": { $exists: false },
          },
        ],
        new: true,
      }
    );
    if (!vendor) {
      return res.status(404).send({
        success: false,
        message:
          "May Be Vendor is offDuty Already Logged Out or Vendor not found",
      });
    }
    return res.status(200).send({
      success: true,
      onDutyStatus: vendor.onDutyStatus,
      onDuty: vendor.onDuty,
    });
  } catch (e) {
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
      error: e.message,
    });
  }
};

// ********************************checkReviews********************************************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.getReviews = async (req, res) => {
  try {
    const { user } = req;
    let vendor = await Vendor.findById(user.id, {
      "reviews.rating": 1,
      "reviews.name": 1,
      "reviews.comment": 1,
      "reviews.user": 1,
      rating: 1,
      reviewNumber: 1,
    });
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res.status(200).send({
      success: true,
      reviews: vendor.reviews,
      rating: vendor.rating,
      totalReviews: vendor.reviewNumber,
    });
  } catch (e) {
    return res.status(500).send({ success: false, message: e.message });
  }
};

// *******************************uploadAndDeleteBookingImage***********************************************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.base64ImageUpload = async (req, res) => {
  try {
    const { error } = Joi.object()
      .keys({
        image: Joi.string(),
        uploadFor: Joi.string().required(),
      })
      .required()
      .validate(req.body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const { id } = req.user;
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    var image;
    if (!req.files && !req.body.image) {
      return res
        .status(400)
        .send({ success: false, message: "Please upload the file" });
    }

    if (req.files) {
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
      image = req.files.image.data;
    }

    if (req.body.image) {
      image = Buffer.from(
        req.body.image.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
    }

    const uploadToS3 = async (uploadType, vendor) => {
      let check = uploadType.split(".");
      let found;
      if (check.length == 1) {
        found = vendor[`${check[0]}`];
      }
      if (check.length == 2) {
        found = vendor[`${check[0]}`][`${check[1]}`];
      }
      if (found) {
        let key = found.split("/");
        key = key[key.length - 2] + "/" + key[key.length - 1];
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
          Body: image,
          ContentEncoding: "base64",
          ContentType: `image/jpeg`,
        };
        s3.upload(params, async (error, data) => {
          if (error) {
            return res.status(500).send(error.message);
          } else {
            const vendor = await Vendor.findByIdAndUpdate(
              req.user.id,
              {
                [`${uploadType}`]: data.Location,
              },
              { new: true }
            );
            if (vendor) {
              return res.status(200).send({
                status: true,
                message: `Image Updated Successfully For  ${uploadType}`,
                imageUrl: vendor.imageUrl,
                verification: vendor.verification,
              });
            } else {
              return res.status(400).send({
                status: false,
                message: "Image Not Updated",
              });
            }
          }
        });
      } else {
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `${id}/${uuidv4()}.jpeg`,
          Body: image,
          ContentEncoding: "base64",
          ContentType: `image/jpeg`,
        };
        s3.upload(params, async (error, data) => {
          if (error) {
            return res.status(500).send(error.message);
          } else {
            const vendor = await Vendor.findByIdAndUpdate(
              req.user.id,
              {
                [`${uploadType}`]: data.Location,
              },
              { new: true }
            );
            if (vendor) {
              return res.status(200).send({
                status: true,
                message: `Image Uploaded Successfully For ${uploadType}`,
                imageUrl: vendor.imageUrl,
                verification: vendor.verification,
              });
            } else {
              return res.status(400).send({
                status: false,
                message: "Image Not uploaded",
              });
            }
          }
        });
      }
    };

    let vendor = await Vendor.findById({ _id: id });

    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }

    if (req.body.uploadFor === "imageUrl") {
      uploadToS3(req.body.uploadFor, vendor);
    } else if (req.body.uploadFor === "verification.aadharFront") {
      uploadToS3(req.body.uploadFor, vendor);
    } else if (req.body.uploadFor === "verification.aadharBack") {
      uploadToS3(req.body.uploadFor, vendor);
    } else if (req.body.uploadFor === "verification.selfie1") {
      uploadToS3(req.body.uploadFor, vendor);
    } else if (req.body.uploadFor === "verification.selfie2") {
      uploadToS3(req.body.uploadFor, vendor);
    } else if (req.body.uploadFor === "verification.pancard") {
      uploadToS3(req.body.uploadFor, vendor);
    } else {
      return res
        .status(400)
        .send({ success: false, message: "Please provide valid uploadFor" });
    }
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.toString(),
    });
  }
};

//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.deleteFormDataImage = async (req, res) => {
  try {
    const { id } = req.user;
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    let fileName = req.body.url.split("/");
    fileName =
      fileName[fileName.length - 2] + "/" + fileName[fileName.length - 1];
    const key = `${fileName}`;
    var params = { Bucket: process.env.AWS_BUCKET_NAME, Key: key };

    const deleteFromS3 = async (type, vendor) => {
      let check = type.split(".");
      let found;
      if (check.length == 1) {
        found = vendor[`${check[0]}`];
      }
      if (check.length == 2) {
        found = vendor[`${check[0]}`][`${check[1]}`];
      }
      if (found !== req.body.url) {
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
          { [`${type}`]: "" },
          { new: true }
        );
        return res.status(200).send({
          success: true,
          message: "Successfully Deleted",
        });
      });
    };
    let vendor = await Vendor.findById(id);
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    if (req.body.type === "imageUrl") {
      deleteFromS3(req.body.type, vendor);
    } else if (req.body.type === "verification.aadharFront") {
      deleteFromS3(req.body.type, vendor);
    } else if (req.body.type === "verification.aadharBack") {
      deleteFromS3(req.body.type, vendor);
    } else if (req.body.type === "verification.selfie1") {
      deleteFromS3(req.body.type, vendor);
    } else if (req.body.type === "verification.selfie2") {
      deleteFromS3(req.body.type, vendor);
    } else if (req.body.type === "verification.pancard") {
      deleteFromS3(req.body.type, vendor);
    } else {
      return res.status(400).send({
        success: false,
        message: "Please provide valid type to delete image",
      });
    }
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

// ********************************uploadMultipleImage*****NOT_IN_USE**********************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.addMultipleImageToS3 = async (req, res, next) => {
  try {
    console.log(req.files.image);
    const { id } = req.user;
    let promises = [];
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });
    if (!req.files) {
      return res
        .status(400)
        .send({ success: false, message: "Please upload the file" });
    }
    // if (req.files.image.length > 1) {
    //   return res
    //     .status(400)
    //     .send({ success: false, message: "Can Upload Only 1 image" });
    // }
    if (!req.files.image.mimetype.startsWith("image")) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide valid image" });
    }
    const upload = async (data) => {
      // var buf = Buffer.from(
      //   item.icon.replace(/^data:image\/\w+;base64,/, ""),
      //   "base64"
      // );
      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${id}/${uuidv4()}.png`,
        Body: data,
        ContentEncoding: "base64",
        ContentType: `image/png`,
      };

      return new Promise((resolve, reject) => {
        s3.upload(params, async (error, data) => {
          if (error) {
            reject(error.message);
          } else {
            resolve({
              src: data.Location,
            });
          }
        });
      });
    };
    req.files.image.forEach(async (item) => {
      promises.push(upload(item.data));
    });

    console.log("promises", promises);

    Promise.all(promises)
      .then(async (resp) => {
        console.log("resp", resp);
        // resp.forEach((icon) => {
        //   req.files.images.forEach((item) => {
        //     item["icon"] = icon.src;
        //   });
        // });
        // const vendor = await Vendor.findByIdAndUpdate(
        //   req.user.id,
        //   { $set: { imageurl: req.files.images } },
        //   { new: true }
        // );
      })
      .catch((err) => {
        return res.status(500).json(err);
      });

    res.status(200).json("Multiple Images Uploaded Successfully");
  } catch (error) {
    return res.status(500).json({
      status: 0,
      message: error.toString(),
    });
  }
};

// ***********************************checkFormStatus****************************************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
exports.checkFormStatus = async (req, res) => {
  try {
    const { id } = req.user;
    let vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).send({
        success: true,
        message: "Vendor Doesn't Exist",
      });
    }
    if (
      vendor.requestedService.length !== 0 &&
      !!vendor.firstName &&
      !!vendor.email &&
      vendor.requestStatus === "pending"
    ) {
      return res.status(200).send({
        success: true,
        message:
          "Your Form Is In Pending We Will Send The Accept/Reject Status Over Mail",
      });
    }
    if (vendor.requestStatus === "rejected") {
      return res.status(200).send({
        success: true,
        message: "Your Form Is Rejected",
      });
    }
    if (vendor.requestStatus === "accepted") {
      return res.status(200).send({
        success: true,
        message:
          "Your Form Is Accepted You Can Proceed Further, Credentials Have Been Shared Over Mail Now You Can Login With Those Credentials Also ",
      });
    }
    res.status(200).send({
      success: true,
      message: "Please Fill All The Details",
    });
  } catch (e) {
    return res.status(500).send({ success: false, error: e.name });
  }
};

// ********************************sendOTPToMailAndVerify/updateMailInDB**********************************************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
//========================================= send otp to mail =======================================================//
exports.sendMailOTP = async (req, res) => {
  try {
    const { body } = req;
    const { error, value } = Joi.object()
      .keys({
        email: Joi.string().lowercase().trim().email().required(),
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

    let vendor = await Vendor.find({ email: value.email });
    if (!vendor) {
      return res.status(500).send({
        success: false,
        message: "Something went wrong",
      });
    }
    if (vendor[0]) {
      return res.status(400).send({
        success: false,
        message: "Email must be unique",
      });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const createOTP = new Mail({
      OTP: Number(otp),
      email: value.email,
    });
    createOTP
      .save()
      .then(async (val) => {
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
        let info = await transporter.sendMail({
          from: process.env.USER,
          to: value.email,
          subject: "OTP",
          html: `Hi your OTP is ${otp}`,
        });
        if (info.accepted.length !== 0) {
          return res
            .status(200)
            .json({ message: "OTP sent successfully", id: val._id });
        }
        return res.status(500).json({
          message: "Something went wrong",
        });
      })
      .catch((e) => {
        res.status(500).send({ message: e.message });
      });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

//@desc update the vendor bankAccountDetails
//@route PUT/vendor/timeSlot
//@access Private
//======================================= verify email otp =================================================//
exports.verifyMailOTP = async (req, res) => {
  try {
    const { body } = req;
    const { error, value } = Joi.object()
      .keys({
        otp: Joi.number().integer().required(),
        id: Joi.string().required(),
      })
      .required()
      .validate(body);
    if (error) {
      return res
        .status(400)
        .send({ success: false, message: error.details[0].message });
    }
    const verifyOTP = await Mail.findById(body.id);
    if (!verifyOTP) {
      return res.status(403).json({ message: "OTP expired" });
    }
    if (verifyOTP.OTP !== +body.otp) {
      return res.status(400).json({ message: "Wrong OTP" });
    }
    if (verifyOTP.OTP === +body.otp) {
      const updateEmail = await Vendor.findByIdAndUpdate(
        req.user.id,
        {
          email: verifyOTP.email,
        },
        { new: true }
      );
      if (updateEmail) {
        return res.status(200).json({ message: "Email successfully updated" });
      }
      return res.status(500).json({ message: "Something went wrong1" });
    }
    return res.status(500).json({ message: "Something went wrong2" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// **********************************end**********************************************************************************//
// ********************************checkReviews********************************************************************************//
//@desc update the vendor bankAccountDetails
//@route PUT/vendor/leaveStatus
//@access Private
exports.checkLeaveStatus = async (req, res) => {
  try {
    const { user } = req;
    let vendor = await Vendor.findById(user.id, {
      onLeave: 1,
      emergencyLeave: 1,
      _id: 0,
    });
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    // console.log(vendor);
    let onLeaveDates, emergencyLeaveDates;
    if (vendor.onLeave) {
      onLeaveDates = vendor.onLeave.filter((item) => {
        if (item.status == "Applied" || item.status == "Approved") return item;
      });
    }

    if (vendor.emergencyLeave) {
      emergencyLeaveDates = vendor.emergencyLeave.filter((item) => {
        if (item.status == "Applied" || item.status == "Approved") return item;
      });
    }

    return res.status(200).send({
      success: true,
      // vendor,
      onLeaveDates,
      emergencyLeaveDates,
    });
  } catch (e) {
    return res.status(500).send({ success: false, message: e.message });
  }
};
