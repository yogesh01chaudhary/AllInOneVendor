const express = require("express");
const router = express.Router();
const { vendorRequest } = require("../controllers/vendor");

router.post("/vendorRequest", vendorRequest);

module.exports = router;
