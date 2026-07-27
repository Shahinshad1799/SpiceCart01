const Wallet = require('../model/walletmodel');

// Get wallet or create one if it doesn't exist yet
const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
  }
  return wallet;
};

// Credit (add money) to wallet
const creditWallet = async (userId, amount, description, orderId = null) => {
  const wallet = await getOrCreateWallet(userId);
  wallet.balance = parseFloat((wallet.balance + amount).toFixed(2));
  wallet.transactions.push({
    type: 'credit',
    amount,
    description,
    orderId,
    status: 'success'
  });
  await wallet.save();
  return wallet;
};

// Debit (deduct money) from wallet
const debitWallet = async (userId, amount, description, orderId = null) => {
  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }
  wallet.balance = parseFloat((wallet.balance - amount).toFixed(2));
  wallet.transactions.push({
    type: 'debit',
    amount,
    description,
    orderId,
    status: 'success'
  });
  await wallet.save();
  return wallet;
};

module.exports = { getOrCreateWallet, creditWallet, debitWallet };