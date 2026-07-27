const usermodel = require("../model/usermodel");
const Product = require("../model/productmodel");
const Wishlist = require('../model/wishlistmodel');
const Cart = require("../model/cartmodel");

const toggleWishlist = async (req, res) => {
  try {
    const { productId, variantId } = req.body;
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
      const updated = await Wishlist.findOneAndUpdate(
        { user: userId },
        { $pull: { products: { product: productId } } },
        { new: true }               // ← need the updated doc back to count
      );
      return res.status(200).json({
        success: true,
        wishlisted: false,
        wishCount: updated?.products.length || 0   // ← added
      });

    } else {
      const product = await Product.findById(productId);
      const variant = product.variants.id(variantId);

      if (!variant) {
        return res.status(404).json({ success: false, message: 'Product variant not found' });
      }

      const updated = await Wishlist.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            products: {
              product: productId,
              variant: {
                variantId: variant._id,
                name: variant.name,
                price: Number(variant.price),
                stock: Number(variant.stock)
              }
            }
          }
        },
        { upsert: true, new: true }
      );
      return res.status(200).json({
        success: true,
        wishlisted: true,
        wishCount: updated.products.length   // ← added
      });
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
      item => !item.product || item.product.status === 'Blocked'
    );
    const wishlistItems = allItems.filter(
      item => item.product && item.product.status === 'Active'
    );

    // Auto-remove blocked/deleted products from wishlist in DB
    if (blockedItems.length > 0) {
      const blockedProductIds = blockedItems.map(item => item.product?._id || item.product);
      await Wishlist.findOneAndUpdate(
        { user: userId },
        { $pull: { products: { product: { $in: blockedProductIds } } } }
      );
    }

    res.render('user/wishlist', { wishlistItems });

  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
};

module.exports = {
  toggleWishlist,
  loadWishlist,
};