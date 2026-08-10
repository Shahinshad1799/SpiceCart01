
const express = require("express");
const app = express();
const session = require("express-session");
const userrouter = require("./route/user");
const adminrouter = require("./route/admin");
const connectdb = require("./config/db.js");
const dotenv = require("dotenv").config();
const passport = require("./config/passport");
const methodOverride = require('method-override');
const Cart = require('./model/cartmodel');
const wishlist=require("./model/wishlistmodel");

// 1. BODY PARSING first
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// 2. SINGLE SESSION — remove the duplicate, keep only one
app.use(session({
  secret: "secretkey",
  resave: false,
  saveUninitialized: false,
}));

// 3. PASSPORT after session
app.use(passport.initialize());
app.use(passport.session());

// 4. STATIC FILES
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

// 5. CACHE CONTROL
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});


// 6. CART COUNT MIDDLEWARE — now session is ready
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const cart = await Cart.findOne({ user: req.session.userId });
      res.locals.cartCount = cart
        ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
        : 0;
    } catch (err) {
      res.locals.cartCount = 0;
    }
  } else {
    res.locals.cartCount = 0;
  }
  next();
});
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const Wishlist = await wishlist.findOne({ user: req.session.userId });
      res.locals.wishCount = Wishlist ? Wishlist.products.length : 0; // ✅ products not items
    } catch (err) {
      console.log('Wishlist error:', err);
      res.locals.wishCount = 0;
    }
  } else {
    res.locals.wishCount = 0;
  }
  next();
});

// 7. USER LOCALS
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// 8. VIEWS
app.set("view engine", "ejs");
app.set("views", "./views");

// 9. ROUTES
app.use("/", userrouter);
app.use("/admin", adminrouter);

connectdb();
const PORT = process.env.PORT || 9000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});