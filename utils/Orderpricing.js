const { getProductWithOffer } = require("../controller/user.shop.controller"); // adjust path to your actual file

async function calculateOrderTotals(cartItems, appliedCoupon) {
  // ── 1. Subtotal from live product/variant prices, offer-aware ──
  let subtotal = 0;

  for (const item of cartItems) {
    const product = item.productId;
    if (!product) continue;

    const productWithOffer = await getProductWithOffer(product);
    const variant = productWithOffer.discountedVariants
      ? productWithOffer.discountedVariants.find(v => v._id.toString() === item.variantId?.toString())
      : product.variants.find(v => v._id.toString() === item.variantId?.toString());

    const price = variant?.discountedPrice ?? variant?.price ?? 0;
    subtotal += price * item.quantity;
  }

  // ── 2. Discount from coupon (mirrors checkout page logic exactly) ──
  let discount = 0;

  if (appliedCoupon) {
    if (appliedCoupon.discountType === "percentage") {
      discount = (subtotal * appliedCoupon.discountValue) / 100;
      if (appliedCoupon.maxDiscount) {
        discount = Math.min(discount, appliedCoupon.maxDiscount);
      }
    } else if (appliedCoupon.discountType === "fixed") {
      discount = appliedCoupon.discountValue;
    } else if (appliedCoupon.discountType === "shipping") {
      discount = 50;
    }
    discount = Math.round(Math.min(discount, subtotal));
  }

  const shipping = appliedCoupon?.discountType === "shipping" ? 0 : 50; // Free shipping if coupon type is "shipping", else flat 50

  const tax = Math.round(0);

  const total = Math.round((subtotal + shipping + tax - discount) * 100) / 100;

  return {
    subtotal,
    shipping,
    tax,
    discount,
    total,
    amountInPaise: Math.round(total * 100),
  };
}

module.exports = { calculateOrderTotals };