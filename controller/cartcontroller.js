// controllers/cartController.js

const Cart = require("../model/cartmodel");
const product=require("../model/productmodel")


const getCartPage = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

    let cart = await Cart.findOne({ user: userId })
      .populate("items.productId");

    const cartItems = cart ? cart.items : [];

    let subtotal = 0;
    let totalItems = 0;

    cartItems.forEach(item => {
      const price = item.productId?.variants?.[0]?.price || 0; 
      const qty = item.quantity || 0;

      subtotal += price * qty;
      totalItems += qty;
    });

    const shipping = subtotal > 0 ? 50 : 0;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;

    res.render("user/cart", {
      cartItems,
      subtotal,
      totalItems,
      shipping,
      tax,
      total
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, variantId, quantity = 1 } = req.body;

    if (!userId) {
      return res.redirect("/login");
    }

    const prod = await product.findById(productId);

    if (!prod) {
      return res.status(404).send("Product not found");
    }

  
    const selectedVariant = prod.variants.id(variantId);

    if (!selectedVariant) {
      return res.status(400).send("Variant not found");
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{
          productId,
          variantId,
          quantity: Number(quantity),
          price: selectedVariant.price  
        }]
      });
    } else {

      const existingItem = cart.items.find(item =>
        item.productId.toString() === productId &&
        item.variantId.toString() === variantId
      );

      if (existingItem) {
        existingItem.quantity += Number(quantity);
      } else {
        cart.items.push({
          productId,
          variantId,
          quantity: Number(quantity),
          price: selectedVariant.price
        });
      }
    }

    await cart.save();

    res.redirect("/cart");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

const updateCart = async (req, res) => {
  try {
    const userId = req.session.userId;
const { productId, variantId, change } = req.body;

const changeValue = parseInt(change);

const cart = await Cart.findOne({ user: userId });

if (!cart) {
  return res.json({ success: false });
}

const item = cart.items.find(
  i =>
    i.productId.toString() === productId &&
    i.variantId.toString() === variantId
);

if (item) {
  item.quantity += changeValue;

  if (item.quantity <= 0) {
    cart.items = cart.items.filter(
      i =>
        !(
          i.productId.toString() === productId &&
          i.variantId.toString() === variantId
        )
    );
  }
}

await cart.save();

res.redirect("/cart");

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};


const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, variantId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false });
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.json({ success: false });
    }

    cart.items = cart.items.filter(
      item =>
        !(
          item.productId.toString() === productId &&
          item.variantId.toString() === variantId
        )
    );

    await cart.save();

  
    res.redirect("/cart");

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};





module.exports={
  getCartPage,
  updateCart,
  removeFromCart,
  addToCart
}