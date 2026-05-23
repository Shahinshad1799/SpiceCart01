const usermodel = require("../model/usermodel");
const otpmodel = require("../model/otpcontroller");
const addressmodel = require("../model/addressmodel");
const productmodel=require("../model/productmodel")
const generateOTP = require("../utils/otpmanagment");
const bcrypt = require("bcrypt");
const saltround = 10;
const transporter = require("../utils/emailer");
const { render } = require("ejs");
 const passport = require("passport");
 const { editProfileSchema } = require("../validators/uservalidator");
 const Product = require("../model/productmodel");
 const catagory=require("../model/catagorymodel");
const catagorymodel = require("../model/catagorymodel");
const Wishlist = require('../model/wishlistmodel');
const Cart=require("../model/cartmodel")
const Order=require("../model/ordermodel")
   const mongoose = require("mongoose")
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
const loadchangeemail=(req,res)=>{
  res.render("user/changeemail")
}




const loadcheckout = async (req, res) => {
  try {
    const userId = req.session.userId;

    // Check if user is blocked
    const user = await usermodel.findById(userId);
    if (!user || user.isBlocked) {
      req.session.destroy();
      return res.redirect('/login');
    }

    const cart = await Cart.findOne({ user: userId })
      .populate("items.productId");

    const addresses = await addressmodel.find({ userId: userId });

    if (!cart || cart.items.length === 0) {
      return res.render("user/checkout", {
        cartItems: [],
        addresses: addresses || [],
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0
      });
    }

    // Filter out blocked products from cart
    const activeItems = cart.items.filter(
      item => item.productId && !item.productId.isBlocked  // ✅ skip blocked products
    );

    // If any items were blocked, update the cart in DB to remove them
    if (activeItems.length !== cart.items.length) {
      const blockedIds = cart.items
        .filter(item => !item.productId || item.productId.isBlocked)
        .map(item => item._id);

      await Cart.findOneAndUpdate(
        { user: userId },
        { $pull: { items: { _id: { $in: blockedIds } } } }
      );
    }

    if (activeItems.length === 0) {
      return res.render("user/checkout", {
        cartItems: [],
        addresses: addresses || [],
        subtotal: 0,
        shipping: 0,
        tax: 0,
        total: 0
      });
    }

    let subtotal = 0;
    activeItems.forEach(item => {
      const variant = item.productId.variants.id(item.variantId);
      if (variant) {
        subtotal += variant.price * item.quantity;
      }
    });

    const shipping = 50;
    const tax = subtotal * 0.05;
    const total = subtotal + shipping + tax;

    res.render("user/checkout", {
      cartItems: activeItems,  // ✅ only non-blocked items
      addresses: addresses || [],
      subtotal,
      shipping,
      tax,
      total
    });

  } catch (err) {
    console.log(err);
    res.redirect("/cart");
  }
};


// ── ADD ADDRESS ──────────────────────────────────────────────
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


// ── EDIT ADDRESS ─────────────────────────────────────────────
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


const toggleWishlist = async (req, res) => {
  try {
    const { productId, variantId } = req.body;  // ✅ moved to top, available everywhere
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    // Cart check
    const cart = await Cart.findOne({ user: userId });
    const inCart = cart?.items?.some(item =>
      item.product && item.product.toString() === productId
    );
    if (inCart) {
      return res.status(400).json({ success: false, message: 'This item is already in your cart' });
    }

    // Check if already in wishlist
    const wishlist = await Wishlist.findOne({ user: userId });
    const alreadyExists = wishlist?.products.some(
      item => item.product && item.product.toString() === productId
    );

    if (alreadyExists) {
      await Wishlist.findOneAndUpdate(
        { user: userId },
        { $pull: { products: { product: productId } } }
      );
      return res.status(200).json({ success: true, wishlisted: false });

    } else {
      const product = await Product.findById(productId);
      const variant = product.variants.id(variantId);  // ✅ fixed typo: varient → variant

      if (!variant) {  // ✅ fixed typo: varient → variant
        return res.status(404).json({ success: false, message: 'Product variant not found' });
      }

      await Wishlist.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            products: {
              product: productId,
              variant: {
                variantId: variant._id,    // ✅ was: first._id
                name: variant.name,        // ✅ was: first.name
                price: Number(variant.price),  // ✅ was: first.price
                stock: Number(variant.stock)   // ✅ was: first.stock
              }
            }
          }
        },
        { upsert: true, new: true }
      );
      return res.status(200).json({ success: true, wishlisted: true });
    }

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
};
const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await usermodel.findById(userId);
    if (!user || user.isBlocked) {
      req.session.destroy();
      return res.redirect('/login');
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('products.product');

    const allItems = wishlist?.products || [];

    // Separate blocked/deleted from active
    const blockedItems = allItems.filter(
      item => !item.product || item.product.status === 'Blocked'  // ✅ matches your schema
    );
    const wishlistItems = allItems.filter(
      item => item.product && item.product.status === 'Active'    // ✅ matches your schema
    );

    // Auto-remove blocked/deleted products from wishlist in DB
    if (blockedItems.length > 0) {
      const blockedProductIds = blockedItems.map(item => item.product?._id || item.product);
      await Wishlist.findOneAndUpdate(
        { user: userId },
        { $pull: { products: { product: { $in: blockedProductIds } } } }  // ✅ pull by product field
      );
    }

    res.render('user/wishlist', { wishlistItems });

  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
};



const loadshop = async (req, res) => {
  try {
    const { category, maxPrice, error, sort } = req.query;
    const search = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    let filter = { status: "Active" };
    let sortOption = {};
    let selectedCategoryName = "All Categories";

    const activeCategories = await catagorymodel
      .find({ status: "Active" })
      .select("_id name");

    const activeCategoryIds = activeCategories.map(c => c._id);

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (category && category !== "All") {
      const cat = activeCategories.find(c => c._id.toString() === category);
      if (cat) {
        filter.catagory = cat._id;
        selectedCategoryName = cat.name;
      } else {
        filter.catagory = null;
      }
    } else {
      filter.catagory = { $in: activeCategoryIds };
    }

    if (maxPrice) {
      filter.variants = {
        $elemMatch: { price: { $lte: Number(maxPrice) } }
      };
    }

    switch (sort) {
      case "price-high": sortOption = { "variants.0.price": -1 }; break;
      case "price-low":  sortOption = { "variants.0.price": 1 };  break;
      case "name-az":    sortOption = { name: 1 };                 break;
      case "name-za":    sortOption = { name: -1 };                break;
      default:           sortOption = { createdAt: -1 };
    }

    const totalProducts = await productmodel.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await productmodel
      .find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    // Fixed wishlist extraction
    let wishlist = [];
    if (req.session?.userId) {
      const wishlistDoc = await Wishlist.findOne({ user: req.session.userId });
      wishlist = wishlistDoc?.products
        ?.map(p => p.product?.toString())
        .filter(Boolean) || [];
    }

    res.render("user/shop", {
      products,
      catagory: activeCategories,
      selectedCategory: category || "All",
      selectedCategoryName,
      wishlist,
      selectedPrice: maxPrice || 1000,
      error,
      search,
      sort,
      currentPage: page,
      totalPages,
    });

  } catch (err) {
    console.log(err);
  }
};

const loaddetails = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await productmodel.findById(productId);

    if (!product || product.status === "Blocked") {
      return res.redirect("/shop?error=Product is blocked");
    }

    let selectedVariant = null;
    if (req.query.variantId) {
      selectedVariant = product.variants.id(req.query.variantId);
    }
    if (!selectedVariant) {
      selectedVariant = product.variants[0];
    }

    const relatedProducts = await Product.find({
      catagory: product.catagory,
      _id: { $ne: productId },
      status: "Active"
    }).limit(4);

    //  fetch wishlist and pass as boolean
    let isWishlisted = false;
    if (req.session?.userId) {
      const wishlistDoc = await Wishlist.findOne({ user: req.session.userId });
      isWishlisted = wishlistDoc
        ? wishlistDoc.products.some(p => p.product.toString() === productId)
        : false;
    }

    res.render("user/productdetails", {
      product,
      relatedProducts,
      selectedVariant,
      wishlist: isWishlisted  //  now passed correctly
    });

  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
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
    res.render("user/editprofile", { user ,error:{}});
  } catch (error) {
    console.log(error);
    res.redirect("/profile");
  }
};


const updateprofile = async (req, res) => {
  try {
    const userId = req.session.userId;
   console.log("is patch working")
    // Validate using Zod
    const result = editProfileSchema.safeParse(req.body);

    if (!result.success) {
      const errorMessage = result.error.issues[0].message;

      return res.render("user/editprofile", {
        user: req.body,
        error: errorMessage,
      });
    }

    const { fullname, phonenumber, dateofbirth } = result.data;

    let updateData = { fullname, phonenumber, dateofbirth };

    if (req.file) {
      updateData.profileImage = req.file.filename;
    }

    await usermodel.updateOne(
      { _id: userId },
      { $set: updateData }
    );

    res.redirect("/profile");

  } catch (error) {
  console.log("FULL ERROR:", error);
  res.render("user/editprofile", {
    error: error.message || "Something went wrong",
  });
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

    //  Send OTP and get expiry directly
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

    const otpExpiry =  await sendotp(email);

    res.render("user/otpverification", { purpose: "forgotpassword" ,otpExpiry});
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
// Address Management
// =======================
const loadaddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.redirect("/login");

    const user = await usermodel.findById(userId).select("fullname profileImage email");
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
// Email change
// =======================
 const changeemail = async (req, res) => {
  try {
    const { email } = req.body;
    req.session.newEmail = email;

    const users = await usermodel.findOne({ email });
    if (users) return res.render("user/forgotpasword", { error: "Email already registered" });

    const otpExpiry =  await sendotp(email);

    res.render("user/otpverification", { purpose: "changeemail" ,otpExpiry});
  } catch (error) {
    console.log(error);
    return res.render("user/forgotpasword", { error: "Something went wrong" });
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

      await usermodel.create(tempUser);
      await otpmodel.deleteMany({ email: tempUser.email });

      return res.redirect("/login");
    }

    // ========================
    // 🔹 FORGOT PASSWORD OTP VERIFY
    // ========================
    else if (purpose === "forgotpassword") {

      const email = req.session.resetEmail;
      console.log(email)
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

      // OTP correct → allow password reset
      return res.redirect("/resetpassword");
    }
    // ========================
// 🔹 CHANGE EMAIL OTP VERIFY
// ========================
if (purpose === "changeemail") {

  const newEmail = req.session.newEmail;   // FIXED
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

  // Update database properly
  await usermodel.findByIdAndUpdate(
    userId,
    { $set: { email: newEmail } },
    { new: true }
  );

  // Cleanup
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
const placeorder = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.userId)
        const { addressId } = req.body

        console.log("userId    :", userId)
        console.log("addressId :", addressId)

        // ── 1. Validate ───────────────────────────────────────────────────────
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" })
        }

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Please select a delivery address" })
        }

        // ── 2. Fetch address ──────────────────────────────────────────────────
        const address = await addressmodel.findOne({ _id: addressId, userId })
        console.log("address   :", address)

        if (!address) {
            return res.status(404).json({ success: false, message: "Address not found" })
        }

        // ── 3. Fetch cart (one doc with items array) ──────────────────────────
        const cart = await Cart.findOne({ user: userId }).populate("items.productId")
        console.log("cart      :", cart)

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Your cart is empty" })
        }

        // ── 4. Build order items ──────────────────────────────────────────────
        const items = []

        for (const cartItem of cart.items) {
            const product = cartItem.productId

            if (!product) {
                return res.status(400).json({ success: false, message: "A product in your cart was not found" })
            }

            const variant = product.variants.find(
                v => v._id.toString() === cartItem.variantId?.toString()
            )

            if (!variant) {
                return res.status(400).json({ success: false, message: `Variant not found for "${product.name}"` })
            }

            items.push({
                productId:    product._id,
                variantId:    variant._id,
                productName:  product.name,
                productImage: product.images?.[0] || "",
                unitPrice:    variant.price,
                quantity:     cartItem.quantity,
                lineTotal:    variant.price * cartItem.quantity
            })
        }

        // ── 5. Calculate totals ───────────────────────────────────────────────
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
        const shipping = subtotal > 500 ? 0 : 50
        const tax      = parseFloat((subtotal * 0.05).toFixed(2))
        const total    = parseFloat((subtotal + shipping + tax).toFixed(2))

        console.log("subtotal  :", subtotal, "total :", total)

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
            total
        })

       // ── 7. Deduct stock ───────────────────────────────────────────────────
for (const item of items) {
  await Product.findOneAndUpdate(
    { 
      _id: item.productId, 
      'variants._id': item.variantId 
    },
    { 
      $inc: { 'variants.$.stock': -item.quantity }  // ✅ deduct quantity from variant stock
    }
  );
}
        // ── 7. Save orderId to session ────────────────────────────────────────
        req.session.lastOrderId = order._id  // ✅ was `newOrder._id` (undefined)

        // ── 8. Clear cart ─────────────────────────────────────────────────────
        await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { items: [] } }
        )

        // ── 9. Return JSON so frontend can redirect ───────────────────────────
        return res.status(201).json({ success: true, orderId: order._id })

    } catch (err) {
        console.error("Place order error:", err.message)
        console.error(err.stack)
        return res.status(500).json({ success: false, message: err.message || "Something went wrong" })
    }
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const limit  = 5
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
      search
    })

  } catch (err) {
    console.error("Load orders error:", err)
    res.redirect("/")
  }
}
const loadorderdetails=async(req,res)=>{
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
    const { id }     = req.params;
    const { reason } = req.body;
    const userId     = req.session.userId;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorised." });
    }

    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because it is already ${order.status}.`,
      });
    }

    // ✅ Restore stock for each item
    for (const item of order.items) {
      await Product.findOneAndUpdate(
        { 
          _id: item.productId, 
          'variants._id': item.variantId 
        },
        { 
          $inc: { 'variants.$.stock': item.quantity }  // ✅ add back the quantity
        }
      );
    }

    order.status       = "cancelled";
    order.cancelReason = reason || "No reason provided";
    order.cancelledAt  = new Date();

    await order.save();

    return res.status(200).json({ success: true, message: "Order cancelled successfully." });

  } catch (err) {
    console.error("cancelOrder error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
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
  googleAuth,
  googleCallback,
  loadchangeemail,
  changeemail,
  loadshop,
  loaddetails,
  toggleWishlist,
 loadWishlist,
 loadcheckout,
 addAddress,
  editAddress,
  loadordersuccess,
  placeorder,
  loadorder,
  loadorderdetails,
  cancelOrder,
  returnorder,
  logout
};

