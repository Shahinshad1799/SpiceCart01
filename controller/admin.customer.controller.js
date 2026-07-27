const usermodel = require("../model/usermodel");

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
      .sort({ googleId: -1, name: 1, createdAt: -1 })
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

const blockcustomer = async (req, res) => {
  try {
    const id = req.params.id;
    await usermodel.findByIdAndUpdate(id, { status: "Blocked" });
    res.redirect("/admin/customer");
  } catch (error) {
    console.log("Block Error:", error);
    res.status(500).send("Server Error");
  }
};

const unblockcustomer = async (req, res) => {
  try {
    const id = req.params.id;
    await usermodel.findByIdAndUpdate(id, { status: "Active" });
    res.redirect("/admin/customer");
  } catch (error) {
    console.log("Unblock Error:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  loadcustomer,
  blockcustomer,
  unblockcustomer,
};