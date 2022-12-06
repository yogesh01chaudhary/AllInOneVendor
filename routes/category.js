const express = require("express");
const router = express.Router();
const category = require("../controllers/category");
const { verifyToken } = require("../middleware/auth");

router.get("/allCategory", category.getAllCategory);
router.get("/categoryData/:id", category.getCategoryData);
router.get("/subcategoryData/:id", category.getSubCategoryData);
router.get("/subcategory2Service/:id", category.getSubCategory2Services);

module.exports=router