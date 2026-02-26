const usermodel = require("../model/usermodel");
const otpmodel = require("../model/otpcontroller");
const addressmodel = require("../model/addressmodel");
const generateOTP = require("../utils/otpmanagment");
const bcrypt = require("bcrypt");
const saltround = 10;
const transporter = require("../utils/emailer");
const { render } = require("ejs");

// =======================
// Load Views
// =======================
const loadladingpage = (req, res) => {
  res.render("user/landingpage");
};

const loadsignup = (req, res) => {
  res.render("user/signup");
};

const loadlogin = (req, res) => {
  res.render("user/login");
};

const loadhome = (req, res) => {
  res.render("user/home");
};

const loadforgotpassword = (req, res) => {
  res.render("user/forgotpasword");
};

const loadresetpassword = (req, res) => {
  res.render("user/resetpassword");
};

const loadsuccess = (req, res) => {
  res.render("user/successpassword");
};

const loadchangepassword = (req, res) => {
  res.render("user/changepassword");
};

const loadaddaddress = (req, res) => {
  res.render("user/addaddress");
};

const loadverify = async (req, res) => {
  try {
    const email =
      req.session.email || req.session.tempUser?.email;

    if (!email) {
      return res.redirect("/signup");
    }

    const record = await otpmodel.findOne({ email });

    if (!record) {
      return res.redirect("/signup");
    }

    return res.render("user/otpverification", {
      purpose: req.session.tempUser ? "signup" : "forgot",
      otpExpiry: record.expiresAt.getTime()
    });

  } catch (err) {
    console.log(err);
    res.redirect("/signup");
  }
};
// =======================
// User Profile
// =======================
const loadprofile = async (req, res) => {
  try {
    const userId = req.user?._id || req.session.userId;
    if (!userId) return res.redirect("/login");

    const user = await usermodel.findById(userId);
    res.render("user/profile", { user });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

const loadeditprofile = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const user = await usermodel.findById(userId);
    res.render("user/editprofile", { user });
  } catch (error) {
    console.log(error);
    res.redirect("/profile");
  }
};

const updateprofile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { fullname, phonenumber, dateofbirth } = req.body;

    if (!fullname) {
      return res.render("user/editprofile", {
        user: req.body,
        message: "Full name is required",
      });
    }

    let updateData = { fullname, phonenumber, dateofbirth };

    // Update profile image if uploaded
    if (req.file) {
      updateData.profileImage = req.file.filename;
    }

    await usermodel.updateOne({ _id: userId }, { $set: updateData });

    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    res.redirect("/profile");
  } catch (error) {
    console.log(error);
    res.render("user/editprofile", { message: "Something went wrong" });
  }
};
const deleteProfile= async (req, res) => {
  try {
    const userId = req.session.userId;

    await userModel.findByIdAndUpdate(userId, {
      profileImage: null
    });

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
}

// =======================
// Authentication
// =======================
const registeruser = async (req, res) => {
  try {
    const { fullname, email, password, confirmpassword } = req.body;

    if (!fullname || !email || !password || !confirmpassword) {
      return res.render("user/signup", { error: "Fill the form properly" });
    }

    if (password !== confirmpassword) {
      return res.render("user/signup", { error: "Passwords do not match" });
    }

    const user = await usermodel.findOne({ email });
    if (user) {
      return res.render("user/signup", { error: "User already exists" });
    }

    const hashedpassword = await bcrypt.hash(password, saltround);

    // Save temporary user
    req.session.tempUser = { fullname, email, password: hashedpassword };

    // ✅ Send OTP and get expiry directly
    const otpExpiry = await sendotp(email);

    return res.render("user/otpverification", {
      otpExpiry,   // must always pass this
      purpose: "signup",
      success: "OTP sent to the mail",
    });

  } catch (error) {
    console.log(error);
    return res.render("user/signup", { error: "Something went wrong" });
  }
};
const loginuser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await usermodel.findOne({ email });
    if (!user) return res.render("user/login", { error: "User does not exist" });
    if (user.status === "Blocked") return res.render("user/login", { error: "Your account has been blocked." });

    const isSame = await bcrypt.compare(password, user.password);
    if (!isSame) return res.render("user/login", { error: "Incorrect password" });

    req.session.userId = user._id;
    req.session.save(() => res.redirect("/home"));
  } catch (error) {
    console.log(error);
    res.render("user/login");
  }
};

// =======================
// Password Management
// =======================
const changepassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    console.log("BODY:", req.body);

    const user = await usermodel.findById(req.session.userId);
    if (!user) return res.redirect("/login");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    console.log("Password Match:", isMatch);

    if (!isMatch) return res.render("user/changepassword", { message: "Current password is incorrect" });
    if (newPassword !== confirmPassword) return res.render("user/changepassword", { message: "Passwords do not match" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    console.log("✅ Password Updated");
    res.redirect("/profile");
  } catch (error) {
    console.log("ERROR:", error);
    res.status(500).send("Server Error");
  }
};

const forgotpassword = async (req, res) => {
  try {
    const { email } = req.body;
    req.session.email = email;

    const users = await usermodel.findOne({ email });
    if (!users) return res.render("user/forgotpasword", { message: "Email not registered" });

    const otpExpiry =  await sendotp(email);

    res.render("user/otpverification", { purpose: "forgot" ,otpExpiry});
  } catch (error) {
    console.log(error);
    return res.render("user/forgotpasword", { message: "Something went wrong" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmpassword } = req.body;
    const email = req.session.resetEmail;

    if (!email) return res.redirect("/forgotpassword");
    if (!password || !confirmpassword) return res.render("user/resetpassword", { message: "All fields are required" });
    if (password !== confirmpassword) return res.render("user/resetpassword", { message: "Passwords do not match" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usermodel.updateOne({ email }, { $set: { password: hashedPassword } });

    await otpmodel.deleteMany({ email });
    req.session.resetEmail = null;

    res.render("user/successpassword", { message: "Password reset successful" });
  } catch (error) {
    console.log(error);
    res.render("user/resetpassword", { message: "Something went wrong" });
  }
};

// =======================
// Address Management
// =======================
const loadaddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const user = await usermodel.findById(userId).select("fullname image email");
    const addresses = await addressmodel.find({ userId });

    res.render("user/address", { user, addresses });
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

// =======================
// OTP Management
// =======================
const resendOtp = async (req, res) => {
  try {
    console.log("RESEND ROUTE HIT");
    const email = req.session.email || req.session.tempUser?.email;
    if (!email) return res.json({ success: false });

    const otp = Math.floor(100000 + Math.random() * 900000);
    const hashedOtp = await bcrypt.hash(otp.toString(), 10);
    const expiryTime = Date.now() + 2 * 60 * 1000;

    await otpmodel.deleteMany({ email });

    await otpmodel.create({
      email,
      otp: hashedOtp,
      expiresAt: expiryTime
    });

    await transporter.sendMail({
      to: email,
      subject: "Resend OTP",
      html: `<h1>${otp}</h1>`
    });

    console.log("Resent OTP:", otp);

    // ✅ MUST SEND JSON
    return res.json({
      success: true,
      otpExpiry: expiryTime
    });

  } catch (error) {
    console.log(error);
    return res.json({ success: false });
  }
};
const sendotp = async (email) => {
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);
  const expiryTime=Date.now() + 2 * 60 * 1000

  await otpmodel.deleteMany({ email });
  await otpmodel.create({ email, otp: hashedOtp, expiresAt: expiryTime });

  await transporter.sendMail({ to: email, subject: "OTP Verification", html: `<h1>${otp}</h1>` });
  console.log(otp);
  return expiryTime
};


const veriify = async (req, res) => {
  const { otp, purpose } = req.body;
  try {
if (purpose === "signup") {
  const tempUser = req.session.tempUser;
  if (!tempUser) return res.redirect("/signup");

  const record = await otpmodel.findOne({ email: tempUser.email });
  if (!record) return res.redirect("/signup");

  const isMatch = await bcrypt.compare(otp, record.otp);

  if (!isMatch)
    return res.render("user/otpverification", {
      error: "Invalid OTP",
      purpose: "signup",
      otpExpiry: record.expiresAt.getTime()   // ✅ FIXED
    });

  if (record.expiresAt < Date.now())
    return res.render("user/otpverification", {
      error: "OTP Expired",
      purpose: "signup",
      otpExpiry: record.expiresAt.getTime()   // ✅ FIXED
    });

  await usermodel.create(tempUser);
  await otpmodel.deleteMany({ email: tempUser.email });
  req.session.destroy();

  return res.redirect("/login");
}
  } catch (err) {
    console.log(err);
    res.redirect("/signup");
  }
};

// const sendotp = async (req, res) => {
//   try {
//     const email = req.body.email || req.session.email;
//     if (!email) return res.status(400).send("Email required");

//     const otp = generateOTP();
//     const hashedOtp = await bcrypt.hash(otp.toString(), 10);
//     const expiryTime = Date.now() + 2 * 60 * 1000; // 2 minutes

//     // Delete old OTPs for this email
//     await otpmodel.deleteMany({ email });

//     // Save new OTP
//     await otpmodel.create({ email, otp: hashedOtp, expiresAt: expiryTime });

//     // Send OTP email
//     await transporter.sendMail({
//       to: email,
//       subject: "OTP Verification",
//       html: `<h1>${otp}</h1>`,
//     });

//     console.log("Sent OTP:", otp);

//     // Store email in session for verification
//     req.session.email = email;

//     // Pass expiry to frontend
//     res.render("otpPage", { otpExpiry: expiryTime });
//   } catch (err) {
//     console.error("Send OTP Error:", err);
//     res.status(500).send("Server Error");
//   }
// };

// // Resend OTP
// const resendOtp = async (req, res) => {
//   try {
//     const email = req.session.email;
//     if (!email) return res.json({ success: false });

//     const otp = generateOTP();
//     const hashedOtp = await bcrypt.hash(otp.toString(), 10);
//     const expiryTime = Date.now() + 2 * 60 * 1000;

//     // Delete old OTPs
//     await otpmodel.deleteMany({ email });

//     // Save new OTP
//     await otpmodel.create({ email, otp: hashedOtp, expiresAt: expiryTime });

//     // Send email
//     await transporter.sendMail({
//       to: email,
//       subject: "Resend OTP",
//       html: `<h1>${otp}</h1>`,
//     });

//     console.log("Resent OTP:", otp);

//     // Return expiry to frontend for timer
//     res.json({ success: true, otpExpiry: expiryTime });
//   } catch (err) {
//     console.error("Resend OTP Error:", err);
//     res.json({ success: false });
//   }
// };

// // Verify OTP
// const veriify= async (req, res) => {
//   try {
//     const { otp: enteredOtp } = req.body;
//     const email = req.session.email;

//     if (!email || !enteredOtp)
//       return res.render("otpPage", { error: "Enter OTP" });

//     const otpDoc = await otpmodel.findOne({ email }).sort({ createdAt: -1 });
//     if (!otpDoc) return res.render("otpPage", { error: "OTP expired" });

//     // Check expiry
//     if (Date.now() > otpDoc.expiresAt)
//       return res.render("otpPage", { error: "OTP expired", otpExpiry: otpDoc.expiresAt });

//     // Verify OTP
//     const isValid = await bcrypt.compare(enteredOtp, otpDoc.otp);
//     if (!isValid)
//       return res.render("otpPage", { error: "Wrong OTP", otpExpiry: otpDoc.expiresAt });

//     // OTP is correct, delete it and redirect
//     await otpmodel.deleteMany({ email });
//     res.redirect("/home");
//   } catch (err) {
//     console.error("Verify OTP Error:", err);
//     res.render("otpPage", { error: "Server error. Try again." });
//   }
// };



const logout= function(req, res){
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

// =======================
// Export Controller
// =======================
module.exports = {
  loadresetpassword,
  forgotpassword,
  loadladingpage,
  loadforgotpassword,
  loadhome,
  loadsignup,
  loadverify,
  loadlogin,
  registeruser,
  veriify,
  loginuser,
  resetPassword,
  loadsuccess,
  loadprofile,
  loadeditprofile,
  updateprofile,
  deleteProfile,
  loadchangepassword,
  changepassword,
  loadaddress,
  loadaddaddress,
  addaddress,
  loadEditAddress,
  updateAddress,
  deleteAddress,
  resendOtp,
  logout
};