const ordermodel = require("../model/ordermodel");
const PDFDocument = require("pdfkit");

// Statuses that should NOT count toward revenue / items-sold KPIs.
// Kept in one place so the report page, CSV export, and PDF export can never disagree.
const NON_REVENUE_STATUSES = ["cancelled", "returned"];

// Must match the actual Order schema status enum exactly, or filtering silently
// breaks for statuses this list is missing (e.g. "delivered" used to be absent
// here, so admins could never filter delivered orders).
const ALLOWED_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];

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

/** Utility: page number array with ellipsis */
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
    if (status && ALLOWED_STATUSES.includes(status.toLowerCase())) {
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
          totalRevenue:     { $sum: { $cond: [{ $in: ["$status", NON_REVENUE_STATUSES] }, 0, "$total"] } },
          totalItemsSold:   {
            $sum: {
              $cond: [
                { $in: ["$status", NON_REVENUE_STATUSES] },
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
    if (status && ALLOWED_STATUSES.includes(status.toLowerCase())) {
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
        const customer  = (o.userId?.fullname || "").toLowerCase();
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
      paymentMethod: o.paymentMethod === "online" ? "Online" : (o.paymentMethod === "wallet" ? "Wallet" : "Cash on Delivery"),
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
    if (status && ALLOWED_STATUSES.includes(status.toLowerCase())) {
      filter.status = status.toLowerCase();
    }

    const orders = await ordermodel.find(filter)
      .populate("userId", "fullname email")   // was "name email" — schema field is fullname
      .sort({ createdAt: -1 })
      .lean();

    const rows = [
      ["Order ID", "Date", "Customer", "Email", "Items", "Payment Method", "Status", "Amount (Rs.)"],
      ...orders.map((o) => [
        o._id.toString(),
        formatDate(o.createdAt),
        o.userId?.fullname || "Unknown",              // was o.userId?.name
        o.userId?.email    || "",
        (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0),  // was o.orderedItems
        o.paymentMethod === "online" ? "Online" : (o.paymentMethod === "wallet" ? "Wallet" : "Cash on Delivery"),
        o.status || "pending",
        (o.total || 0).toFixed(2),                    // was o.totalAmount
      ]),
    ];

    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

    // UTF-8 BOM so Excel renders the ₹/Rs. text correctly instead of mangling it (â‚¹)
    const csvWithBom = "\uFEFF" + csv;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sales-report-${Date.now()}.csv"`);
    res.send(csvWithBom);
  } catch (err) {
    console.error("exportSalesCSV error:", err);
    res.status(500).send("Export failed.");
  }
};

// ─── PDF Export ──────────────────────────────────────────────────────────────

const exportSalesPDF = async (req, res) => {
  try {
    const { preset = "month", startDate, endDate, status } = req.query;

    // ── Reuse same date logic as loadSalesReport ──────────────────
    const { startDate: start, endDate: end } = resolveDateRange(preset, startDate, endDate);

    const query = { createdAt: { $gte: start, $lte: end } };
    if (status && ALLOWED_STATUSES.includes(status.toLowerCase())) {
      query.status = status.toLowerCase();
    }

    const orders = await ordermodel.find(query)
      .populate("userId", "fullname email")
      .sort({ createdAt: -1 });

    // ── Build PDF ─────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="spicecart-report-${preset}.pdf"`
    );
    doc.pipe(res);

    // ── Header ────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 70).fill("#F97316");
    doc.fillColor("#ffffff")
       .fontSize(22).font("Helvetica-Bold")
       .text("SpiceCart — Sales Report", 40, 22);
    doc.fontSize(10).font("Helvetica")
       .text(`Period: ${start.toDateString()}  →  ${end.toDateString()}`, 40, 50);
    doc.fillColor("#000000").moveDown(3);

    // ── Summary KPIs ──────────────────────────────────────────────
    const totalRevenue  = orders
      .filter(o => !NON_REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const totalCancelled = orders.filter(o => o.status === "cancelled").length;

    const kpiY = 90;
    const kpis = [
      { label: "Total Orders",     value: orders.length },
      { label: "Total Revenue",    value: `Rs.${totalRevenue.toLocaleString("en-IN")}` },
      { label: "Cancelled Orders", value: totalCancelled },
    ];

    kpis.forEach((kpi, i) => {
      const x = 40 + i * 175;
      doc.rect(x, kpiY, 160, 55).fillAndStroke("#FFF7ED", "#F97316");
      doc.fillColor("#EA580C").fontSize(9).font("Helvetica-Bold")
         .text(kpi.label, x + 10, kpiY + 10, { width: 140 });
      doc.fillColor("#111").fontSize(16).font("Helvetica-Bold")
         .text(String(kpi.value), x + 10, kpiY + 26, { width: 140 });
    });

    doc.moveDown(5);

    // ── Table Header ──────────────────────────────────────────────
    const tableTop = kpiY + 75;
    const cols = { id: 40, date: 110, customer: 210, items: 340, method: 390, status: 450, amount: 510 };

    doc.rect(40, tableTop, doc.page.width - 80, 22).fill("#F97316");
    doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
    doc.text("ORDER ID",  cols.id,       tableTop + 7);
    doc.text("DATE",      cols.date,     tableTop + 7);
    doc.text("CUSTOMER",  cols.customer, tableTop + 7);
    doc.text("ITEMS",     cols.items,    tableTop + 7);
    doc.text("PAYMENT",   cols.method,   tableTop + 7);
    doc.text("STATUS",    cols.status,   tableTop + 7);
    doc.text("AMOUNT",    cols.amount,   tableTop + 7);

    // ── Table Rows ────────────────────────────────────────────────
    let y = tableTop + 25;
    doc.fontSize(8).font("Helvetica");

    orders.forEach((order, i) => {
      // New page if needed
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }

      // Alternating row bg
      if (i % 2 === 0) {
        doc.rect(40, y - 4, doc.page.width - 80, 18).fill("#FFF7ED");
      }

      const shortId   = order._id.toString().slice(-6).toUpperCase();
      const date      = new Date(order.createdAt).toLocaleDateString("en-IN");
      const customer  = order.userId?.fullname || "N/A";
      const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
      const method    = (order.paymentMethod || "").replace("_", " ");
      const status    = order.status || "pending";
      const amount    = `Rs.${(order.total || 0).toLocaleString("en-IN")}`;

      doc.fillColor("#111");
      doc.text(`#${shortId}`, cols.id,       y, { width: 65 });
      doc.text(date,           cols.date,     y, { width: 95 });
      doc.text(customer,       cols.customer, y, { width: 125, ellipsis: true });
      doc.text(`${itemCount}`, cols.items,    y, { width: 45 });
      doc.text(method,         cols.method,   y, { width: 55 });
      doc.text(status,         cols.status,   y, { width: 55 });
      doc.text(amount,         cols.amount,   y, { width: 60 });

      y += 18;
    });

    // ── Footer ────────────────────────────────────────────────────
    doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill("#F97316");
    doc.fillColor("#fff").fontSize(8).font("Helvetica")
       .text(
         `Generated on ${new Date().toLocaleString("en-IN")}  •  SpiceCart Admin`,
         40, doc.page.height - 22,
         { align: "center", width: doc.page.width - 80 }
       );

    doc.end();
  } catch (err) {
    console.log("PDF export error:", err);
    res.status(500).send("Failed to generate PDF");
  }
};

module.exports = {
  loadSalesReport,
  exportSalesCSV,
  exportSalesPDF,
};