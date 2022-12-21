const Category = require("../models/category");
const { Service } = require("../models/services");
const SubCategory = require("../models/subCategory");
const SubCategory2 = require("../models/subCategory2");
//=============================================== get all detailed categories ===============================================//
exports.getAllCategory = async (req, res) => {
  try {
    let category = await Category.find(
      {},
      { _id: 1, name: 1, imageUrl:1 }
    );
    // .populate({
    //   path: "subCategory",
    //   select: { _id: 1, name: 1, service: 1 },
    //   populate: {
    //     path: "subCategory2",
    //     select: { _id: 1, name: 1, service: 1 },
    //   },
    // });

    if (!category) {
      return res
        .status(500)
        .json({ success: false, message: "Something went wrong" });
    }
    return res.status(200).json({
      message: "All Category SubCategory SubCategory2 fetched successfully",
      category,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.name });
  }
};
//============================================ get data by categories ==============================================//
exports.getCategoryData = async (req, res) => {
  try {
    const result = await Category.findById(req.params.id, {
      service: 1,
      subCategory: 1,
      _id: 0,
    })
      .populate("service", { __v: 0, createdAt: 0, updatedAt: 0 })
      .populate("subCategory", { name: 1, imageUrl: 1, description: 1 });
    if (!result) {
      return res
        .status(404)
        .json({ message: "Category not found of id " + req.params.id });
    }
    // if (result.service.length === 0) {
    //   return res
    //     .status(404)
    //     .json({ message: "No service found in the given id " + req.params.id });
    // }
    return res.status(200).json({ result: result });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};
//========================================== get data by sub categories =================================================//
exports.getSubCategoryData = async (req, res) => {
  try {
    const result = await SubCategory.findById(req.params.id, {
      service: 1,
      subCategory2: 1,
      _id: 0,
    })
      .populate("service", { __v: 0, createdAt: 0, updatedAt: 0 })
      .populate("subCategory2", { name: 1, imageUrl: 1, description: 1 });
    if (!result) {
      return res
        .status(404)
        .json({ message: "Sub-Category not found of id " + req.params.id });
    }
    // if (result.service.length === 0) {
    //   return res
    //     .status(404)
    //     .json({ message: "No service found in the given id " + req.params.id });
    // }
    return res.status(200).json({ result });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};
//=================================================== get data by sub category 2 ======================================//
exports.getSubCategory2Services = async (req, res) => {
  try {
    const result = await SubCategory2.findById(req.params.id, {
      service: 1,
      _id: 0,
    }).populate("service", { __v: 0, createdAt: 0, updatedAt: 0 });
    if (!result) {
      return res
        .status(404)
        .json({ message: "Sub-Category2 not found of id " + req.params.id });
    }
    if (result.service.length === 0) {
      return res
        .status(404)
        .json({ message: "No service found in the given id " + req.params.id });
    }
    return res.status(200).json({ result: result.service });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
};
