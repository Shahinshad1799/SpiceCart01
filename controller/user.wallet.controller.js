const usermodel = require("../model/usermodel");
const Order = require("../model/ordermodel");
const { getOrCreateWallet } = require('../utils/walletHelper');

const loadWallet = async (req, res) => {
  try {
    const userId = req.session.userId;

    const user   = await usermodel.findById(userId);
    if (!user) return res.redirect('/login');

    const totalOrders = await Order.countDocuments({ userId });

    // ✅ Fetch from separate Wallet model
    const wallet = await getOrCreateWallet(userId);

    const page  = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip  = (page - 1) * limit;

    const allTransactions = [...wallet.transactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const transactions = allTransactions.slice(skip, skip + limit);
    const totalPages   = Math.ceil(allTransactions.length / limit);

    res.render('user/wallet', {
      user: {
        name:         user.fullname,
        email:        user.email,
        profileImage: user.profileImage || null,
        createdAt:    user.createdAt,
      },
      walletBalance: wallet.balance,
      transactions,
      totalOrders,
      currentPage: page,
      totalPages,
    });

  } catch (err) {
    console.error('loadWallet error:', err);
    res.redirect('/');
  }
};

module.exports = {
  loadWallet,
};