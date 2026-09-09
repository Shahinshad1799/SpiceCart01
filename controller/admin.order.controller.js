const ordermodel = require("../model/ordermodel");
const productmodel = require("../model/productmodel");
const { getOrCreateWallet, creditWallet } = require("../utils/walletHelper");

const loadorder = async (req, res) => {
  try {
    const search    = req.query.search    || "";
    const status    = req.query.status    || "";
    const dateRange = req.query.dateRange || "";
    const page      = parseInt(req.query.page) || 1;

    const limit = 5;
    const skip  = (page - 1) * limit;

    // ── Build query ───────────────────────────────────────────────
    const query = {};

    // 1. Text search (status / paymentStatus / paymentMethod)
    if (search) {
      query.$or = [
        { status:        { $regex: search, $options: "i" } },
        { paymentStatus: { $regex: search, $options: "i" } },
        { paymentMethod: { $regex: search, $options: "i" } },
      ];
    }

    // 2. Status dropdown filter
    if (status) {
      query.status = status;
    }

    // 3. Date range filter
    if (dateRange) {
      const now   = new Date();
      let   start = new Date();

      if      (dateRange === "today")  { start.setHours(0, 0, 0, 0); }
      else if (dateRange === "7days")  { start.setDate(now.getDate() - 7); }
      else if (dateRange === "30days") { start.setDate(now.getDate() - 30); }
      else if (dateRange === "year")   { start = new Date(now.getFullYear(), 0, 1); }

      query.createdAt = { $gte: start };
    }
    const returnRequests = await ordermodel.find({ "returnRequest.status": "requested" });
    // ── DB calls ──────────────────────────────────────────────────
    const [orders, totalOrders] = await Promise.all([
      ordermodel
        .find(query)
        .populate("userId", "name email")
        .sort({ returnRequests: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      ordermodel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalOrders / limit) || 1;

    res.render("admin/order", {
      orders,
      currentPage: page,
      totalPages,
      search: req.query.search || '',
      status,
      dateRange,
    });

  } catch (err) {
    console.error("loadorder error:", err);
    res.redirect("/admin/dashboard");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Fetch current order
    const order = await ordermodel.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // If already cancelled — block any status change
    if (order.status === "cancelled") {
      return res.redirect(`/admin/orders/${id}`);
    }

    // Build update object
    const update = { status };

    // Auto-complete payment when delivered
    if (status === "delivered") {
      update.paymentStatus = "paid";
    }

    await ordermodel.findByIdAndUpdate(id, update);
    res.redirect(`/admin/orders/${id}`);

  } catch (err) {
    console.error("updateOrderStatus error:", err);
    res.redirect("/admin/orders");
  }
};

const loadorderdetails = async (req, res) => {
  try {

    const orderId = req.params.id;

    const order = await ordermodel
      .findById(orderId)
      .populate("userId");
    // important return
    if (!order) {
      return res.render("admin/order", {
        orders: [],
        search: "",
        status: "",
        dateRange: "",
        currentPage: 1,
        totalPages: 1
      });
    }

    res.render("admin/orderdetails", {
      order
    });

  } catch (error) {

    console.log(error);

    res.status(500).send("Server Error");

  }
};

const approveReturn = async (req, res) => {

  try {

    const order = await ordermodel.findById(req.params.id);

    if (!order) {
      return res.redirect("/admin/order");
    }

    // restore stock
    for (const item of order.items) {

      await productmodel.findOneAndUpdate(
        {
          _id: item.productId,
          "variants._id": item.variantId
        },
        {
          $inc: {
            "variants.$.stock": item.quantity
          }
        }
      );

    }

    // credit refund to wallet
    await creditWallet(
      order.userId,
      order.total,
      `Refund for returned order #${order._id.toString().slice(-6).toUpperCase()}`,
      order._id
    );

    // update return status
    order.returnRequest.status = "completed";

    // update order status
    order.status = "returned";

    await order.save();

    res.redirect(`/admin/orders/${order._id}?returnApproved=true&amount=${order.total}`);

  } catch (error) {

    console.log(error);

    res.redirect("/admin/order");

  }

};

const rejectReturn = async (req, res) => {

  try {

    const order = await ordermodel.findById(req.params.id);

    if (!order) {
      return res.redirect("/admin/order");
    }

    order.returnRequest.status = "rejected";

    await order.save();

    res.redirect(`/admin/orders/${order._id}?returnRejected=true`);

  } catch (error) {

    console.log(error);

    res.redirect("/admin/orders");

  }

};

// admin.order.controller.js
const { getItemRefundAmount } = require('../utils/Orderpricing');

const approveReturnItem = async (req, res) => {
  try {
    const { id } = req.params;          // order id
    const { productId } = req.body;

    const order = await ordermodel.findById(id);
    if (!order) return res.json({ success: false, message: 'Order not found' });

    const item = order.items.find(i => i.productId.toString() === productId);
    if (!item) return res.json({ success: false, message: 'Item not found' });
    if (item.itemStatus !== 'return_requested') {
      return res.json({ success: false, message: 'This item has no pending return request' });
    }

    // Restore stock
    await productmodel.findOneAndUpdate(
      { _id: item.productId, 'variants._id': item.variantId },
      { $inc: { 'variants.$.stock': item.quantity } }
    );

    // Refund — computed BEFORE mutating order.subtotal/discount,
    // using the order's current (pre-this-return) subtotal/discount
    let refundAmount = 0;
    if (order.paymentStatus === 'paid') {
      refundAmount = getItemRefundAmount({
        itemPrice:    item.unitPrice,
        itemQuantity: item.quantity,
        subtotal:     order.subtotal,
        discount:     order.discount,
      });

      await creditWallet(
        order.userId,
        refundAmount,
        `Refund for returned item "${item.productName}" in order #${order._id.toString().slice(-6).toUpperCase()}`,
        order._id
      );
    }

    item.itemStatus = 'returned';

    // Recalculate order totals — same proration pattern as cancelOrderItem
    const originalSubtotal = order.subtotal;
    const activeItems = order.items.filter(i => !['cancelled', 'returned'].includes(i.itemStatus));
    const newSubtotal  = activeItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const remainingRatio = originalSubtotal > 0 ? newSubtotal / originalSubtotal : 0;

    order.discount = Math.round((order.discount || 0) * remainingRatio);
    order.subtotal = newSubtotal;
    order.tax      = parseFloat((order.subtotal * 0.05).toFixed(2));
    order.shipping = order.subtotal >= 500 ? 0 : 50;
    order.total    = parseFloat((order.subtotal + order.tax + order.shipping - order.discount).toFixed(2));

    // If nothing active/returned-pending is left, mark whole order returned
    const remainingActive = order.items.filter(i => i.itemStatus === 'active' || i.itemStatus === 'return_requested');
    if (remainingActive.length === 0) order.status = 'returned';

    await order.save();
    res.redirect(`/admin/orders/${order._id}?success=true&refundAmount=${refundAmount}`);

  } catch (err) {
    console.error('approveReturnItem error:', err);
    res.json({ success: false, message: err.message });
  }
};

const rejectReturnItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId } = req.body;

    const order = await ordermodel.findById(id);
    if (!order) return res.json({ success: false, message: 'Order not found' });

    const item = order.items.find(i => i.productId.toString() === productId);
    if (!item || item.itemStatus !== 'return_requested') {
      return res.json({ success: false, message: 'No pending return request for this item' });
    }

    item.itemStatus = 'return_rejected';
    await order.save();
    res.redirect(`/admin/orders/${order._id}?success=true`);

  } catch (err) {
    console.error('rejectReturnItem error:', err);
    res.json({ success: false, message: err.message });
  }
};



module.exports = {
  loadorder,
  loadorderdetails,
  updateOrderStatus,
  approveReturn,
  rejectReturn,
  approveReturnItem,
  rejectReturnItem
};