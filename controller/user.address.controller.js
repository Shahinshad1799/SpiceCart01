const usermodel = require("../model/usermodel");
const addressmodel = require("../model/addressmodel");

const loadaddaddress = (req, res) => {
  res.render("user/addaddress");
};

const loadaddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const user = await usermodel.findById(userId).select("fullname profileImage email");
    const addresses = await addressmodel.find({ userId });

    res.render("user/address", { user, addresses, currentPage: 'address' });
  } catch (error) {
    console.log("Load Address Error:", error);
    res.status(500).send("Server Error");
  }
};

const addaddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const { fullname, phonenumber, address, appartment, city, state, zipcode, isdefault } = req.body;
    const setAsDefault = isdefault === "on";

    if (setAsDefault) {
      await addressmodel.updateMany({ userId }, { $set: { isdefault: false } });
    }

    await addressmodel.create({ userId, fullname, phonenumber, address, appartment, city, state, zipcode, isdefault: setAsDefault });

    res.redirect("/address");
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

// ── ADD ADDRESS (AJAX — used from checkout) ───────────────────
const addAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { fullname, address, city, state, zipcode, phonenumber } = req.body;

    // Validate
    if (!fullname || !address || !city || !state || !zipcode || !phonenumber) {
      return res.json({ success: false, message: "All fields are required" });
    }

    // If no address exists yet, make this one default
    const existingCount = await addressmodel.countDocuments({ userId });
    const isdefault = existingCount === 0;

    const newAddress = new addressmodel({
      userId,
      fullname,
      address,
      city,
      state,
      zipcode,
      phonenumber,
      isdefault
    });

    await newAddress.save();

    res.json({ success: true, message: "Address added successfully" });

  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

// ── EDIT ADDRESS (AJAX — used from checkout) ──────────────────
const editAddress = async (req, res) => {
  try {
    const userId    = req.session.userId;
    const addressId = req.params.addressId;
    const { fullname, address, city, state, zipcode, phonenumber } = req.body;

    // Validate
    if (!fullname || !address || !city || !state || !zipcode || !phonenumber) {
      return res.json({ success: false, message: "All fields are required" });
    }

    // Make sure the address belongs to this user
    const existing = await addressmodel.findOne({ _id: addressId, userId });

    if (!existing) {
      return res.json({ success: false, message: "Address not found" });
    }

    await addressmodel.findByIdAndUpdate(addressId, {
      fullname,
      address,
      city,
      state,
      zipcode,
      phonenumber
    });

    res.json({ success: true, message: "Address updated successfully" });

  } catch (err) {
    console.log(err);
    res.json({ success: false, message: "Something went wrong" });
  }
};

const loadEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.userId;

    const address = await addressmodel.findOne({ _id: addressId, userId });
    if (!address) return res.status(404).send("Address not found");

    res.render("user/editaddress", { address });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

const updateAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.userId;
    const { fullname, phonenumber, address, apartment, city, state, zipcode, isdefault } = req.body;

    const isDefaultValue = isdefault === "on";
    if (isDefaultValue) await addressmodel.updateMany({ userId }, { $set: { isdefault: false } });

    const updatedAddress = await addressmodel.findOneAndUpdate({ _id: addressId, userId }, { fullname, phonenumber, address, apartment, city, state, zipcode, isdefault: isDefaultValue }, { new: true });

    if (!updatedAddress) return res.status(404).send("Address not found");

    res.redirect("/address");
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.userId;

    const address = await addressmodel.findOne({ _id: addressId, userId });
    if (!address) return res.status(404).send("Address not found");

    await addressmodel.findByIdAndDelete(addressId);

    res.redirect("/address");
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  loadaddaddress,
  loadaddress,
  addaddress,
  addAddress,
  editAddress,
  loadEditAddress,
  updateAddress,
  deleteAddress,
};