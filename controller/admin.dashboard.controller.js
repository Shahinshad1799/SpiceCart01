const usermodel = require("../model/usermodel");
const productmodel = require("../model/productmodel");
const ordermodel = require("../model/ordermodel");

// ── Date range resolver ─────────────────────────────────────────────────
function resolveDateRange(query) {
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let range = query.range || "all";
  let start = null;
  let end = null;

  switch (range) {
    case "today":
      start = todayStart;
      end = todayEnd;
      break;

    case "7d":
      start = new Date(todayStart);
      start.setDate(start.getDate() - 6);
      end = todayEnd;
      break;

    case "30d":
      start = new Date(todayStart);
      start.setDate(start.getDate() - 29);
      end = todayEnd;
      break;

    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = todayEnd;
      break;

    case "custom":
      if (query.startDate && query.endDate) {
        start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
      } else {
        range = "all";
      }
      break;

    case "all":
    default:
      range = "all";
      break;
  }

  return { range, start, end };
}

function toDateOnlyStr(date) {
  return date.toISOString().split("T")[0];
}

// ── Controller ───────────────────────────────────────────────────────────
const loadDashboard = async function (req, res) {
  try {
    const now = new Date();
    const { range, start, end } = resolveDateRange(req.query);

    const dateMatch = start && end ? { createdAt: { $gte: start, $lte: end } } : {};
    const revenueStatusMatch = { status: { $nin: ["cancelled", "returned"] } };

    // ── KPI Cards ──────────────────────────────────────────────────────
    const [revenueRes] = await ordermodel.aggregate([
      { $match: { ...dateMatch, ...revenueStatusMatch } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    const totalRevenue   = revenueRes?.total || 0;
    const totalOrders    = await ordermodel.countDocuments(dateMatch);
    const totalCustomers = await usermodel.countDocuments();
    const totalProducts  = await productmodel.countDocuments();

    // ── Low Stock Alerts (stock <= 10) — live snapshot, not date-filtered
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
        image:  p.images?.[0] || null,
        stock:  minStock,
        urgent: minStock <= 3,
      };
    });

    // ── Recent Orders (last 5, within range) ──────────────────────────
    const recentOrdersDocs = await ordermodel.find(dateMatch)
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

    // ── Chart data ─────────────────────────────────────────────────────
    // Short ranges (today / 7d / 30d / custom <= 31 days) bucket by day.
    // Longer or "all time" ranges bucket by month (last 6 months if "all").
    const spanDays = start && end ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) : null;
    const bucketByDay = spanDays !== null && spanDays <= 31;

    let chartMatch = { ...revenueStatusMatch };
    if (dateMatch.createdAt) {
      chartMatch.createdAt = dateMatch.createdAt;
    } else {
      // "all time" view still caps the chart at the last 6 months so it stays readable
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      chartMatch.createdAt = { $gte: sixMonthsAgo };
    }

    const statsAgg = await ordermodel.aggregate([
      { $match: chartMatch },
      {
        $group: bucketByDay
          ? {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              revenue: { $sum: "$total" },
              orders: { $sum: 1 },
            }
          : {
              _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
              revenue: { $sum: "$total" },
              orders: { $sum: 1 },
            },
      },
      { $sort: bucketByDay ? { _id: 1 } : { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const chartData = statsAgg.map(m => ({
      label:   bucketByDay ? m._id : monthNames[m._id.month - 1],
      revenue: m.revenue,
      orders:  m.orders,
    }));

    const chartRangeLabel =
      range === "all"    ? "Last 6 months" :
      range === "today"  ? "Today" :
      range === "7d"     ? "Last 7 days" :
      range === "30d"    ? "Last 30 days" :
      range === "month"  ? "This month" :
      range === "custom" ? `${toDateOnlyStr(start)} to ${toDateOnlyStr(end)}` :
      "Last 6 months";

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
      chartRangeLabel,
      activeRange:     range,
      filterStartDate: start ? toDateOnlyStr(start) : "",
      filterEndDate:   end ? toDateOnlyStr(end) : "",
      todayStr:        toDateOnlyStr(now),
    });

  } catch (err) {
    console.error("loadDashboard error:", err);
    res.status(500).render("admin/error", { message: "Failed to load dashboard." });
  }
};

module.exports = {
  loadDashboard,
};