const express = require("express");
const router = express.Router();
const category = require("../controllers/category");
const { verifyToken, auth } = require("../middleware/auth");
const { isVendor } = require("../middleware/isVendor");


//**********************************getAllCategory*************************************************************************//
router.get("/allCategory", auth, isVendor, category.getAllCategory);

//*********************************getCategoryDataByCatId*************************************************************************//
router.get("/categoryData/:id", auth, isVendor, category.getCategoryData);

//**********************************getSubCategoryDataBySubCatId*************************************************************************//
router.get("/subcategoryData/:id", auth, isVendor, category.getSubCategoryData);

//************************************getSubCategory2DataBySubCat2Id*************************************************************************//
router.get(
  "/subcategory2Service/:id",
  auth,
  isVendor,
  category.getSubCategory2Services
);

module.exports = router;
