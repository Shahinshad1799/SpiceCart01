// controllers/cartController.js

const Cart = require("../model/cartmodel");
const productmodel = require("../model/productmodel");
const product = require("../model/productmodel")
const Coupon = require("../model/couponmodel");
const { getProductWithOffer } = require("./user.shop.controller"); // ⬅️ adjust path/filename to match your actual shop controller file

const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { code } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Login required" });

        const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

        if (!coupon)
            return res.json({ success: false, message: "Invalid coupon code" });

        if (!coupon.isActive)
            return res.json({ success: false, message: "Coupon is inactive" });

        if (new Date() > coupon.expiryDate)
            return res.json({ success: false, message: "Coupon has expired" });

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
            return res.json({ success: false, message: "Coupon usage limit reached" });

        const cart = await Cart.findOne({ user: userId });
        if (!cart || cart.items.length === 0)
            return res.json({ success: false, message: "Your cart is empty" });

        let subtotal = 0;
        for (const item of cart.items) {
            subtotal += item.price * item.quantity;
        }

        if (subtotal < coupon.minPurchase)
            return res.json({ success: false, message: `Minimum purchase of ₹${coupon.minPurchase} required` });

        let discount = 0;
        if (coupon.discountType === "percentage") {
            discount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
        } else if (coupon.discountType === "fixed") {
            discount = coupon.discountValue;
        } else if (coupon.discountType === "shipping") {
            discount = 50;
        }

        discount = Math.min(discount, subtotal);

        req.session.appliedCoupon = {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscount: coupon.maxDiscount,
            discount: Math.round(discount)
        };

        const shipping = coupon.discountType === "shipping" ? 0 : 50;
        const tax = 0;
        const total = subtotal + shipping + tax - discount;

        return res.json({
            success: true,
            message: "Coupon applied successfully!",
            discount: Math.round(discount),
            shipping,
            tax: Math.round(tax),
            total: Math.round(total),
            couponCode: coupon.code
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Login required" });

        req.session.appliedCoupon = null;

        const cart = await Cart.findOne({ user: userId });
        let subtotal = 0;
        for (const item of cart.items) {
            subtotal += item.price * item.quantity;
        }

        const shipping = 50;
        const tax = 0;
        const total = subtotal + shipping + tax;

        return res.json({
            success: true,
            message: "Coupon removed",
            discount: 0,
            shipping,
            tax: Math.round(tax),
            total: Math.round(total)
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const getCartPage = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

    const { error, success } = req.query;

    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.productId",
        populate: {
          path: "catagory",
          select: "status"
        }
      });

    if (!cart) {
      return res.render("user/cart", {
        cartItems: [],
        subtotal: 0,
        totalItems: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        discount: 0,
        appliedCoupon: null,
        hasOutOfStock: false,
        error,
        success
      });
    }

    cart.items = cart.items.filter(item => {
      const prod = item.productId;
      if (!prod || prod.status !== "Active") return false;
      if (!prod.catagory || prod.catagory.status !== "Active") return false;
      const variant = prod.variants.id(item.variantId);
      if (!variant) return false;
      return true;
    });

    let subtotal = 0;
    let totalItems = 0;
    let hasOutOfStock = false;

    cart.items.forEach(item => {
      const qty = item.quantity || 0;
      const price = item.price || 0;

      const variant = item.productId.variants.id(item.variantId);

      if (!variant || variant.stock < qty) {
        item.outOfStock = true;
        hasOutOfStock = true;
      }

      subtotal += price * qty;
      totalItems += qty;
    });

    await cart.save();

    const appliedCoupon = req.session.appliedCoupon || null;
    const discount = appliedCoupon?.discount || 0;
  const shipping = appliedCoupon?.discountType === "shipping"
  ? 0
  : (subtotal > 0 ? 50 : 0);
    const tax = Math.round(0);
    const total = Math.round(subtotal + shipping + tax - discount);

    res.render("user/cart", {
        cartItems: cart.items,
        subtotal,
        totalItems,
        shipping,
        tax,
        total,
        discount,
        appliedCoupon: null,
        hasOutOfStock,
        error,
        success
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, variantId, quantity = 1 } = req.body;

    if (!userId) {
      return res.redirect("/login");
    }

    const prod = await product.findById(productId);

    if (!prod || prod.status !== "Active") {
      return res.redirect("/shop?error=Product not available");
    }

    const selectedVariant = prod.variants.id(variantId);

    if (!selectedVariant || selectedVariant.stock <= 0) {
      return res.redirect("/shop?error=Out of stock");
    }

    // ⬇️ NEW: check for an active offer and use the discounted price if one applies
    const productWithOffer = await getProductWithOffer(prod);
    const variantWithOffer = productWithOffer.discountedVariants
      ? productWithOffer.discountedVariants.find(v => v._id.toString() === variantId)
      : null;
    const finalPrice = variantWithOffer?.discountedPrice ?? selectedVariant.price;

    const MAX_QTY = 5;

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: []
      });
    }

    const existingItem = cart.items.find(item =>
      item.productId.toString() === productId &&
      item.variantId.toString() === variantId
    );

    if (existingItem) {

      const newQty = existingItem.quantity + Number(quantity);

      if (newQty > selectedVariant.stock) {
        return res.redirect("/cart?error=Not enough stock");
      }

      if (newQty > MAX_QTY) {
        return res.redirect("/cart?error=Max quantity limit reached");
      }

      existingItem.quantity = newQty;
      existingItem.price = finalPrice; // ⬅️ NEW: keep price in sync with current offer on repeat add

    } else {

      const qty = Number(quantity);

      if (qty > selectedVariant.stock) {
        return res.redirect("/cart?error=Not enough stock");
      }

      if (qty > MAX_QTY) {
        return res.redirect("/cart?error=Max quantity limit reached");
      }

      cart.items.push({
        productId,
        variantId,
        quantity: qty,
        price: finalPrice // ⬅️ CHANGED: was selectedVariant.price
      });
    }

    await cart.save();

    return res.redirect("/cart?success=Added to cart");

  } catch (err) {
    console.error(err);
    return res.redirect("/cart?error=Server error");
  }
};

const updateCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, variantId, change } = req.body;

    const changeValue = parseInt(change);
    const MAX_QTY = 5;

    if (!userId)
      return res.json({ success: false, message: "Login required" });

    const cart = await Cart.findOne({ user: userId });
    if (!cart)
      return res.json({ success: false, message: "Cart not found" });

    const prod = await product.findById(productId);
    if (!prod || prod.status !== "Active")
      return res.json({ success: false, message: "Product not available" });

    const selectedVariant = prod.variants.id(variantId);
    if (!selectedVariant)
      return res.json({ success: false, message: "Variant not found" });

    const item = cart.items.find(
      i =>
        i.productId.toString() === productId &&
        i.variantId.toString() === variantId
    );
    if (!item)
      return res.json({ success: false, message: "Item not found" });

    const newQty = item.quantity + changeValue;

    if (changeValue > 0 && newQty > selectedVariant.stock)
      return res.json({ success: false, message: "Not enough stock" });

    if (changeValue > 0 && newQty > MAX_QTY)
      return res.json({ success: false, message: "Max quantity limit reached" });

    let removed = false;

    if (newQty <= 0) {
      cart.items = cart.items.filter(
        i =>
          !(
            i.productId.toString() === productId &&
            i.variantId.toString() === variantId
          )
      );
      removed = true;
    } else {
      item.quantity = newQty;

      // ⬇️ NEW: refresh this item's price against the current offer when quantity changes
      const productWithOffer = await getProductWithOffer(prod);
      const variantWithOffer = productWithOffer.discountedVariants
        ? productWithOffer.discountedVariants.find(v => v._id.toString() === variantId)
        : null;
      item.price = variantWithOffer?.discountedPrice ?? selectedVariant.price;
    }

    await cart.save();

    // Recalculate totals using each item's stored (offer-aware) price
    let subtotal = 0;
    let totalItems = 0;

    for (let i of cart.items) {
      subtotal += i.price * i.quantity; // ⬅️ CHANGED: use item.price (already offer-aware) instead of re-fetching raw variant price
      totalItems += i.quantity;
    }

    const shipping = subtotal > 0 ? 50 : 0;
    const tax = 0;
    const total = subtotal + shipping + tax;

    return res.json({
      success: true,
      qty: removed ? 0 : newQty,
      removed,
      subtotal,
      shipping,
      tax,
      total,
      totalItems
    });

  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: "Server error" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, variantId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false });
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      res.redirect("/login")
    }

    cart.items = cart.items.filter(
      item =>
        !(
          item.productId.toString() === productId &&
          item.variantId.toString() === variantId
        )
    );

    await cart.save();

    res.redirect("/cart");

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  getCartPage,
  updateCart,
  removeFromCart,
  addToCart,
  applyCoupon,
  removeCoupon
}