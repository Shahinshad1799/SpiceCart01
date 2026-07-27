// controllers/cartController.js

const Cart = require("../model/cartmodel");
const productmodel = require("../model/productmodel");
const product=require("../model/productmodel")
const Coupon = require("../model/couponmodel");

const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { code } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Login required" });

        // Find coupon
        const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

        if (!coupon)
            return res.json({ success: false, message: "Invalid coupon code" });

        if (!coupon.isActive)
            return res.json({ success: false, message: "Coupon is inactive" });

        if (new Date() > coupon.expiryDate)
            return res.json({ success: false, message: "Coupon has expired" });

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
            return res.json({ success: false, message: "Coupon usage limit reached" });

        // Get cart subtotal
        const cart = await Cart.findOne({ user: userId });
        if (!cart || cart.items.length === 0)
            return res.json({ success: false, message: "Your cart is empty" });

        let subtotal = 0;
        for (const item of cart.items) {
            subtotal += item.price * item.quantity;
        }

        if (subtotal < coupon.minPurchase)
            return res.json({ success: false, message: `Minimum purchase of ₹${coupon.minPurchase} required` });

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === "percentage") {
            discount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
        } else if (coupon.discountType === "fixed") {
            discount = coupon.discountValue;
        } else if (coupon.discountType === "shipping") {
            discount = 50; // your fixed shipping cost
        }

        discount = Math.min(discount, subtotal); // never exceed subtotal

        // Store in session
        req.session.appliedCoupon = {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscount: coupon.maxDiscount,
            discount: Math.round(discount)
        };

        const shipping = coupon.discountType === "shipping" ? 0 : 50;
        const tax = subtotal * 0.05;
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

        // Recalculate without coupon
        const cart = await Cart.findOne({ user: userId });
        let subtotal = 0;
        for (const item of cart.items) {
            subtotal += item.price * item.quantity;
        }

        const shipping = 50;
        const tax = subtotal * 0.05;
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

// const getCartPage = async (req, res) => {
//   try {
//     const userId = req.session.userId;

//     if (!userId) {
//       return res.redirect("/login");
//     }

//     let cart = await Cart.findOne({ user: userId })
//       .populate("items.productId");

//     const cartItems = cart ? cart.items : [];

//     let subtotal = 0;
//     let totalItems = 0;

//     cartItems.forEach(item => {
//       const price = item.productId?.variants?.[0]?.price || 0; 
//       const qty = item.quantity || 0;

//       subtotal += price * qty;
//       totalItems += qty;
//     });

//     const shipping = subtotal > 0 ? 50 : 0;
//     const tax = subtotal * 0.08;
//     const total = subtotal + shipping + tax;

//     res.render("user/cart", {
//       cartItems,
//       subtotal,
//       totalItems,
//       shipping,
//       tax,
//       total
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   }
// };
const getCartPage = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

    const { error, success } = req.query;

    // populate product + category
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
    //  FILTER VALID ITEMS ONLY
    cart.items = cart.items.filter(item => {
      const prod = item.productId;

      // remove if product missing or blocked
      if (!prod || prod.status !== "Active") return false;

      //  remove if category blocked
      if (!prod.catagory || prod.catagory.status !== "Active") return false;

      //  remove if variant missing
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



    //  save cleaned cart
    await cart.save();
// inside getCartPage, before res.render
const appliedCoupon = req.session.appliedCoupon || null;
const discount = appliedCoupon?.discount || 0;
const shipping = 0;
const tax = Math.round(subtotal * 0.05);
const total = Math.round(subtotal + tax - discount);

res.render("user/cart", {
    cartItems: cart.items,
    subtotal,
    totalItems,
    shipping,
    tax,
    total,
    discount,           // ← new
    appliedCoupon:null,      // ← new
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

    //  PRODUCT STATUS CHECK
    if (!prod || prod.status !== "Active") {
      return res.redirect("/shop?error=Product not available");
    }

    const selectedVariant = prod.variants.id(variantId);

    //  VARIANT + STOCK CHECK
    if (!selectedVariant || selectedVariant.stock <= 0) {
      return res.redirect("/shop?error=Out of stock");
    }

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

      //  STOCK VALIDATION
      if (newQty > selectedVariant.stock) {
        return res.redirect("/cart?error=Not enough stock");
      }

      // MAX LIMIT
      if (newQty > MAX_QTY) {
        return res.redirect("/cart?error=Max quantity limit reached");
      }

      existingItem.quantity = newQty;

    } else {

      const qty = Number(quantity);

      //  STOCK VALIDATION
      if (qty > selectedVariant.stock) {
        return res.redirect("/cart?error=Not enough stock");
      }

      //  MAX LIMIT
      if (qty > MAX_QTY) {
        return res.redirect("/cart?error=Max quantity limit reached");
      }

      cart.items.push({
        productId,
        variantId,
        quantity: qty,
        price: selectedVariant.price
      });
    }

    await cart.save();

    return res.redirect("/cart?success=Added to cart");

  } catch (err) {
    console.error(err);
    return res.redirect("/cart?error=Server error");
  }
};

// const updateCart = async (req, res) => {
//   try {
//     const userId = req.session.userId;
//     const { productId, variantId, change } = req.body;

//     const changeValue = parseInt(change);
//     const MAX_QTY = 5;

//     if (!userId) {
//       return res.json({ success: false, message: "Login required" });
//     }

//     const cart = await Cart.findOne({ user: userId }).populate("items.productId");

//     if (!cart) {
//       return res.json({ success: false, message: "Cart not found" });
//     }

//     const prod = await product.findById(productId);

//     if (!prod || prod.status !== "Active") {
//       return res.json({ success: false, message: "Product not available" });
//     }

//     const selectedVariant = prod.variants.id(variantId);

//     if (!selectedVariant) {
//       return res.json({ success: false, message: "Variant not found" });
//     }

//     const item = cart.items.find(
//       i =>
//         i.productId._id.toString() === productId &&
//         i.variantId.toString() === variantId
//     );

//     if (!item) {
//       return res.json({ success: false, message: "Item not found" });
//     }

//     const newQty = item.quantity + changeValue;

//     // ❌ STOCK CHECK
//     if (newQty > selectedVariant.stock) {
//       return res.json({ success: false, message: "Stock limit reached" });
//     }

//     // ❌ MAX LIMIT
//     if (newQty > MAX_QTY) {
//       return res.json({ success: false, message: "Max quantity reached" });
//     }

//     // ❌ REMOVE ITEM
//     if (newQty <= 0) {
//       cart.items = cart.items.filter(
//         i =>
//           !(
//             i.productId._id.toString() === productId &&
//             i.variantId.toString() === variantId
//           )
//       );
//     } else {
//       item.quantity = newQty;
//     }

//     await cart.save();

//     // ✅ RECALCULATE TOTALS
//     let subtotal = 0;
//     let totalItems = 0;

//     cart.items.forEach(i => {
//       subtotal += i.price * i.quantity;
//       totalItems += i.quantity;
//     });

//     const shipping = subtotal > 0 ? 50 : 0;
//     const tax = subtotal * 0.08;
//     const total = subtotal + shipping + tax;

//     return res.json({
//       success: true,
//       qty: newQty > 0 ? newQty : 0,
//       subtotal,
//       total,
//       totalItems
//     });

//   } catch (err) {
//     console.error(err);
//     return res.json({ success: false, message: "Server error" });
//   }
// };
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

   const prod = await product.findById(productId);  //
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
    }

    await cart.save();

    // Recalculate totals
    let subtotal = 0;
    let totalItems = 0;

    for (let i of cart.items) { // 
const p = await product.findById(i.productId); 
      const v = p?.variants.id(i.variantId);
      const price = v?.price || 0;
      subtotal += price * i.quantity;
      totalItems += i.quantity;
    }

    const shipping = subtotal > 0 ? 50 : 0;
    const tax = subtotal * 0.08;
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





module.exports={
  getCartPage,
  updateCart,
  removeFromCart,
  addToCart,
  applyCoupon,
  removeCoupon
}