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

// *********************************************UPLOAD_IMAGE************************************************************************ //

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

// ******************************************AADHAR_VERIFICATION_IMAGE_UPLOAD******************************************************************************//
// ******************************************AADHAR_VERIFICATION_SELFIE_1******************************************************************************//
//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3UrlSelfie1
//@access Private
exports.s3UrlSelfie1 = async (req, res) => {
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
    if (!vendor.verification.selfie1) {
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

    let fileName = vendor.verification.selfie1.split("/");
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
//@route PUT/vendor/selfie1Url
//@access Private
exports.updateSelfie1Url = async (req, res) => {
  try {
    const { user, body } = req;
    Joi.object()
      .keys({
        body: Joi.object().keys({
          selfie1Url: Joi.string().required(),
        }),
        user: Joi.object().keys({
          id: Joi.string().required(),
        }),
      })
      .required()
      .validate(req);
    let vendor = await Vendor.findByIdAndUpdate(
      user.id,
      { "verification.selfie1": body.selfie1Url },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res
      .status(200)
      .send({ success: true, message: "Selfie1 Url Updated", vendor });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc delete image from s3 Bucket and DB
//@route DELETE vendor/selfie1Url
//@access Private
exports.deleteSelfie1Url = async (req, res) => {
  try {
    const { id } = req.user;

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    let fileName = req.body.selfie1Url.split("/");
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

    if (vendor.verification.selfie1 !== req.body.selfie1Url) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted selfie1Url doesn't match with Vendor's selfie1",
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
        { "verification.selfie1": "" },
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

// ******************************************AADHAR_VERIFICATION_SELFIE_2******************************************************************************//
//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3UrlSelfie2
//@access Private
exports.s3UrlSelfie2 = async (req, res) => {
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
    if (!vendor.verification.selfie2) {
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

    let fileName = vendor.verification.selfie2.split("/");
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
//@route PUT/vendor/selfie2Url
//@access Private
exports.updateSelfie2Url = async (req, res) => {
  try {
    const { user, body } = req;
    Joi.object()
      .keys({
        body: Joi.object().keys({
          selfie2Url: Joi.string().required(),
        }),
        user: Joi.object().keys({
          id: Joi.string().required(),
        }),
      })
      .required()
      .validate(req);
    let vendor = await Vendor.findByIdAndUpdate(
      user.id,
      { "verification.selfie2": body.selfie2Url },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res
      .status(200)
      .send({ success: true, message: "Selfie2 Url Updated", vendor });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc delete image from s3 Bucket and DB
//@route DELETE vendor/selfie2Url
//@access Private
exports.deleteSelfie2Url = async (req, res) => {
  try {
    const { id } = req.user;

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    let fileName = req.body.selfie2Url.split("/");
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

    if (vendor.verification.selfie2 !== req.body.selfie2Url) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted selfie2Url doesn't match with Vendor's selfie2",
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
        { "verification.selfie2": "" },
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

// ******************************************AADHAR_VERIFICATION_AADHAR_FRONT******************************************************************************//
//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3UrlAadharFront
//@access Private
exports.s3UrlAadharFront = async (req, res) => {
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
    if (!vendor.verification.aadharFront) {
      const key = `${id}/${uuidv4()}.jpeg`;
      const url = await s3.getSignedUrlPromise("putObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        ContentType: "image/jpeg",
        Key: key,
        Expires: 120,
      });
      return res.status(200).send({
        success: true,
        message: "Url generated , aadharFront doesn't exists in DB",
        url,
        key,
      });
    }

    let fileName = vendor.verification.aadharFront.split("/");
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
//@route PUT/vendor/aadharFrontUrl
//@access Private
exports.updateAaadharFrontUrl = async (req, res) => {
  try {
    const { user, body } = req;
    Joi.object()
      .keys({
        body: Joi.object().keys({
          aadharFrontUrl: Joi.string().required(),
        }),
        user: Joi.object().keys({
          id: Joi.string().required(),
        }),
      })
      .required()
      .validate(req);
    let vendor = await Vendor.findByIdAndUpdate(
      user.id,
      { "verification.aadharFront": body.aadharFrontUrl },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res
      .status(200)
      .send({ success: true, message: "AadharFront Url Updated", vendor });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc delete image from s3 Bucket and DB
//@route DELETE vendor/aadharFrontUrl
//@access Private
exports.deleteAadharFrontUrl = async (req, res) => {
  try {
    const { id } = req.user;

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    let fileName = req.body.aadharFrontUrl.split("/");
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

    if (vendor.verification.aadharFront !== req.body.aadharFrontUrl) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted aadharFrontUrl doesn't match with Vendor's aadharFront",
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
        { "verification.aadharFront": "" },
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

// ******************************************AADHAR_VERIFICATION_BACK******************************************************************************//
//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3UrlAadharBack
//@access Private
exports.s3UrlAadharBack = async (req, res) => {
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
    if (!vendor.verification.aadharBack) {
      const key = `${id}/${uuidv4()}.jpeg`;
      const url = await s3.getSignedUrlPromise("putObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        ContentType: "image/jpeg",
        Key: key,
        Expires: 120,
      });
      return res.status(200).send({
        success: true,
        message: "Url generated , aadharBack doesn't exists in DB",
        url,
        key,
      });
    }

    let fileName = vendor.verification.aadharBack.split("/");
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
//@route PUT/vendor/aadharBackUrl
//@access Private
exports.updateAadharBackUrl = async (req, res) => {
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
      { "verification.aadharBack": body.aadharBackUrl },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res
      .status(200)
      .send({ success: true, message: "aadharBack Updated", vendor });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc delete image from s3 Bucket and DB
//@route DELETE vendor/aadharBack
//@access Private
exports.deleteAadharBackUrl = async (req, res) => {
  try {
    const { id } = req.user;

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    let fileName = req.body.aadharBackUrl.split("/");
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

    if (vendor.verification.aadharBack !== req.body.aadharBackUrl) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted aadharBackUrl doesn't match with Vendor's aadharBack",
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
        { "verification.aadharBack": "" },
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

// ******************************************AADHAR_VERIFICATION_PANCARD******************************************************************************//
//@desc get s3Url fro newOne and for update image check in DB imageUrl
//@route GET/vendor/s3UrlPancard
//@access Private
exports.s3UrlPancard = async (req, res) => {
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
    if (!vendor.verification.pancard) {
      const key = `${id}/${uuidv4()}.jpeg`;
      const url = await s3.getSignedUrlPromise("putObject", {
        Bucket: process.env.AWS_BUCKET_NAME,
        ContentType: "image/jpeg",
        Key: key,
        Expires: 120,
      });
      return res.status(200).send({
        success: true,
        message: "Url generated , pancard doesn't exists in DB",
        url,
        key,
      });
    }

    let fileName = vendor.verification.pancard.split("/");
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
//@route PUT/vendor/pancardUrl
//@access Private
exports.updatePancardUrl = async (req, res) => {
  try {
    const { user, body } = req;
    Joi.object()
      .keys({
        body: Joi.object().keys({
          pancardUrl: Joi.string().required(),
        }),
        user: Joi.object().keys({
          id: Joi.string().required(),
        }),
      })
      .required()
      .validate(req);
    let vendor = await Vendor.findByIdAndUpdate(
      user.id,
      { "verification.pancard": body.pancardUrl },
      { new: true }
    );
    if (!vendor) {
      return res
        .status(404)
        .send({ success: false, message: "Vendor Doesn't Exists" });
    }
    return res
      .status(200)
      .send({ success: true, message: "pancard Updated", vendor });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

//@desc delete image from s3 Bucket and DB
//@route DELETE vendor/pancardUrl
//@access Private
exports.deletePancardUrl = async (req, res) => {
  try {
    const { id } = req.user;

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET,
    });

    let fileName = req.body.pancardUrl.split("/");
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

    if (vendor.verification.pancard !== req.body.pancardUrl) {
      return res.status(400).send({
        success: false,
        message:
          "Can't be deleted pancardUrl doesn't match with Vendor's pancard",
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
        { "verification.pancard": "" },
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
      timeSlot:vendor.timeSlot,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

exports.requestLeave = async (req, res) => {
  try {
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        onLeave: Joi.array().items(
          Joi.object().keys({
            date: Joi.string().required(),
            status: Joi.string().required(),
          })
        ),
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
        $addToSet: { onLeave: { $each: body.onLeave } },
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
      onLeave:vendor.onLeave,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

exports.requestEmergencyLeave = async (req, res) => {
  try {
    const { body, user } = req;
    const { error } = Joi.object()
      .keys({
        date: Joi.string().required(),
        status: Joi.string().required(),
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
        $addToSet: { emergencyLeave: { date: body.date, status: body.status } },
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
      emergencyLeave:vendor.emergencyLeave,
    });
  } catch (e) {
    res.status(500).send({ success: false, message: e.message });
  }
};

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
