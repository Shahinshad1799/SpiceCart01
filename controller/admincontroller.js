
const usermodel = require("../model/usermodel")
const bcrypt = require("bcrypt"); // only if you hash password
require("dotenv").config();
const catagorymodel=require("../model/catagorymodel")
const productmodel=require("../model/productmodel")
const Offer = require("../model/offermodel");
const { productSchema, variantSchema } = require("../validators/productvalidator");
const ordermodel=require("../model/ordermodel")
const couponmodel=require("../model/couponmodel")

const loadadminlogin=function(req,res){
    res.render("admin/login")
}
// ================= LOAD PAGE =================
const loadaddproduct = async (req, res) => {
  try {
    const categories = await catagorymodel.find({ status: "Active" });

    res.render("admin/addproduct", {
      catagory: categories 
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin");
  }
};


// ADD PRODUCT
const addProduct = async (req, res) => {
  try {
    const { name,description } = req.body;
    const categories = await catagorymodel.find({ status: "Active" });

    //  handle images
    const images = req.files && req.files.length > 0
      ? req.files.map(file => file.filename)
      : [];

    //VARIANTS PARSE 
    let variants = [];

    if (req.body.variants) {
      if (Array.isArray(req.body.variants)) {
        variants = req.body.variants;
      } else {
        variants = Object.values(req.body.variants);
      }

      variants = variants.map(v => ({
  name: v.name,
  price: Number(v.price),
  stock: Number(v.stock)
}));
    }
  //  if(!name || !description || !req.body.catagory){
  //   return res.render("admin/addproduct", {
  //     error: "Please fill all required fields",
  //     catagory: categories
  //   });
  //  }

    const parsed = productSchema.safeParse({
      name: req.body.name,
      description: req.body.description,
      catagory: req.body.catagory,
      variants
    });

    if (!parsed.success) {
    const errorMessage = parsed.error.issues[0].message;
 

      return res.render("admin/addproduct", {
        error: errorMessage,
        catagory: categories
      });
    }

    
    if (images.length < 3) {
      return res.render("admin/addproduct", {
        error: "Please upload at least 3 image",
        catagory: categories
      });
    }

    //  CATEGORY CHECK 
    const categoryExists = await catagorymodel.findById(parsed.data.catagory);

    if (!categoryExists) {
      return res.render("admin/addproduct", {
        error: "Invalid category",
        catagory: categories
      });
    }

    //  CREATE PRODUCT
    const newProduct = new productmodel({
      ...parsed.data,
      images
    });

    await newProduct.save();

    res.redirect("/admin/product");

  } catch (error) {
    console.log("ERROR:", error.message);

    const categories = await catagorymodel.find({ status: "Active" });

    res.render("admin/addproduct", {
      error: "Something went wrong",
      catagory: categories
    });
  }
};
const loadproduct = async (req, res) => {
  try {
    const search = req.query.q || "";
    const catagory = req.query.catagory || ""; 
    const page = parseInt(req.query.page) || 1;

    const limit = 5;
    const skip = (page - 1) * limit;
   

    let searchQuery = {
      name: { $regex: search, $options: "i" } 
    };

    if (catagory) {
      searchQuery.catagory = catagory;
    }

    const products = await productmodel
      .find(searchQuery)
      .populate("catagory") 
      .skip(skip)
      .limit(limit);

    const totalProducts = await productmodel.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await catagorymodel.find({ status: "Active" });

    res.render("admin/product", {
      catagory: categories,
      product: products,
      search,
      selectedCatagory: catagory, 
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin");
  }
};
const loadaddcatagory=(req,res)=>{
  res.render("admin/addcatagory")
}



const addingcatagory = async (req, res) => {
  try {

    const { name, description } = req.body;

    const existing_catagory = await catagorymodel.findOne({ name });

    if (existing_catagory) {

      const catagory = await catagorymodel.find();

      return res.render("admin/addcatagory", {
        catagory,
        error: "Category already exists"
      });
    }

    const image = req.file ? req.file.filename : null;

    const new_catagory = new catagorymodel({
      name,
      description,
      image
    });

    await new_catagory.save();

    res.redirect("/admin/catagory");

  } catch (error) {
    console.log(error);
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
      
      req.session.loginError = "Invalid email or password"; 
      return res.redirect("/admin/login");
    }

    // Set session
    req.session.admin = "admin"; 

    // Redirect to admin dashboard
    return res.redirect("/admin/customer");

  } catch (error) {
    console.log("Admin Login Error:", error);
    req.session.loginError = "Server error, try again!";
    return res.redirect("/admin/login");
  }
};


const loadcatagory = async (req, res) => {
  try {
    const search = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const searchQuery = {
      name: { $regex: search, $options: "i" }
    };

    const catagory = await catagorymodel
      .find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await catagorymodel.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCategories / limit);

    // count products for each category
    const categoryWithCount = await Promise.all(
      catagory.map(async (cat) => {
        const productCount = await productmodel.countDocuments({ catagory: cat._id });
        return { ...cat.toObject(), productCount };
      })
    );

    res.render("admin/catagory", {
      catagory: categoryWithCount,
      search,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/category");
  }
};
const loadcustomer = async (req, res) => {
  try {
    const search = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    // Search filter
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { customerId: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const totalCustomers = await usermodel.countDocuments(filter);
    const totalPages = Math.ceil(totalCustomers / limit);

    // filter here
    const customers = await usermodel
      .find(filter)
      .sort({ googleId: -1 ,name:1})
      .skip(skip)
      .limit(limit);

    res.render("admin/customer", {
      customers,
      search,
      currentPage: page,
      totalPages,
    });

  } catch (error) {
    console.log("Customer Load Error:", error);
    res.status(500).send("Server Error");
  }
};
const blockcustomer= async (req, res) => {
  try {
    const id = req.params.id;
    await usermodel.findByIdAndUpdate(id, { status: "Blocked" });
    res.redirect("/admin/customer");
  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
}
const unblockcustomer= async (req, res) => {
  try {
    const id = req.params.id;
    await usermodel.findByIdAndUpdate(id, { status: "Active" });
    res.redirect("/admin/customer");
  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
}
const blockcatagory = async (req, res) => {
  try {
    const id = req.params.id;
    const page = req.query.page || 1; 

    await catagorymodel.findByIdAndUpdate(id, { status: "Blocked" });

    res.redirect(`/admin/catagory?page=${page}`); 

  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
};

const unblockcatagory = async (req, res) => {
  try {
    const id = req.params.id;
    const page = req.query.page || 1; 

    await catagorymodel.findByIdAndUpdate(id, { status: "Active" });

    res.redirect(`/admin/catagory?page=${page}`); 

  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
};
const logout=function(req, res){
    res.render("/login")
}
const blockproduct= async (req, res) => {
  try {
    const id = req.params.id;
    await productmodel.findByIdAndUpdate(id, { status: "Blocked" });
    res.redirect("/admin/product");
  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
}
const unblockproduct= async (req, res) => {
  try {
    const id = req.params.id;
    await productmodel.findByIdAndUpdate(id, { status: "Active" });
    res.redirect("/admin/product");
  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
}

const loadEditCatagory = async (req, res) => {
  try {
    const id = req.params.id;

    const catagory = await catagorymodel.findById(id);

    if (!catagory) {
      return res.redirect('/admin/catagory');
    }

    res.render('admin/editcatagory', {
      catagory
    });

  } catch (error) {
    console.log(error);
    res.redirect('/admin/catagory');
  }
};
const updateCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;

    // optional: check duplicate name
    const existing = await catagorymodel.findOne({
      name: name.trim(),
      _id: { $ne: id }
    });

    if (existing) {
      return res.render('admin/editcatagory', {
        catagory: { _id: id, name, description },
        error: 'Category already exists'
      });
    }

    const updateData = {
      name: name.trim(),
      description: description.trim()
    };

    // if image uploaded
    if (req.file) {
      updateData.image = req.file.filename;
    }

    await catagorymodel.findByIdAndUpdate(id, updateData);

    res.redirect('/admin/catagory');

  } catch (error) {
    console.log(error);
    res.redirect('/admin/catagory');
  }
};
const loadeditproduct = async (req, res) => {
  try {
    const productId = req.params.id;

    //  Get product with category
    const product = await productmodel
      .findById(productId)
      .populate("catagory");

    // Get all categories
    const categories = await catagorymodel.find({ status: "Active" });

    // If product not found
    if (!product) {
      return res.redirect("/admin/product");
    }

    res.render("admin/editproduct", {
      product,
        variants: product?.variants || [],
      catagory: categories
    });

  } catch (error) {
    console.log(error);
    res.redirect("/admin/product");
  }
};


const editproduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const { name, description, catagory } = req.body;

    //  1. Handle Variants
    let variants = [];

    if (req.body.variants) {
      variants = Object.values(req.body.variants).map(v => ({
        name: v.name,
        price: Number(v.price),
        stock: Number(v.stock)
      }));
    }

    //  2. Handle Images
    // images user kept
let existingImages = req.body.existingImages || [];

if (!Array.isArray(existingImages)) {
  existingImages = [existingImages];
}
    // new uploaded images
    const newImages = req.files?.map(file => file.filename) || [];

    // final images
    const finalImages = [...existingImages, ...newImages];

    //  3. Update product
    await productmodel.findByIdAndUpdate(productId, {
      name,
      description,
      catagory,
      variants,
      images: finalImages
    });
  console.log("FILES:", req.files);
    res.redirect("/admin/product");

  } catch (error) {
    console.log(error);
    res.status(500).send("Error updating product");
  }
};


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

    // ── DB calls ──────────────────────────────────────────────────
    const [orders, totalOrders] = await Promise.all([
      ordermodel
        .find(query)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
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
 
    //  If already cancelled — block any status change
    if (order.status === "cancelled") {
      return res.redirect(`/admin/orders/${id}`);
    }
 
    // Build update object
    const update = { status };
 
    //  Auto-complete payment when delivered
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
    //  important return
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

         await productmodel.updateOne(
            {
               _id: item.productId,
               "variants._id": item.variantId
            },
            {
               $inc: {
                  "variants.$.quantity": item.quantity
               }
            }
         );

      }

      // update return status
      order.returnRequest.status = "completed";

      // update order status
      order.status = "returned";

      await order.save();

      res.redirect(`/admin/orders/${order._id}`);

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

      res.redirect(`/admin/orders/${order._id}`);

   } catch (error) {

      console.log(error);

      res.redirect("/admin/orders");

   }

};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a date range from a preset string or explicit start/end strings.
 * Returns { startDate, endDate } as Date objects.
 */
function resolveDateRange(preset, customStart, customEnd) {
  const now = new Date();
  let startDate, endDate;

  switch (preset) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate   = new Date();
      break;
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate   = new Date();
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate   = new Date();
      break;
    case "custom":
      startDate = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      endDate   = customEnd   ? new Date(customEnd)   : new Date();
      endDate.setHours(23, 59, 59, 999);
      break;
    default: // "month" as default
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate   = new Date();
  }

  return { startDate, endDate };
}

/** Format a Date as "MMM DD, YYYY" */
function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day:   "2-digit",
    year:  "numeric",
  });
}

// ─── Main Controller ─────────────────────────────────────────────────────────

const loadSalesReport = async function (req, res) {
  try {
    const {
      preset      = "month",
      startDate:  rawStart,
      endDate:    rawEnd,
      search      = "",
      status      = "",
      page        = "1",
      limit       = "10",
    } = req.query;

    const currentPage  = Math.max(1, parseInt(page));
    const pageSize     = Math.min(100, Math.max(1, parseInt(limit)));
    const skip         = (currentPage - 1) * pageSize;

    const { startDate, endDate } = resolveDateRange(preset, rawStart, rawEnd);

    // ── Base filter (date range) ──────────────────────────────────────────
    const baseFilter = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    // ── Optional status filter ────────────────────────────────────────────
    const allowedStatuses = ["pending", "processing", "completed", "cancelled", "returned"];
    if (status && allowedStatuses.includes(status.toLowerCase())) {
      baseFilter.status = status.toLowerCase();
    }

    // ── Optional search (Order ID or customer name) ───────────────────────
    // We search after populate, so we use $expr / $lookup approach via aggregation.
    // Simple approach: if search looks like an order ID prefix, add to filter.
    const searchTrimmed = search.trim();

    // ── Aggregation: summary metrics (always over the full date range, ignoring search/status for the KPI cards) ──
   const [summaryRaw] = await ordermodel.aggregate([
  { $match: baseFilter },
  {
    $group: {
      _id:              null,
      totalOrders:      { $sum: 1 },
      totalRevenue:     { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$total"] } },
      totalItemsSold:   { 
        $sum: { 
          $cond: [
            { $eq: ["$status", "cancelled"] }, 
            0, 
            { $sum: "$items.quantity" }
          ] 
        } 
      },
      cancelledOrders:  { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
    },
  },
]);
    const summary = summaryRaw || {
      totalOrders:     0,
      totalRevenue:    0,
      totalItemsSold:  0,
      cancelledOrders: 0,
    };

    // ── Build table-level filter (includes status + search) ───────────────
    const tableFilter = { ...baseFilter };
    if (status && allowedStatuses.includes(status.toLowerCase())) {
      tableFilter.status = status.toLowerCase();
    }

    // ── Fetch orders with populate ────────────────────────────────────────
    let ordersQuery = ordermodel.find(tableFilter)
     .populate({ path: "userId", model: "user", select: "fullname email" })
      .sort({ createdAt: -1 });

    // Apply search after populate — we fetch all in range then filter in JS.
    // For large datasets consider a denormalised customerName field on Order.
    let allOrders = await ordersQuery.lean();

    if (searchTrimmed) {
      const lower = searchTrimmed.toLowerCase();
      allOrders = allOrders.filter((o) => {
        const orderId   = (o._id?.toString() || "").toLowerCase();
        const customer  = (o.userId?.name || "").toLowerCase();
        const email     = (o.userId?.email || "").toLowerCase();
        return orderId.includes(lower) || customer.includes(lower) || email.includes(lower);
      });
    }

    const totalResults = allOrders.length;
    const totalPages   = Math.ceil(totalResults / pageSize);
    const paginatedOrders = allOrders.slice(skip, skip + pageSize);

    // ── Shape orders for the view ─────────────────────────────────────────
const orders = paginatedOrders.map((o) => ({
  _id:           o._id.toString(),
  shortId:       "#SC-" + o._id.toString().slice(-4).toUpperCase(),
  date:          formatDate(o.createdAt),
 customerName:  o.userId?.fullname  || "Unknown",
customerEmail: o.userId?.email     || "",
initials:      (o.userId?.fullname || "?")
                 .split(" ")
                 .map((w) => w[0])
                 .join("")
                 .slice(0, 2)
                 .toUpperCase(),
  itemCount:     (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0),
  paymentMethod: o.paymentMethod === "online" ? "Online" : "Cash on Delivery",
  paymentStatus: o.paymentStatus || "pending",
  status:        o.status || "pending",
  amount:        (o.total || 0).toFixed(2),
  // first item's image for a thumbnail preview
  productImage:  o.items?.[0]?.productImage || null,
  productName:   o.items?.[0]?.productName || "",
}));

    // ── Pagination helpers for EJS ────────────────────────────────────────
    const pagination = {
      currentPage,
      totalPages,
      totalResults,
      pageSize,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
      pages: buildPageNumbers(currentPage, totalPages),
    };

    // ── Date label for header ─────────────────────────────────────────────
    const dateLabel = `${formatDate(startDate)} – ${formatDate(endDate)}`;

    res.render("admin/report", {
      orders,
      summary,
      pagination,
      dateLabel,
      filters: { preset, startDate: rawStart || "", endDate: rawEnd || "", search, status },
    });
  } catch (err) {
    console.error("loadSalesReport error:", err);
    res.status(500).render("admin/error", { message: "Failed to load sales report." });
  }
};

// ─── CSV Export ──────────────────────────────────────────────────────────────

const exportSalesCSV = async function (req, res) {
  try {
    const { preset = "month", startDate: rawStart, endDate: rawEnd, status = "" } = req.query;
    const { startDate, endDate } = resolveDateRange(preset, rawStart, rawEnd);

    const filter = { createdAt: { $gte: startDate, $lte: endDate } };
    if (status) filter.status = status.toLowerCase();

    const orders = await ordermodel.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const rows = [
      ["Order ID", "Date", "Customer", "Email", "Items", "Payment Method", "Status", "Amount (₹)"],
      ...orders.map((o) => [
        o._id.toString(),
        formatDate(o.createdAt),
        o.userId?.name  || "Unknown",
        o.userId?.email || "",
        (o.orderedItems || []).reduce((s, i) => s + (i.quantity || 1), 0),
        o.paymentMethod === "online" ? "Online" : "Cash on Delivery",
        o.status || "pending",
        (o.totalAmount || 0).toFixed(2),
      ]),
    ];

    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="sales-report-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("exportSalesCSV error:", err);
    res.status(500).send("Export failed.");
  }
};

// ─── Utility: page number array with ellipsis ────────────────────────────────

function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current]);
  for (let d = -2; d <= 2; d++) {
    const p = current + d;
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result = [];

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (sorted[i + 1] && sorted[i + 1] - sorted[i] > 1) result.push("...");
  }

  return result;
}

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
const loadAddOffer = async function(req, res) {
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
}

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
        res.status(500).json({ success: false, message: "Server error" });
    }
}

const loadAddCoupon = async (req, res) => {
    try {
        res.render("admin/addcoupon");
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
}

const createCoupon = async (req, res) => {
    try {
        const { code, isActive, discountType, discountValue, maxDiscount, minPurchase, usageLimit, expiryDate } = req.body;

        const existing = await couponmodel.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: "Coupon code already exists" });
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
        res.status(200).json({ success: true, message: "Coupon created successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

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
    res.redirect("/admin/coupons");
  }
};


const loadDashboard = async function (req, res) {
  try {
    const now       = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── KPI Cards ──────────────────────────────────────────────────────
    const [revenueRes] = await ordermodel.aggregate([
      { $match: { status: { $nin: ["cancelled", "returned"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    const totalRevenue   = revenueRes?.total || 0;
    const totalOrders    = await ordermodel.countDocuments();
    const totalCustomers = await usermodel.countDocuments();
    const totalProducts  = await productmodel.countDocuments();

    // ── Low Stock Alerts (stock <= 10) ────────────────────────────────
    // Adjust field path to match your product schema
    const lowStockProducts = await productmodel.find({
  "variants.stock": { $lte: 10 },
  status: "Active"
})
.select("name images variants")
.limit(5)
.lean();

   const lowStock = lowStockProducts.map(p => {
  const minStock = p.variants.length
    ? Math.min(...p.variants.map(v => v.stock ?? 0))
    : 0;

  return {
    name:   p.name,
    image:  p.images?.[0] || null,   // ← already correct
    stock:  minStock,
    urgent: minStock <= 3,
  };
});

    // ── Recent Orders (last 5) ────────────────────────────────────────
    const recentOrdersDocs = await ordermodel.find()
      .populate({ path: "userId", model: "user", select: "fullname" })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentOrders = recentOrdersDocs.map(o => ({
      shortId:      "#SC-" + o._id.toString().slice(-4).toUpperCase(),
      customerName: o.userId?.fullname || "Unknown",
      initials:     (o.userId?.fullname || "?")
                      .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      productName:  o.items?.[0]?.productName || "—",
      amount:       (o.total || 0).toFixed(2),
      status:       o.status || "pending",
    }));

    // ── Monthly revenue for sparkline (last 6 months) ─────────────────
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyStats = await ordermodel.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: { $nin: ["cancelled", "returned"] } } },
      { $group: {
          _id:     { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders:  { $sum: 1 },
      }},
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const chartData = monthlyStats.map(m => ({
      label:   monthNames[m._id.month - 1],
      revenue: m.revenue,
      orders:  m.orders,
    }));

    res.render("admin/dashbourd", {
      kpi: {
        totalRevenue:    totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
        totalOrders:     totalOrders.toLocaleString(),
        totalCustomers:  totalCustomers.toLocaleString(),
        totalProducts:   totalProducts.toLocaleString(),
      },
      lowStock,
      recentOrders,
      chartData: JSON.stringify(chartData),
    });

  } catch (err) {
    console.error("loadDashboard error:", err);
    res.status(500).render("admin/error", { message: "Failed to load dashboard." });
  }
};

module.exports={
    loadadminlogin,
    loadSalesReport,
    loadcustomer,
    adminLogin,
    blockcustomer,
    unblockcustomer,
    blockcatagory,
    unblockcatagory,
    loadaddproduct,
    loadproduct,
    loadcatagory,
    loadaddcatagory,
    addingcatagory,
    loadEditCatagory,
    updateCategory,
    addProduct,
    loadeditproduct,
    editproduct,
    blockproduct,
    unblockproduct,
    loadorder,
    loadorderdetails,
    updateOrderStatus,
    rejectReturn,
    approveReturn,
    loadSalesReport,
    exportSalesCSV,
    loadOffers,
    loadAddOffer,
    loadCoupons,
toggleCouponStatus,
    loadAddCoupon,
    createCoupon,
    loadEditCoupon,
    updateCoupon,
   loadDashboard,
    logout
}