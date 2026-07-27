const crypto = require('crypto');
const usermodel = require('../model/usermodel');
const ordermodel = require('../model/ordermodel');
const { creditWallet } = require('./walletHelper');

const generateReferralCode = async (fullname) => {
  const base = (fullname || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'user';

  let code, exists = true;

  while (exists) {
    const suffix = crypto.randomBytes(2).toString('hex');
    code = `${base}${suffix}`;
    exists = await usermodel.exists({ referralCode: code });
  }

  return code;
};

// call this right after order.paymentStatus is set to 'paid' and saved
const processReferralReward = async (userId, orderId) => {
  try {
    const user = await usermodel.findById(userId);

    if (!user || !user.referredBy || user.referralRewardGiven) return;

    const paidOrderCount = await ordermodel.countDocuments({
      userId,
      paymentStatus: 'paid'
    });

    if (paidOrderCount !== 1) return; // not their first paid order

    await creditWallet(
      user.referredBy,
      5,
      'Referral reward — your friend made their first purchase',
      orderId
    );

    user.referralRewardGiven = true;
    await user.save();

  } catch (err) {
    console.error('processReferralReward error:', err);
  }
};

module.exports = { generateReferralCode, processReferralReward };