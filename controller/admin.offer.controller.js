const catagorymodel = require("../model/catagorymodel");
const productmodel = require("../model/productmodel");
const Offer = require("../model/offermodel");

const loadOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const status = req.query.status || "";

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { couponCode: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      query.status = status;
    }

    const totalOffers = await Offer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit);

    const offers = await Offer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render("admin/offer", {
      offers,
      currentPage: page,
      totalPages,
      totalOffers,
      search,
      status,
      limit,
    });
  } catch (error) {
    console.log(error);
  }
};

const loadAddOffer = async function (req, res) {
  try {
    // Fetch active products and categories from database
    const products = await productmodel.find({ status: 'Active' }).select('_id name').lean();
    const categories = await catagorymodel.find({ status: 'Active' }).select('_id name').lean();
    // Render view with data
    res.render("admin/addoffer", {
      products,
      categories,
      title: "Create New Offer"
    });
  } catch (error) {
    console.error("Error loading add offer page:", error);
    res.status(500).render("admin/error", {
      message: "Failed to load offer creation form"
    });
  }
};

const createOffer = async (req, res) => {
  try {
    
    const {
      title,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountCap,
      applicableFor,
      targetId,
      code,
      usageLimit,
      startDate,
      endDate,
      status
    } = req.body;

    // Validate type/target pairing before saving
    if ((applicableFor === "product" || applicableFor === "category") && !targetId) {
      return res.status(400).json({
        success: false,
        message: `Please select a ${applicableFor} for this offer`
      });
    }

    if (code) {
      const existing = await Offer.findOne({ code: code.toUpperCase() });
      if (existing) {
        return res.status(400).json({ success: false, message: "Offer code already exists" });
      }
    }

    const newOffer = new Offer({
      title,
      description,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      maxDiscountCap: maxDiscountCap || null,
      applicableFor: applicableFor || "all",
      targetId: applicableFor === "all" ? null : targetId,
      code: code ? code.toUpperCase() : undefined,
      usageLimit: usageLimit || null,
      startDate,
      endDate,
      status: status || "draft",
      createdBy: req.userId
    });

    await newOffer.save();

    res.status(200).json({ success: true, message: "Offer created successfully" });

  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message).join(", ");
      return res.status(422).json({ success: false, message: messages });
    }

    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscountCap,
      applicableFor,
      targetId,
      code,
      usageLimit,
      startDate,
      endDate,
      status
    } = req.body;

    if (code) {
      const existing = await Offer.findOne({ code: code.toUpperCase(), _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: "Offer code already exists" });
      }
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      id,
      {
        title,
        description,
        discountType,
        discountValue,
        minOrderValue: minOrderValue || 0,
        maxDiscountCap: maxDiscountCap || null,
        applicableFor: applicableFor || "all",
        targetId: applicableFor === "all" ? null : targetId,
        code: code ? code.toUpperCase() : undefined,
        usageLimit: usageLimit || null,
        startDate,
        endDate,
        status: status || "draft"
      },
      { new: true, runValidators: true }
    );

    if (!updatedOffer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }

    // Return JSON instead of redirect
    return res.status(200).json({ success: true, message: "Offer updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });
    offer.status = offer.status === "active" ? "draft" : "active";
    await offer.save();
    res.json({ success: true, status: offer.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const loadEditOffer = async (req, res) => {
  try {
    const offerId = req.params.id;

    const offer = await Offer.findById(offerId).lean();

    if (!offer) {
      return res.redirect("/admin/offers");
    }

    const products = await productmodel.find({ status: 'Active' }).select('_id name').lean();
    const categories = await catagorymodel.find({ status: 'Active' }).select('_id name').lean();

    res.render("admin/editOffer", {
      offer,
      products,
      categories,
    });

  } catch (error) {
    console.log("Error loading edit offer page:", error);
    res.redirect("/admin/offers");
  }
};

module.exports = {
  loadOffers,
  loadAddOffer,
  createOffer,
  updateOffer,
  toggleOfferStatus,
  loadEditOffer,
};