/**
 * Single source of truth for cart → order totals.
 *
 * Every place that shows or charges a total (checkout page, COD order,
 * Razorpay order creation, Razorpay verification, wallet order) MUST call
 * this same function with the same inputs, or the numbers WILL drift apart —
 * that drift is what caused the payment-amount-mismatch bug.
 *
 * @param {Array} cartItems - populated cart.items (item.productId populated, item.variantId, item.quantity)
 * @param {Object|null} appliedCoupon - req.session.appliedCoupon, or null
 * @returns {{ subtotal:number, shipping:number, tax:number, discount:number, total:number, amountInPaise:number }}
 */
function calculateOrderTotals(cartItems, appliedCoupon) {
  // ── 1. Subtotal from live product/variant prices (never trust client-sent prices) ──
  let subtotal = 0;

  for (const item of cartItems) {
    const product = item.productId;
    if (!product) continue;

    const variant = product.variants.find(
      v => v._id.toString() === item.variantId?.toString()
    );
    if (variant) subtotal += variant.price * item.quantity;
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

  // ── 3. Shipping (free if coupon type is "shipping", otherwise flat/threshold) ──
  const shipping = appliedCoupon?.discountType === "shipping"
    ? 0
    : (subtotal > 500 ? 0 : 50);

  // ── 4. Tax — computed on subtotal before discount (matches existing checkout math) ──
  const tax = Math.round(subtotal * 0.05);

  // ── 5. Final total ──
  const total = Math.round((subtotal + shipping + tax - discount) * 100) / 100;

  return {
    subtotal,
    shipping,
    tax,
    discount,
    total,
    amountInPaise: Math.round(total * 100), // Razorpay needs integer paise
  };
}

module.exports = { calculateOrderTotals };