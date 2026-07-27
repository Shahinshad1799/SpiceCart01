const usermodel = require("../model/usermodel");
const addressmodel = require("../model/addressmodel");
const productmodel = require("../model/productmodel");
const Product = require("../model/productmodel");
const Cart = require("../model/cartmodel");
const Order = require("../model/ordermodel");
const Wallet = require("../model/walletmodel");
const mongoose = require("mongoose");
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { getOrCreateWallet, creditWallet, debitWallet } = require('../utils/walletHelper');
const { calculateOrderTotals } = require('../utils/orderPricing');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/** Build order.items[] from a populated cart, validating every product/variant still exists. */
function buildOrderItems(cartItems) {
  const items = [];

  for (const cartItem of cartItems) {
    const product = cartItem.productId;
    if (!product) {
      throw new Error("A product in your cart was not found");
    }

    const variant = product.variants.find(
      v => v._id.toString() === cartItem.variantId?.toString()
    );
    if (!variant) {
      throw new Error(`Variant not found for "${product.name}"`);
    }

    items.push({
      productId:    product._id,
      variantId:    variant._id,
      productName:  product.name,
      productImage: product.images?.[0] || "",
      unitPrice:    variant.price,
      quantity:     cartItem.quantity,
      lineTotal:    variant.price * cartItem.quantity,
      itemStatus:   "active",
    });
  }

  return items;
}

const placeorder = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId)
        const { addressId } = req.body

        // ── 1. Validate ───────────────────────────────────────────────────────
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" })
        }

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Please select a delivery address" })
        }

        // ── 2. Fetch address ──────────────────────────────────────────────────
        const address = await addressmodel.findOne({ _id: addressId, userId })

        if (!address) {
            return res.status(404).json({ success: false, message: "Address not found" })
        }

        // ── 3. Fetch cart (one doc with items array) ──────────────────────────
        const cart = await Cart.findOne({ user: userId }).populate("items.productId")

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty" })
        }

        // ── 4. Build order items ──────────────────────────────────────────────
        let items;
        try {
            items = buildOrderItems(cart.items);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        // ── 5. Calculate totals — same helper used at checkout ────────────────
        const appliedCoupon = req.session.appliedCoupon || null;
        const { subtotal, shipping, tax, discount, total } = calculateOrderTotals(cart.items, appliedCoupon);

        // ── 6. Create order ───────────────────────────────────────────────────
        const order = await Order.create({
            userId,
            shippingAddress: {
                addressId:   address._id,
                fullname:    address.fullname,
                phonenumber: address.phonenumber,
                address:     address.address,
                appartment:  address.appartment,
                city:        address.city,
                state:       address.state,
                zipcode:     address.zipcode
            },
            items,
            paymentMethod: "cash_on_delivery",
            paymentStatus: "pending",
            status:        "pending",
            subtotal,
            shipping,
            tax,
            discount,
            couponCode: appliedCoupon?.code || null,
            total
        })

        // ── 7. Deduct stock ───────────────────────────────────────────────────
        for (const item of items) {
          await Product.findOneAndUpdate(
            { _id: item.productId, 'variants._id': item.variantId },
            { $inc: { 'variants.$.stock': -item.quantity } }
          );
        }

        // ── 8. Save orderId to session, clear applied coupon ──────────────────
        req.session.lastOrderId = order._id
        req.session.appliedCoupon = null

        // ── 9. Clear cart ─────────────────────────────────────────────────────
        await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { items: [] } }
        )

        // ── 10. Return JSON so frontend can redirect ───────────────────────────
        return res.status(201).json({ success: true, orderId: order._id })

    } catch (err) {
        console.error("Place order error:", err.message)
        console.error(err.stack)
        return res.status(500).json({ success: false, message: err.message || "Something went wrong" })
    }
}

const onlineorder = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.session.userId);

    //  Calculate amount from cart — never trust client-sent amount
    const cart = await Cart.findOne({ user: userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: 'Cart is empty' });
    }

    // Same helper the checkout page used to display the total the user just saw
    const appliedCoupon = req.session.appliedCoupon || null;
    const { total, amountInPaise } = calculateOrderTotals(cart.items, appliedCoupon);

    const order = await razorpay.orders.create({
      amount:   amountInPaise,
      currency: 'INR',
      receipt:  `receipt_${Date.now()}`,
    });

    // Remember what we expect to be charged so verification can cross-check
    // the amount Razorpay actually captured against it.
    req.session.expectedPaymentAmount = amountInPaise;

    res.json({ success: true, order, total });

  } catch (err) {
    console.error('onlineorder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const verifyOnlineOrder = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId } = req.body;
    const userId = new mongoose.Types.ObjectId(req.session.userId);

    // ── 1. Verify signature ───────────────────────────────────────────────
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // ── 2. Validate ───────────────────────────────────────────────────────
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to continue' });
    }
    if (!addressId) {
      return res.status(400).json({ success: false, message: 'Please select a delivery address' });
    }

    // ── 3. Fetch address ──────────────────────────────────────────────────
    const address = await addressmodel.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // ── 4. Fetch cart ─────────────────────────────────────────────────────
    const cart = await Cart.findOne({ user: userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty' });
    }

    // ── 5. Build order items ──────────────────────────────────────────────
    let items;
    try {
      items = buildOrderItems(cart.items);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    // ── 6. Recalculate totals with the SAME helper used to create the Razorpay order ──
    const appliedCoupon = req.session.appliedCoupon || null;
    const { subtotal, shipping, tax, discount, total, amountInPaise } = calculateOrderTotals(cart.items, appliedCoupon);

    // ── 7. Cross-check against what Razorpay actually captured ────────────
    // Guards against the cart/coupon changing between order-creation and payment,
    // and against any client-side tampering with the amount.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.amount !== amountInPaise) {
      console.error(
        `Payment amount mismatch — captured ${payment.amount}, expected ${amountInPaise}`
      );
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match your cart total. Please contact support before retrying — your card has not been charged again.'
      });
    }

    // ── 8. Create order ───────────────────────────────────────────────────
    const order = await Order.create({
      userId,
      shippingAddress: {
        addressId:   address._id,
        fullname:    address.fullname,
        phonenumber: address.phonenumber,
        address:     address.address,
        appartment:  address.appartment,
        city:        address.city,
        state:       address.state,
        zipcode:     address.zipcode
      },
      items,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status:        'pending',
      subtotal,
      shipping,
      tax,
      discount,
      couponCode: appliedCoupon?.code || null,
      total,
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    // ── 9. Deduct stock ───────────────────────────────────────────────────
    for (const item of items) {
      await Product.findOneAndUpdate(
        { _id: item.productId, 'variants._id': item.variantId },
        { $inc: { 'variants.$.stock': -item.quantity } }
      );
    }

    // ── 10. Save orderId to session, clear coupon ─────────────────────────
    req.session.lastOrderId = order._id;
    req.session.appliedCoupon = null;
    req.session.expectedPaymentAmount = null;

    // ── 11. Clear cart ────────────────────────────────────────────────────
    await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );

    return res.status(201).json({ success: true, orderId: order._id });

  } catch (err) {
    console.error('Verify payment error:', err.message);
    console.error(err.stack);
    return res.status(500).json({ success: false, message: err.message || 'Something went wrong' });
  }
};

const placeOrderWallet = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.session.userId);
    const { addressId } = req.body;

    if (!addressId) return res.json({ success: false, message: 'Please select a delivery address' });

    // Fetch cart
    const cart = await Cart.findOne({ user: userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: 'Your cart is empty' });
    }

    // Fetch address
    const address = await addressmodel.findOne({ _id: addressId, userId });
    if (!address) return res.json({ success: false, message: 'Address not found' });

    // Build items
    let items;
    try {
      items = buildOrderItems(cart.items);
    } catch (e) {
      return res.json({ success: false, message: e.message });
    }

    // Totals — same helper used at checkout
    const appliedCoupon = req.session.appliedCoupon || null;
    const { subtotal, shipping, tax, discount, total } = calculateOrderTotals(cart.items, appliedCoupon);

    // ✅ Check wallet has enough balance
    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < total) {
      return res.json({
        success: false,
        message: `Insufficient wallet balance. Available: ₹${wallet.balance.toFixed(2)}, Required: ₹${total.toFixed(2)}`
      });
    }

    // Create order first so we have an orderId to attach to the wallet transaction
    const order = await Order.create({
      userId,
      shippingAddress: {
        fullname:    address.fullname,
        phonenumber: address.phonenumber,
        address:     address.address,
        appartment:  address.appartment,
        city:        address.city,
        state:       address.state,
        zipcode:     address.zipcode,
      },
      items,
      paymentMethod: 'wallet',
      paymentStatus: 'paid',
      status:        'pending',
      subtotal,
      shipping,
      tax,
      discount,
      couponCode: appliedCoupon?.code || null,
      total,
    });

    // ✅ Debit wallet with the real orderId + description from the start
    await debitWallet(
      userId,
      total,
      `Payment for order #${order._id.toString().slice(-6).toUpperCase()}`,
      order._id
    );

    // Deduct stock
    for (const item of items) {
      await Product.findOneAndUpdate(
        { _id: item.productId, 'variants._id': item.variantId },
        { $inc: { 'variants.$.stock': -item.quantity } }
      );
    }

    // Clear cart + coupon
    await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });
    req.session.appliedCoupon = null;

    req.session.lastOrderId = order._id;
    res.json({ success: true, orderId: order._id });

  } catch (err) {
    console.error('placeOrderWallet error:', err);
    res.json({ success: false, message: err.message });
  }
};

const loadordersuccess = async (req, res) => {
    try {
        const orderId = req.session.lastOrderId

        if (!orderId) {
            return res.redirect("/")
        }

        const order = await Order.findById(orderId)

        if (!order) {
            return res.redirect("/")
        }

        // Map to the shape the EJS template expects
        const orderData = {
            id:       order._id,
            subtotal: order.subtotal,
            shipping: order.shipping,
            tax:      order.tax,
            discount: order.discount || 0,
            total:    order.total,
            items: order.items.map((item) => ({
                name:     item.productName,
                image:    item.productImage,
                price:    item.unitPrice,
                quantity: item.quantity,
            })),
        }

        // Clear from session so stale data isn't shown on refresh
        req.session.lastOrderId = null

        res.render("user/ordersuccess", { order: orderData })

    } catch (error) {
        console.error("Error loading order success page:", error)
        res.redirect("/")
    }
}

const loadorder = async (req, res) => {
  try {
    const userId = req.session.userId
    const page   = parseInt(req.query.page) || 1
    const limit  = 10
    const skip   = (page - 1) * limit
    const search = req.query.q || ""

    const user = await usermodel.findById(userId).select("name email profileImage createdAt")
    if (!user) return res.redirect("/login")

    const searchQuery = {
      userId,
      ...(search && {
        orderId: { $regex: search, $options: "i" }
      })
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(searchQuery)
    ])

    const totalPages = Math.ceil(totalOrders / limit)

    res.render("user/order", {
      user,
      orders,
      totalOrders,
      currentPage: page,
      totalPages,
      search,
    })

  } catch (err) {
    console.error("Load orders error:", err)
    res.redirect("/")
  }
}

const loadorderdetails = async (req, res) => {
    try {
    const userId  = req.session.userId
    const orderId = req.params.id

    const [user, order, totalOrders] = await Promise.all([
      usermodel.findById(userId).select("name email profileImage createdAt"),
      Order.findOne({ _id: orderId, userId }),   // userId check prevents accessing other users' orders
      Order.countDocuments({ userId })
    ])

    if (!user)  return res.redirect("/login")
    if (!order) return res.redirect("/orders")   // order not found or doesn't belong to user

    res.render("user/orderdetails", { user, order, totalOrders })

  } catch (err) {
    console.error("Load order details error:", err)
    res.redirect("/orders")
  }
}

const cancelOrder = async (req, res) => {
  try {
    const { id }  = req.params;
    const { reason } = req.body;
    const userId  = req.session.userId;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) return res.json({ success: false, message: 'Order not found' });

    if (order.status !== 'pending') {
      return res.json({ success: false, message: 'Only pending orders can be cancelled' });
    }

    // Restore stock
    for (const item of order.items) {
      if (item.itemStatus !== 'cancelled') {
        await Product.findOneAndUpdate(
          { _id: item.productId, 'variants._id': item.variantId },
          { $inc: { 'variants.$.stock': item.quantity } }
        );
      }
    }

    // Wallet refund using separate Wallet model
    let refundAmount = 0;
    if ((order.paymentMethod === 'online' || order.paymentMethod === 'wallet') && order.paymentStatus === 'paid') {
      refundAmount = order.total;
      await creditWallet(
        userId,
        refundAmount,
        `Refund for cancelled order #${order._id.toString().slice(-6).toUpperCase()}`,
        order._id
      );
    }

    order.status       = 'cancelled';
    order.cancelReason = reason;
    order.items.forEach(item => { item.itemStatus = 'cancelled'; });
    await order.save();

    res.json({ success: true, refundAmount });

  } catch (err) {
    console.error('cancelOrder error:', err);
    res.json({ success: false, message: err.message });
  }
};

const returnorder = async (req, res) => {

  try {

    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.status !== "delivered") {
      return res.json({
        success: false,
        message: "Only delivered orders can be returned"
      });
    }

    order.returnRequest = {
      status: "requested",
      reason,
      requestedAt: new Date()
    };

    await order.save();

    res.json({
      success: true
    });

  } catch (error) {

    console.log(error);

    res.json({
      success: false,
      message: "Something went wrong"
    });

  }
};

const cancelOrderItem = async (req, res) => {
  try {
    const { id }              = req.params;
    const { productId, reason } = req.body;
    const userId              = req.session.userId;

    const order = await Order.findOne({ _id: id, userId });
    if (!order) return res.json({ success: false, message: 'Order not found' });

    if (!['pending', 'processing'].includes(order.status)) {
      return res.json({ success: false, message: 'Items cannot be cancelled at this stage' });
    }

    const item = order.items.find(i => i.productId.toString() === productId);
    if (!item)                        return res.json({ success: false, message: 'Item not found' });
    if (item.itemStatus === 'cancelled') return res.json({ success: false, message: 'Item already cancelled' });

    item.itemStatus   = 'cancelled';
    item.cancelReason = reason;

    // Restore stock
    await productmodel.findOneAndUpdate(
      { _id: item.productId, 'variants._id': item.variantId },
      { $inc: { 'variants.$.stock': item.quantity } }
    );

    // ✅ Wallet refund using separate Wallet model
    let refundAmount = 0;
    if ((order.paymentMethod === 'online' || order.paymentMethod === 'wallet') && order.paymentStatus === 'paid') {
      refundAmount = item.lineTotal;
      await creditWallet(
        userId,
        refundAmount,
        `Refund for cancelled item "${item.productName}" in order #${order._id.toString().slice(-6).toUpperCase()}`,
        order._id
      );
    }

    // Recalculate totals
    const activeItems = order.items.filter(i => i.itemStatus !== 'cancelled');
    order.subtotal    = activeItems.reduce((sum, i) => sum + i.lineTotal, 0);
    order.tax         = parseFloat((order.subtotal * 0.05).toFixed(2));
    order.shipping    = order.subtotal >= 500 ? 0 : 50;
    order.total       = parseFloat((order.subtotal + order.tax + order.shipping).toFixed(2));

    if (activeItems.length === 0) order.status = 'cancelled';

    await order.save();
    res.json({ success: true, refundAmount });

  } catch (err) {
    console.error('cancelOrderItem error:', err);
    res.json({ success: false, message: err.message });
  }
};

/**
 * Retry payment for a failed/pending online order.
 * Creates a fresh Razorpay order for the SAME amount already stored on the
 * order document (never recalculated from the live cart, since the cart may
 * have changed or been emptied since the original order was placed).
 */
const retryPayment = async (req, res) => {
  try {
    const userId  = req.session.userId;
    const orderId = req.params.id;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.paymentMethod !== 'online') {
      return res.status(400).json({ success: false, message: 'This order is not an online payment order' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This order is already paid' });
    }

    const amountInPaise = Math.round(order.total * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount:   amountInPaise,
      currency: 'INR',
      receipt:  `retry_${order._id}_${Date.now()}`,
    });

    // Track the retry attempt's Razorpay order id against our order for verification
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({ success: true, order: razorpayOrder, orderId: order._id, amount: order.total });

  } catch (err) {
    console.error('retryPayment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Verify a retried payment and mark the existing order as paid — does NOT
 * create a new order document, just updates the existing failed one.
 */
const verifyRetryPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    const userId = req.session.userId;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'This payment does not match the order' });
    }

    // Cross-check captured amount against the order's stored total
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const expectedPaise = Math.round(order.total * 100);

    if (payment.amount !== expectedPaise) {
      console.error(`Retry payment amount mismatch — captured ${payment.amount}, expected ${expectedPaise}`);
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match this order. Please contact support.'
      });
    }

    order.paymentStatus     = 'paid';
    order.status            = order.status === 'failed' ? 'pending' : order.status;
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    res.json({ success: true, orderId: order._id });

  } catch (err) {
    console.error('verifyRetryPayment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  placeorder,
  onlineorder,
  verifyOnlineOrder,
  placeOrderWallet,
  loadordersuccess,
  loadorder,
  loadorderdetails,
  cancelOrder,
  returnorder,
  cancelOrderItem,
  retryPayment,
  verifyRetryPayment,
};