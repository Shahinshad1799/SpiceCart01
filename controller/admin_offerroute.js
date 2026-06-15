const Offer = require("../model/offermodel");
const product=require("../model/productmodel")
const catagory=require("../model/catagorymodel")
const cart=require("../model/cartmodel")

// ─── Helper ───────────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─── CREATE Offer ─────────────────────────────────────────────────────────────
const createOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.create({
    ...req.body
  });

  res.redirect("/admin/offers");
})
// ─── GET All Offers ───────────────────────────────────────────────────────────
const getAllOffers = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, search } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (search) filter.title = { $regex: search, $options: "i" };

  const skip = (Number(page) - 1) * Number(limit);

  const [offers, total] = await Promise.all([
    Offer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("createdBy", "name email"),
    Offer.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: offers,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─── GET Single Offer ─────────────────────────────────────────────────────────
const getOfferById = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id).populate(
    "createdBy",
    "name email"
  );

  if (!offer) {
    return res.status(404).json({ success: false, message: "Offer not found" });
  }

  res.status(200).json({ success: true, data: offer });
});

// ─── UPDATE Offer ─────────────────────────────────────────────────────────────
const updateOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id);

  if (!offer) {
    return res.status(404).json({ success: false, message: "Offer not found" });
  }

  if (offer.status === "expired") {
    return res.status(400).json({
      success: false,
      message: "Expired offers cannot be updated",
    });
  }

  // Prevent manually setting usedCount via update
  delete req.body.usedCount;

  const updated = await Offer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Offer updated successfully",
    data: updated,
  });
});

// ─── UPDATE Status ────────────────────────────────────────────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["draft", "active", "expired"];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Status must be one of: ${allowed.join(", ")}`,
    });
  }

  const offer = await Offer.findById(req.params.id);
  if (!offer) {
    return res.status(404).json({ success: false, message: "Offer not found" });
  }

  // Business rules
  if (offer.status === "expired" && status !== "draft") {
    return res.status(400).json({
      success: false,
      message: "Expired offer can only be reset to draft",
    });
  }
  if (status === "active" && offer.endDate < new Date()) {
    return res.status(400).json({
      success: false,
      message: "Cannot activate an offer with a past end date",
    });
  }

  offer.status = status;
  await offer.save();

  res.status(200).json({
    success: true,
    message: `Offer status updated to '${status}'`,
    data: offer,
  });
});

// ─── DELETE Offer ─────────────────────────────────────────────────────────────
const deleteOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id);

  if (!offer) {
    return res.status(404).json({ success: false, message: "Offer not found" });
  }

  if (offer.status === "active") {
    return res.status(400).json({
      success: false,
      message: "Active offers cannot be deleted. Expire or draft it first.",
    });
  }

  await offer.deleteOne();

  res.status(200).json({
    success: true,
    message: "Offer deleted successfully",
  });
});

// ─── APPLY Offer (validate & increment usage) ─────────────────────────────────
const applyOffer = asyncHandler(async (req, res) => {
  const { code, orderValue } = req.body;

  const offer = await Offer.findOne({ code, status: "active" });

  if (!offer) {
    return res
      .status(404)
      .json({ success: false, message: "Invalid or inactive offer code" });
  }

  if (offer.endDate < new Date()) {
    offer.status = "expired";
    await offer.save();
    return res
      .status(400)
      .json({ success: false, message: "Offer has expired" });
  }

  if (offer.usageLimit && offer.usedCount >= offer.usageLimit) {
    return res
      .status(400)
      .json({ success: false, message: "Offer usage limit reached" });
  }

  if (orderValue < offer.minOrderValue) {
    return res.status(400).json({
      success: false,
      message: `Minimum order value of ${offer.minOrderValue} required`,
    });
  }

  // Calculate discount
  let discount =
    offer.discountType === "percentage"
      ? (orderValue * offer.discountValue) / 100
      : offer.discountValue;

  if (offer.maxDiscountCap) {
    discount = Math.min(discount, offer.maxDiscountCap);
  }

  // Increment usage
  offer.usedCount += 1;
  await offer.save();

  res.status(200).json({
    success: true,
    message: "Offer applied successfully",
    data: {
      discount,
      finalAmount: orderValue - discount,
      offer: offer.title,
    },
  });
});

module.exports = {
  createOffer,
  getAllOffers,
  getOfferById,
  updateOffer,
  updateStatus,
  deleteOffer,
  applyOffer
};  