const couponmodel = require("../model/couponmodel");

const loadCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const filter = search
      ? {
          $or: [
            { code: { $regex: search, $options: "i" } },
            { discountType: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const totalCoupons = await couponmodel.countDocuments(filter);
    const totalPages = Math.ceil(totalCoupons / limit);

    const coupons = await couponmodel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const now = new Date();

    const activeCount = await couponmodel.countDocuments({ isActive: true, expiryDate: { $gte: now } });

    const totalRedeemedAgg = await couponmodel.aggregate([
      { $group: { _id: null, total: { $sum: "$usedCount" } } }
    ]);
    const totalRedeemed = totalRedeemedAgg[0]?.total || 0;

    res.render("admin/coupon", {
      coupons,
      currentPage: page,
      totalPages,
      totalCoupons,
      search,
      activeCount,
      totalRedeemed,
      limit,
      now
    });

  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageerror");
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await couponmodel.findById(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.status(200).json({ success: true, isActive: coupon.isActive });
  } catch (error) {
    console.error(error);
    res.render("admin/coupon", { error: "Server error" });
  }
};

const loadAddCoupon = async (req, res) => {
  try {
    res.render("admin/addcoupon");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/pageerror");
  }
};

const createCoupon = async (req, res) => {
  try {
    const { code, isActive, discountType, discountValue, maxDiscount, minPurchase, usageLimit, expiryDate } = req.body;

    const existing = await couponmodel.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.render("admin/addcoupon", { error: "Coupon code already exists" });
    }

    const newCoupon = new couponmodel({
      code: code.toUpperCase(),
      isActive: isActive === "true" || isActive === true,
      discountType,
      discountValue,
      maxDiscount: maxDiscount || null,
      minPurchase: minPurchase || 0,
      usageLimit: usageLimit || 1,
      expiryDate
    });

    await newCoupon.save();
    res.render("admin/addcoupon", { success: "Coupon created successfully" });

  } catch (error) {
    console.error(error);
    res.render("admin/addcoupon", { error: "Server error" });
  }
};

const loadEditCoupon = async (req, res) => {
  try {
    const coupon = await couponmodel.findById(req.params.id).lean();
    if (!coupon) return res.redirect("/admin/coupons");
    res.render("admin/editcoupon", { coupon });
  } catch (error) {
    console.error(error);
    res.redirect("/admin/coupons");
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { code, isActive, discountType, discountValue, maxDiscount, minPurchase, usageLimit, expiryDate } = req.body;

    await couponmodel.findByIdAndUpdate(req.params.id, {
      code: code.toUpperCase().trim(),
      isActive: isActive === "true" || isActive === "on",
      discountType,
      discountValue: Number(discountValue),
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      minPurchase: Number(minPurchase) || 0,
      usageLimit: Number(usageLimit) || 1,
      expiryDate: new Date(expiryDate),
    });

    res.redirect("/admin/coupons");
  } catch (error) {
    console.error(error);
    res.render("admin/editcoupon", { error: "Server error" });
  }
};

module.exports = {
  loadCoupons,
  toggleCouponStatus,
  loadAddCoupon,
  createCoupon,
  loadEditCoupon,
  updateCoupon,
};


