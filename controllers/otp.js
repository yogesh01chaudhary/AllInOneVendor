const OTP = require("../models/otp");
var otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const { encode } = require("../middleware/crypt");
const Booking = require("../models/booking");
const Joi = require("joi");
const mongoose = require("mongoose");
const axios = require("axios");

// To add minutes to the current time
function AddMinutesToDate(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

exports.sendOTPToMail = async (req, res) => {
  try {
    const { email, type } = req.body;
    let email_subject, email_message;
    if (!email) {
      const response = { Status: "Failure", Details: "Email not provided" };
      return res.status(400).send(response);
    }
    if (!type) {
      const response = { Status: "Failure", Details: "Type not provided" };
      return res.status(400).send(response);
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
    });
    const now = new Date();
    const expiredAt = AddMinutesToDate(now, 2);

    //Create OTP instance in DB
    const otp_instance = await OTP.create({
      otp,
      expiredAt,
    });

    // Create details object containing the email and otp id
    var details = {
      timestamp: now,
      check: email,
      success: true,
      message: "OTP sent to user",
      otp_id: otp_instance.id,
    };

    let bufferObj = Buffer.from(details.toString(), "utf8");

    // Encoding into base64
    let base64String = bufferObj.toString("base64");

    // Printing the base64 encoded string
    console.log("The encoded base64 string is:", base64String);
    let bufferObj2 = Buffer.from(base64String, "base64");

    // Decoding base64 into String
    let string = bufferObj2.toString("utf8");

    // Printing the base64 decoded string
    console.log("The Decoded base64 string is:", string);

    // Encrypt the details object
    // const encoded = await encode(JSON.stringify(details));
    // console.log(details, encoded);

    //Choose message template according type requestedconst encoded= await encode(JSON.stringify(details))
    if (type) {
      if (type == "VERIFICATION") {
        const {
          message,
          subject_mail,
        } = require("../templates/email/email_verification");
        email_message = message(otp);
        email_subject = subject_mail;
      } else if (type == "FORGET") {
        const {
          message,
          subject_mail,
        } = require("../templates/email/email_forget");
        email_message = message(otp);
        email_subject = subject_mail;
      } else if (type == "2FA") {
        const {
          message,
          subject_mail,
        } = require("../templates/email/email_2FA");
        email_message = message(otp);
        email_subject = subject_mail;
      } else {
        const response = {
          Status: "Failure",
          Details: "Incorrect Type Provided",
        };
        return res.status(400).send(response);
      }
    }

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
      to: `${email}`,
      subject: email_subject,
      text: email_message,
    });

    //Send Email
    // const mailResponse = await transporter.sendMail(mailOptions);

    if (!mailResponse) {
      return res
        .status(400)
        .send({ success: true, message: "Something went wrong" });
    }
    if (mailResponse.accepted.length === 0) {
      return res.status(400).send({ success: false, mailResponse });
    }
    return res.status(200).send({ success: true, details, mailResponse });
  } catch (err) {
    const response = { Status: "Failure", Details: err.message };
    return res.status(400).send(response);
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    var currentdate = new Date();
    const { verification_key, otp, check } = req.body;

    if (!verification_key) {
      const response = {
        Status: "Failure",
        Details: "Verification Key not provided",
      };
      return res.status(400).send(response);
    }
    if (!otp) {
      const response = { Status: "Failure", Details: "OTP not Provided" };
      return res.status(400).send(response);
    }
    if (!check) {
      const response = { Status: "Failure", Details: "Check not Provided" };
      return res.status(400).send(response);
    }

    // let decoded;
    // //Check if verification key is altered or not and store it in variable decoded after decryption
    // try{
    //   decoded = await decode(verification_key)
    // }
    // catch(err) {
    //   const response={"Status":"Failure", "Details":"Bad Request"}
    //   return res.status(400).send(response)
    // }

    // var obj = JSON.parse(decoded);
    let obj = verification_key;
    const check_obj = obj.check;

    // Check if the OTP was meant for the same email or phone number for which it is being verified
    if (check_obj != check) {
      const response = {
        Status: "Failure",
        Details: "OTP was not sent to this particular email or phone number",
      };
      return res.status(400).send(response);
    }

    let otp_instance = await OTP.findById(obj.otp_id);
    console.log(otp_instance);

    //Check if OTP is available in the DB
    if (otp_instance != null) {
      //Check if OTP is already used or not
      if (otp_instance.verified != true) {
        //Check if OTP is expired or not
        console.log(otp_instance.expiredAt.getTime(), currentdate.getTime());
        if (otp_instance.expiredAt.getTime() > currentdate.getTime()) {
          //Check if OTP is equal to the OTP in the DB
          if (otp === otp_instance.otp) {
            otp_instance.verified = true;
            otp_instance = await otp_instance.save();
            const response = {
              Status: "Success",
              Details: "OTP Matched",
              Check: check,
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

exports.phoneOTP = async (req, res) => {
  try {
    // console.log(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY)
    // if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    //   const response = {
    //     Status: "Failure",
    //     Details: "OTP for phone is not available right now",
    //   };
    //   return res.status(503).send(response);
    // }

    const { phone_number, type } = req.body;

    let phone_message;

    if (!phone_number) {
      const response = {
        Status: "Failure",
        Details: "Phone Number not provided",
      };
      return res.status(400).send(response);
    }
    if (!type) {
      const response = { Status: "Failure", Details: "Type not provided" };
      return res.status(400).send(response);
    }

    //Generate OTP
    const otp = otpGenerator.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    const now = new Date();
    const expiration_time = AddMinutesToDate(
      now,
      process.env.OTP_EXPIRATION_TIME
    );

    //Create OTP instance in DB
    let otp_instance = await OTP.find({ phone: phone_number });
    if (!otp_instance) {
      return res
        .status(400)
        .send({ success: false, message: "Something went wrong" });
    }
    if (otp_instance.length === 0) {
      otp_instance = new OTP({
        otp: otp,
        expiredAt: expiration_time,
        phone: phone_number,
      });
      otp_instance = await otp_instance.save();
      if (!otp_instance) {
        return res
          .status(400)
          .send({ sucess: false, message: "Something went wrong" });
      }
      //   var details = {
      //     timestamp: now,
      //     check: phone_number,
      //     success: true,
      //     message: "OTP sent to user",
      //     otp_id: otp_instance.id,
      //   };
      if (type) {
        if (type == "VERIFICATION") {
          const message = require("../templates/sms/phone_verification");
          phone_message = message(otp);
        } else if (type == "FORGET") {
          const message = require("../templates/sms/phone_forget");
          phone_message = message(otp);
        } else if (type == "2FA") {
          const message = require("../templates/sms/phone_2FA");
          phone_message = message(otp);
        } else {
          const response = {
            Status: "Failure",
            Details: "Incorrect Type Provided",
          };
          return res.status(400).send(response);
        }
      }
      var params = {
        Message: phone_message,
        PhoneNumber: phone_number,
      };
      return res
        .status(200)
        .send({ success: true, params: params, instance: otp_instance });
    }
    otp_instance = otp_instance[0];
    otp_instance = await OTP.findByIdAndUpdate(
      otp_instance._id,
      {
        otp: otp,
        expiredAt: expiration_time,
        verified: false,
      },
      { new: true }
    );

    // Create details object containing the phone number and otp id
    // var details = {
    //   timestamp: now,
    //   check: phone_number,
    //   success: true,
    //   message: "OTP sent to user",
    //   otp_id: otp_instance.id,
    // };

    // Encrypt the details object
    //   const encoded= await encode(JSON.stringify(details))

    //Choose message template according type requested
    if (type) {
      if (type == "VERIFICATION") {
        const message = require("../templates/sms/phone_verification");
        phone_message = message(otp);
      } else if (type == "FORGET") {
        const message = require("../templates/sms/phone_forget");
        phone_message = message(otp);
      } else if (type == "2FA") {
        const message = require("../templates/sms/phone_2FA");
        phone_message = message(otp);
      } else {
        const response = {
          Status: "Failure",
          Details: "Incorrect Type Provided",
        };
        return res.status(400).send(response);
      }
    }

    // Settings Params for SMS
    var params = {
      Message: phone_message,
      PhoneNumber: phone_number,
    };
    return res.status(200).send({ params: params, instance: otp_instance });
    //Send the params to AWS SNS using aws-sdk
    var publishTextPromise = new AWS.SNS({ apiVersion: "2010-03-31" })
      .publish(params)
      .promise();

    //Send response back to the client if the message is sent
    publishTextPromise
      .then(function (data) {
        return res.send({ Status: "Success", Details: details });
      })
      .catch(function (err) {
        return res
          .status(400)
          .send({ Status: "Failure", Details: err, otp_instance });
      });
  } catch (err) {
    const response = { Status: "Failure", Details: err.message };
    return res.status(400).send(response);
  }
};

exports.verifyPhoneOTP = async (req, res) => {
  try {
    var currentdate = new Date();
    console.log(req.body);
    const { verification_key, otp, check } = req.body;

    // if (!verification_key) {
    //   const response = {
    //     Status: "Failure",
    //     Details: "Verification Key not provided",
    //   };
    //   return res.status(400).send(response);
    // }
    if (!otp) {
      const response = { Status: "Failure", Details: "OTP not Provided" };
      return res.status(400).send(response);
    }
    if (!check) {
      const response = { Status: "Failure", Details: "Check not Provided" };
      return res.status(400).send(response);
    }

    // let decoded;
    // //Check if verification key is altered or not and store it in variable decoded after decryption
    // try{
    //   decoded = await decode(verification_key)
    // }
    // catch(err) {
    //   const response={"Status":"Failure", "Details":"Bad Request"}
    //   return res.status(400).send(response)
    // }

    // var obj = JSON.parse(decoded);
    // let obj = verification_key;
    // const check_obj = obj.check;

    // // Check if the OTP was meant for the same email or phone number for which it is being verified
    // if (check_obj != check) {
    //   const response = {
    //     Status: "Failure",
    //     Details: "OTP was not sent to this particular email or phone number",
    //   };
    //   return res.status(400).send(response);
    // }

    let otp_instance = await OTP.find({ phone: check });
    if (!otp_instance) {
      return res
        .status(400)
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
          if (otp === otp_instance.otp) {
            otp_instance.verified = true;
            otp_instance = await otp_instance.save();
            const response = {
              Status: "Success",
              Details: "OTP Matched",
              Check: check,
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

// **********************************2FA*********************************************************************************//
exports.sendOTPDetails = async (req, res) => {
  try {
    const { body } = req;
    const { error } = Joi.object()
      .keys({ bookingId: Joi.string().required() })
      .required()
      .validate(body);
    if (error) {
      console.log(error);
      return res
        .status(400)
        .send({ success: false, error: error.details[0].message });
    }
    let matchQuery = {
      $match: {
        $and: [{ _id: mongoose.Types.ObjectId(body.bookingId) }],
      },
    };

    let data = await Booking.aggregate([
      {
        $facet: {
          totalData: [
            matchQuery,
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
      return res.status(404).send({
        success: false,
        message: "No Result",
      });
    }
    result = result[0];
    console.log(result);

    console.log(process.env.OTP_API + result.userData[0].phone + "/AUTOGEN");
    axios
      .get(process.env.OTP_API + result.userData[0].phone + "/AUTOGEN")
      .then(async (response) => {
        let otp_instance = new OTP({
          bookingId: body.bookingId,
          phone: result.userData[0].phone,
          otpDetails: response.data.Details,
        });
        otp_instance = await otp_instance.save();
        return res.status(200).json({
          message: "OTP sent successfully",
          details: response.data.Details,
          otp_instance,
        });
      })
      .catch((er) => {
        return res.status(500).json({ message: "Error", error: er.message });
      });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Something went wrong", error: e.message });
  }
};

exports.verifyOTPDetails = async (req, res) => {
  try {
    const { body } = req;
    console.log(body);
    const { error } = Joi.object()
      .keys({ otpId: Joi.string().required(), otp: Joi.number().required() })
      .required()
      .validate(body);
    if (error) {
      console.log(error);
      return res
        .status(400)
        .send({ success: false, error: error.details[0].message });
    }

    let data = await OTP.findById({_id:body.otpId});
    if (!data) {
      return res
        .status(404)
        .send({ success: false, message: "Data Not Found" });
    }
    console.log(data);
    console.log(
      process.env.OTP_API + "VERIFY/" + data.otpDetails + "/" + body.otp
    );
    axios
      .get(process.env.OTP_API + "VERIFY/" + data.details + "/" + body.otp)
      .then(async (response) => {
        if (response.data.Details === "OTP Matched") {
          return es.staus(200).send({ success: true, message: "OTP Matched" });
        } else if (response.data.Details === "OTP Expired") {
          return res.status(403).json({ message: "OTP Expired" });
        }
        return res.status(500).json({ message: "Something went wrong 1" });
      })
      .catch((error) => {
        return res.status(500).json(error);
      });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};
