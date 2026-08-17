const usermodel = require("../model/usermodel");
const otpmodel = require("../model/otpcontroller");
const generateOTP = require("../utils/otpmanagment");
const bcrypt = require("bcrypt");
const saltround = 10;
const transporter = require("../utils/emailer");
const passport = require("passport");
  const { generateReferralCode } = require("../utils/referralHelper");
  const { creditWallet } = require("../utils/walletHelper");

// =======================
// Load Views
// =======================
const loadladingpage = (req, res) => {
  res.render("user/landingpage");
};

const loadsignup = (req, res) => {
  res.render("user/signup", { referralCode: req.session.referralCode || "" });
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
// Authentication
const registeruser = async (req, res) => {
  try {
    const { fullname, email, password, confirmpassword, referralCode } = req.body;

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

    // Save/refresh the referral code they typed (or that was pre-filled from a /r/:code link)
    if (referralCode && referralCode.trim()) {
      req.session.referralCode = referralCode.trim();
    }

    const hashedpassword = await bcrypt.hash(password, saltround);

    req.session.tempUser = { fullname, email, password: hashedpassword };

    const otpExpiry = await sendotp(email);

    return res.render("user/otpverification", {
    otpExpiry,
    purpose: "signup",
    success: "OTP has been sent to your email. Please check your inbox and enter the OTP before it expires.",
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

    if (!isMatch) return res.render("user/changepassword", { error: "Current password is incorrect" });
    if (newPassword !== confirmPassword) return res.render("user/changepassword", { error: "Passwords do not match" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    console.log(" Password Updated");
    res.redirect("/profile");
  } catch (error) {
    console.log("ERROR:", error);
    res.status(500).send("Server Error");
  }
};

const forgotpassword = async (req, res) => {
  try {
    const { email } = req.body;
    req.session.resetEmail = email;

    const users = await usermodel.findOne({ email });
    if (!users) return res.render("user/forgotpasword", { error: "Email not registered" });

    const otpExpiry = await sendotp(email);

    res.render("user/otpverification", { purpose: "forgotpassword", otpExpiry });
  } catch (error) {
    console.log(error);
    return res.render("user/forgotpasword", { error: "Something went wrong" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmpassword } = req.body;
    const email = req.session.resetEmail;

    if (!email) return res.redirect("/forgotpassword");
    if (!password || !confirmpassword) return res.render("user/resetpassword", { error: "All fields are required" });
    if (password !== confirmpassword) return res.render("user/resetpassword", { error: "Passwords do not match" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usermodel.updateOne({ email }, { $set: { password: hashedPassword } });

    await otpmodel.deleteMany({ email });
    req.session.resetEmail = null;

    res.render("user/successpassword", { success: "Password reset successful" });
  } catch (error) {
    console.log(error);
    res.render("user/resetpassword", { error: "Something went wrong" });
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
    console.log("Resend email:", email);

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

    //  MUST SEND JSON
    return res.json({
      success: true,
      otpExpiry: expiryTime
    });

  } catch (error) {
    console.log(error);
    return res.json({ success: false });
  }
};

// Shared helper — also used by the profile controller for change-email OTPs
const sendotp = async (email) => {
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);
  const expiryTime = Date.now() + 2 * 60 * 1000;

  await otpmodel.deleteMany({ email });
  await otpmodel.create({ email, otp: hashedOtp, expiresAt: expiryTime });

  await transporter.sendMail({ to: email, subject: "OTP Verification", html: `<h1>${otp}</h1>` });
  console.log(otp);
  return expiryTime;
};




const veriify = async (req, res) => {
  const { otp, purpose } = req.body;

  try {

    // ========================
    // 🔹 SIGNUP OTP VERIFY
    // ========================
    if (purpose === "signup") {

      const tempUser = req.session.tempUser;
      if (!tempUser) return res.redirect("/signup");

      const record = await otpmodel.findOne({ email: tempUser.email });
      if (!record) return res.redirect("/signup");

      const isMatch = await bcrypt.compare(otp, record.otp);

      if (!isMatch) {
        return res.render("user/otpverification", {
          error: "Invalid OTP",
          purpose: "signup",
          otpExpiry: record.expiresAt.getTime()
        });
      }

      if (record.expiresAt < Date.now()) {
        return res.render("user/otpverification", {
          error: "OTP Expired",
          purpose: "signup",
          otpExpiry: record.expiresAt.getTime()
        });
      }

      // Generate this user's own referral code before creating them
      const newReferralCode = await generateReferralCode(tempUser.fullname);

      // Check if they signed up via someone else's referral link
      const incomingCode = req.session.referralCode;
      let referrer = null;

      if (incomingCode) {
        referrer = await usermodel.findOne({ referralCode: incomingCode });
      }

      const newUser = await usermodel.create({
        ...tempUser,
        referralCode: newReferralCode,
        referredBy: referrer ? referrer._id : null
      });

      // Give the welcome credit only if they came via a valid referral
      if (referrer) {
        await creditWallet(
          newUser._id,
          5,
          "Welcome credit for signing up via referral"
        );
      }

      await otpmodel.deleteMany({ email: tempUser.email });

      delete req.session.tempUser;
      delete req.session.referralCode;

      return res.redirect("/login");
    }

    // ========================
    // 🔹 FORGOT PASSWORD OTP VERIFY
    // ========================
    else if (purpose === "forgotpassword") {

      const email = req.session.resetEmail;
      console.log(email);
      if (!email) return res.redirect("/forgotpassword");

      const record = await otpmodel.findOne({ email });
      if (!record) return res.redirect("/forgotpassword");

      const isMatch = await bcrypt.compare(otp, record.otp);

      if (!isMatch) {
        return res.render("user/otpverification", {
          error: "Invalid OTP",
          purpose: "forgotpassword",
          otpExpiry: record.expiresAt.getTime()
        });
      }

      if (record.expiresAt < Date.now()) {
        return res.render("user/otpverification", {
          error: "OTP Expired",
          purpose: "forgotpassword",
          otpExpiry: record.expiresAt.getTime()
        });
      }

      return res.redirect("/resetpassword");
    }

    // ========================
    // 🔹 CHANGE EMAIL OTP VERIFY
    // ========================
    if (purpose === "changeemail") {

      const newEmail = req.session.newEmail;
      const userId = req.session.userId;

      if (!newEmail) {
        return res.render("user/changeemail", {
          error: "Session expired. Try again."
        });
      }

      const record = await otpmodel.findOne({ email: newEmail });
      if (!record) {
        return res.render("user/otpverification", {
          purpose,
          error: "OTP not found"
        });
      }

      const isMatch = await bcrypt.compare(otp, record.otp);
      if (!isMatch) {
        return res.render("user/otpverification", {
          purpose,
          error: "Invalid OTP"
        });
      }

      if (record.expiresAt < Date.now()) {
        return res.render("user/otpverification", {
          purpose,
          error: "OTP expired"
        });
      }

      await usermodel.findByIdAndUpdate(
        userId,
        { $set: { email: newEmail } },
        { new: true }
      );

      await otpmodel.deleteMany({ email: newEmail });
      delete req.session.newEmail;

      return res.redirect("/editprofile");
    }

    // ========================
    // 🔹 INVALID PURPOSE
    // ========================
    else {
      return res.redirect("/login");
    }

  } catch (err) {
    console.log(err);
    res.redirect("/signup");
  }
};



// Start Google Auth
const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

// Google Callback
const googleCallback = [
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  (req, res) => {
    try {
      req.session.userId = req.user._id;
      return res.redirect("/home");
    } catch (error) {
      console.log("Google Auth Error:", error);
      return res.redirect("/login");
    }
  }
];

const logout = function (req, res) {
  req.session.destroy(() => {
    res.redirect("/login");
  });
};

module.exports = {
  loadladingpage,
  loadsignup,
  loadlogin,
  loadhome,
  loadforgotpassword,
  loadresetpassword,
  loadsuccess,
  loadchangepassword,
  loadverify,
  registeruser,
  loginuser,
  changepassword,
  forgotpassword,
  resetPassword,
  resendOtp,
  sendotp,
  veriify,
  googleAuth,
  googleCallback,
  logout,
};