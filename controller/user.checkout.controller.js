const usermodel = require("../model/usermodel");
const addressmodel = require("../model/addressmodel");
const Cart = require("../model/cartmodel");
const couponmodel = require("../model/couponmodel");
const { getOrCreateWallet } = require('../utils/walletHelper');
const { calculateOrderTotals } = require('../utils/Orderpricing');

const loadcheckout = async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await usermodel.findById(userId);
    if (!user || user.isBlocked) {
      req.session.destroy();
      return res.redirect('/login');
    }

    const cart = await Cart.findOne({ user: userId }).populate("items.productId");
    const addresses = await addressmodel.find({ userId: userId });

    const emptyRender = (extra = {}) => res.render("user/checkout", {
      cartItems: [],
      addresses: addresses || [],
      subtotal: 0,
      shipping: 0,
      tax: 0,
      discount: 0,
      total: 0,
      appliedCoupon: null,
      availableCoupons: [],
      ...extra
    });

    if (!cart || cart.items.length === 0) return emptyRender();

    // Filter blocked products
    const activeItems = cart.items.filter(
      item => item.productId && !item.productId.isBlocked
    );

    if (activeItems.length !== cart.items.length) {
      const blockedIds = cart.items
        .filter(item => !item.productId || item.productId.isBlocked)
        .map(item => item._id);
      await Cart.findOneAndUpdate(
        { user: userId },
        { $pull: { items: { _id: { $in: blockedIds } } } }
      );
    }

    if (activeItems.length === 0) return emptyRender();

    // ── COUPON FROM SESSION ──────────────────────────────
    const appliedCoupon = req.session.appliedCoupon || null;

    // ── Totals — same helper used at order creation / payment verification ──
    const { subtotal, shipping, tax, discount, total } =await calculateOrderTotals(activeItems, appliedCoupon);

    // ── AVAILABLE COUPONS — active, not expired, sorted so the ones the
    // customer can actually use right now (subtotal already meets minPurchase)
    // show up first ──────────────────────────────────────────────────────
    const now = new Date();
    const allCoupons = await couponmodel.find({
      isActive: true,
      expiryDate: { $gte: now }
    }).sort({ createdAt: -1 }).lean();

    const availableCoupons = allCoupons
      .filter(c => c.code !== appliedCoupon?.code) // don't show the one already applied
      .map(c => ({
        ...c,
        eligible: subtotal >= (c.minPurchase || 0),
        amountNeeded: Math.max((c.minPurchase || 0) - subtotal, 0)
      }))
      .sort((a, b) => (a.eligible === b.eligible ? 0 : a.eligible ? -1 : 1));

    const wallet = await getOrCreateWallet(userId);
    res.render("user/checkout", {
      cartItems: activeItems,
      addresses: addresses || [],
      subtotal,
      shipping: shipping || 0,
      tax,
      discount,
      appliedCoupon,
      availableCoupons,
      walletBalance: wallet.balance,
      total
    });

  } catch (err) {
    console.log(err);
    res.redirect("/cart");
  }
};

module.exports = {
  loadcheckout,
};