const usermodel = require("../model/usermodel");
const { generateReferralCode } = require("../utils/referralHelper");

const referralLanding = async (req, res) => {
  const code = req.params.code;

  // validate the code actually exists before trusting it
  const referrer = await usermodel.findOne({ referralCode: code });
  if (referrer) {
    req.session.referralCode = code;
  }

  res.redirect("/signup");
};

const loadreferrals = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect("/login");
    }

    let user = await usermodel
      .findById(userId)
      .select("fullname profileImage email referralCode");

    if (!user) {
      req.session.destroy(() => res.redirect("/login"));
      return;
    }

    if (!user.referralCode) {
      user.referralCode = await generateReferralCode(user.fullname);
      await user.save();
    }

    const referredUsers = await usermodel
      .find({ referredBy: userId })
      .select("fullname referralRewardGiven createdAt")
      .sort({ createdAt: -1 });

    const totalEarned = referredUsers.filter(u => u.referralRewardGiven).length * 5;
    const referralLink = `${req.protocol}://${req.get("host")}/r/${user.referralCode}`;

    res.render("user/referrals", {
      currentPage: "referrals",
      user,
      referredUsers,
      totalEarned,
      referralLink
    });

  } catch (error) {
    console.error("Load referrals error:", error);
    res.redirect("/login");
  }
};

module.exports = {
  referralLanding,
  loadreferrals,
};