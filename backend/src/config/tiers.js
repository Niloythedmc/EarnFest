export const TIERS = {
  free: { name: 'Free Fest', ads: 10, minWithdraw: 10000, minDeposit: 10000, price: 0 },
  cash: { name: 'Cash Fest', ads: 12, minWithdraw: 8000, minDeposit: 8000, price: 0.5 },
  reward: { name: 'Reward Fest', ads: 14, minWithdraw: 6000, minDeposit: 6000, price: 1 },
  bonus: { name: 'Bonus Fest', ads: 16, minWithdraw: 4000, minDeposit: 4000, price: 2 },
  profit: { name: 'Profit Fest', ads: 20, minWithdraw: 2000, minDeposit: 2000, price: 5 }
};

export const REWARD_TYPES = {
  AD: 'ad',
  TASK: 'task',
  GAME: 'game',
  SURVEY: 'survey'
};
