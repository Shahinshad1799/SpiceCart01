const productmodel = require("../model/productmodel");
const Product = require("../model/productmodel");
const catagorymodel = require("../model/catagorymodel");
const Wishlist = require('../model/wishlistmodel');
const Offer = require("../model/offermodel");

// Find the best active offer for a product and calculate discounted variant prices
async function getProductWithOffer(product) {
    const now = new Date();

    // Fetch both offers separately
    const [productOffer, categoryOffer] = await Promise.all([
        Offer.findOne({
            status: "active",
            startDate: { $lte: now },
            endDate: { $gte: now },
            applicableFor: "product",
            targetId: product._id
        }).lean(),
        Offer.findOne({
            status: "active",
            startDate: { $lte: now },
            endDate: { $gte: now },
            applicableFor: "category",
            targetId: product.catagory
        }).lean()
    ]);
        console.log(`Product: ${product.name} | catagory: ${product.catagory} | productOffer:`, productOffer, '| categoryOffer:', categoryOffer);
    // Pick better offer based on actual savings on first variant
    const basePrice = product.variants?.[0]?.price || 0;

    const getSaving = (offer) =>
        offer.discountType === "percentage"
            ? (basePrice * offer.discountValue / 100)
            : offer.discountValue;

    let bestOffer = null;
    if (productOffer && categoryOffer) {
        bestOffer = getSaving(productOffer) >= getSaving(categoryOffer)
            ? productOffer
            : categoryOffer;
    } else {
        bestOffer = productOffer || categoryOffer || null;
    }

    if (!bestOffer) return { ...product.toObject(), offer: null, discountedVariants: null };

    // Apply best offer to all variants
    const discountedVariants = product.variants.map(variant => {
        let discount;
        if (bestOffer.discountType === "percentage") {
            discount = (variant.price * bestOffer.discountValue) / 100;
            if (bestOffer.maxDiscountCap) discount = Math.min(discount, bestOffer.maxDiscountCap);
        } else {
            discount = bestOffer.discountValue;
        }
        const discountedPrice = Math.max(0, Math.round(variant.price - discount));
        return { ...variant.toObject(), discountedPrice };
    });

    return { ...product.toObject(), offer: bestOffer, discountedVariants };
}

const loadshop = async (req, res) => {
  try {
    const { category, maxPrice, error, sort } = req.query;
    const search = req.query.q || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
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

      const rawProducts = await productmodel
            .find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        // Attach offers to each product
        const products = await Promise.all(
            rawProducts.map(p => getProductWithOffer(p))
        );

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

        const rawProduct = await productmodel.findById(productId);

        if (!rawProduct || rawProduct.status === "Blocked") {
            return res.redirect("/shop?error=Product is blocked");
        }

        // Attach offer
        const product = await getProductWithOffer(rawProduct);

        // selectedVariant — match from discountedVariants if offer exists
        let selectedVariant = null;
        if (req.query.variantId) {
            selectedVariant = product.discountedVariants
                ? product.discountedVariants.find(v => v._id.toString() === req.query.variantId)
                : rawProduct.variants.id(req.query.variantId);
        }
        if (!selectedVariant) {
            selectedVariant = product.discountedVariants
                ? product.discountedVariants[0]
                : rawProduct.variants[0];
        }

        const relatedProducts = await Product.find({
            catagory: rawProduct.catagory,
            _id: { $ne: productId },
            status: "Active"
        }).limit(4);

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
            wishlist: isWishlisted,
        });

    } catch (error) {
        console.log(error);
        res.redirect("/");
    }
};

module.exports = {
  loadshop,
  loaddetails,
  getProductWithOffer,
};