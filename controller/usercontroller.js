const usermodel=require("../model/usermodel")
const otpmodel=require("../model/otpcontroller")
const addressmodel=require("../model/addressmodel")
const generateOTP =require("../utils/otpmanagment")
const bcrypt=require("bcrypt")
const saltround=10
const transporter=require("../utils/emailer")
const { render } = require("ejs")

const loadladingpage=function(req,res){
  res.render("user/landingpage")
}
const loadsignup=function(req,res){
    res.render("user/signup")
}
const loadlogin=function(req,res){
  res.render("user/login")
}
const loadhome=function(req,res){
  res.render("user/home")
}
const loadforgotpassword=function(req,res){
  res.render("user/forgotpasword")
}
const loadresetpassword=function(req,res){
  res.render("user/resetpassword")
}
const loadsuccess=function(req,res){
  res.render("user/successpassword")
}
const loadchangepassword=function(req,res){
  res.render("user/changepassword")
}
const loadaddaddress=function(req,res){
  res.render("user/addaddress")
}
const resendOtp = async (req, res) => {
  try {
    const email = req.session.email;

    if (!email) {
      return res.json({ success: false });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000);

    await otpmodel.findOneAndUpdate(
      { email },
      { otp: newOtp, expiresAt: Date.now() + 2 * 60 * 1000 },
      { upsert: true }
    );

    // send email logic here

    res.json({ success: true });

  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
};



const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.userId;

    // Check if address belongs to logged-in user
    const address = await addressmodel.findOne({
      _id: addressId,
      userId: userId
    });

    if (!address) {
      return res.status(404).send("Address not found");
    }

    await addressmodel.findByIdAndDelete(addressId);

    res.redirect("/address"); // redirect to address listing page
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  deleteAddress
};
const updateAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.userId;

    const {
      fullname,
      phonenumber,
      address,
      apartment,
      city,
      state,
      zipcode,
      isdefault
    } = req.body;

    // convert checkbox value
    const isDefaultValue = isdefault === "on";

    // If setting as default → reset others
    if (isDefaultValue) {
      await addressmodel.updateMany(
        { userId: userId },
        { $set: { isdefault: false } }
      );
    }

    const updatedAddress = await addressmodel.findOneAndUpdate(
      { _id: addressId, userId: userId }, // security
      {
        fullname,
        phonenumber,
        address,
        apartment,
        city,
        state,
        zipcode,
        isdefault: isDefaultValue
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(404).send("Address not found");
    }

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
    console.log(addressId)
    // Security check (important)
    const address = await addressmodel.findOne({
      _id: addressId,
      userId: userId
    });
    console.log(address)

    if (!address) {
      return res.status(404).send("Address not found");
    }

    res.render("user/editaddress", { address });

  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};
const loadaddress = async (req, res) => {
  try {
    const userId = req.session.userId;

    const addresses = await addressmodel.find({ userId: userId });
    

    res.render("user/address", { addresses});

  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};
const addaddress = async (req, res) => {
  try {
 const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

    const {
      fullname,
      phonenumber,
      address,
      appartment,
      city,
      state,
      zipcode,
      isdefault
    } = req.body;

    // Convert checkbox value to boolean
    const setAsDefault = req.body.isdefault === "on";


    // If user selected default → unset other defaults
    if (setAsDefault) {
      await addressmodel.updateMany(
        { userId: userId },
        { $set: { isdefault: false } }
      );
    }

    await addressmodel.create({
      userId,
      fullname,
      phonenumber,
      address,
      appartment,
       city,
      state,
      zipcode,
      isdefault: setAsDefault
    });

    res.redirect("/address");

  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};
const changepassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const userId = req.session.userId; // or req.session.userId
    const user = await usermodel.findById(userId);

    if (!user) {
      return res.redirect("/login");
    }

    // 1️⃣ Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.render("user/changepassword", {
        message: "Current password is incorrect"
      });
    }

    // 2️⃣ Check new & confirm match
    if (newPassword !== confirmPassword) {
      return res.render("user/changepassword", {
        message: "Passwords do not match"
      });
    }

    // 3️⃣ Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4️⃣ Update
    user.password = hashedPassword;
    await user.save();

    res.redirect("/profile");

  } catch (error) {
    console.log(error.message);
  }
};

const loadeditprofile = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

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
        message: "Full name is required"
      });
    }

    let updateData = {
      fullname,
      phonenumber,
      dateofbirth
    };

    // 🔥 If image uploaded
    if (req.file) {
      updateData.profileImage = req.file.filename;
    }

    await usermodel.updateOne(
      { _id: userId },
      { $set: updateData }
    );
    console.log("BODY:", req.body);
console.log("FILE:", req.file);

    res.redirect("/profile");

  } catch (error) {
    console.log(error);
    res.render("user/editprofile", {
      message: "Something went wrong"
    });
  }
};



const loadprofile = async (req, res) => {
  try {

    const userId = req.user?._id || req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await usermodel.findById(userId);

    res.render("user/profile", { user });

  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};


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
      return res.render("user/signup", {
        error: "User already exists"
      });
    }

    const hashedpassword = await bcrypt.hash(password, saltround);

    req.session.tempUser = {
      fullname,
      email,
      password: hashedpassword
    };

    await sendotp(email);

    return res.render("user/otpverification", {
      purpose: "signup",
      success: "OTP sent to the mail"
    });

  } catch (error) {
    console.log(error);
    return res.render("user/signup", {
      error: "Something went wrong"
    });
  }
};
const loadverify=function(req,res){
  res.render("user/otpverification")
}
const loginuser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.render("user/login", { error: "User does not exist" });
    }

    const isSame = await bcrypt.compare(password, user.password);
    if (!isSame) {
      return res.render("user/login", { error: "Incorrect password" });
    }

    // ✅ SAVE USER ID IN SESSION
    req.session.userId = user._id;

    req.session.save(() => {
      res.redirect("/home");
    });

  } catch (error) {
    console.log(error);
    res.render("user/login");
  }
};





const veriify = async (req, res) => {
  const { otp, purpose } = req.body;

  if (purpose === "signup") {

    const tempUser = req.session.tempUser;

    const record = await otpmodel.findOne({ email: tempUser.email });

    const isMatch = await bcrypt.compare(otp, record.otp);

    if (!isMatch) {
      return res.render("user/otpverification", { message: "Invalid OTP", purpose:"signup" });
    }

    await usermodel.create(tempUser);
    await otpmodel.deleteMany({ email: tempUser.email });
    req.session.destroy();

    return res.redirect("/login");
  }

  if (purpose === "forgot") {

    const email = req.session.email;

    const record = await otpmodel.findOne({ email });

    const isMatch = await bcrypt.compare(otp, record.otp);

    if (!isMatch) {
      return res.render("user/otpverification", { message: "Invalid OTP", purpose:"forgot" });
    }
      req.session.resetEmail = email;

    return res.render("user/resetpassword");
  }
};


const forgotpassword = async (req, res) => {
  try {
    const { email } = req.body;
    req.session.email = email;

    const users = await usermodel.findOne({ email });

    if (!users) {
      return res.render("user/forgotpasword", {
        message: "Email not registered"
      });
    }

    await sendotp(email);

  res.render("user/otpverification", {
  purpose: "forgot"
});

  } catch (error) {
    console.log(error);
    return res.render("user/forgotpasword", {
      message: "Something went wrong"
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    // 1. Get form data
    const { password, confirmpassword } = req.body;
    console.log(password,confirmpassword)
    // 2. Check OTP verification (session)
    const email = req.session.resetEmail;
    console.log(email)
    if (!email) {
      return res.redirect("/forgotpassword");
    }
   console.log("goood")
    // 3. Validate inputs
    if (!password || !confirmpassword) {
      return res.render("user/resetpassword", {
        message: "All fields are required"
      });
    }

    if (password !== confirmpassword) {
      return res.render("user/resetpassword", {
        message: "Passwords do not match"
      });
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
console.log("hai")
    // 5. Update password
    await usermodel.updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    // 6. Cleanup
    await otpmodel.deleteMany({ email });
    req.session.resetEmail = null;
    console.log("hello")
    // 7. Done
    res.render("user/successpassword", {
      message: "Password reset successful"
    });

  } catch (error) {
    console.log(error);
    res.render("user/resetpassword", {
      message: "Something went wrong"
    });
  }
};


const sendotp = async (email) => {
  const otp = generateOTP();
  const hashedOtp = await bcrypt.hash(otp.toString(), 10);

  await otpmodel.deleteMany({ email });

  await otpmodel.create({
    email,
    otp: hashedOtp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  await transporter.sendMail({
    to: email,
    subject: "OTP Verification",
    html: `<h1>${otp}</h1>`
  });
  console.log(otp)
};

module.exports={
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
  loadchangepassword,
  changepassword,
  loadaddress,
  loadaddaddress,
  addaddress,
  loadEditAddress,
  updateAddress,
  deleteAddress,
  resendOtp
}