/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const [config] = useState({
    apiBase: 'https://eidfest.up.railway.app', // Update for production
    adsgramBlockId: '25093', 
    maintenanceMode: false,
    adminIds: ['5968063026', '6686954447', '1678112785', '123456789'],
    festMaster: 'EQA5tc67TExHH3doV0lMAzWNVgbFEl5bBrl5obz68l6jDfUF',
    walletFather: {
      botBaseUrl: 'https://t.me/WF_web3_Bot',
      projectId: 'BizjTaDL4d2v'
    },
    tiers: {
      free: { name: 'Free Fest', ads: 10, tasks: 2000, minWithdraw: 10000, minDeposit: 10000, price: 0 },
      cash: { name: 'Cash Fest', ads: 12, tasks: 2000, minWithdraw: 8000, minDeposit: 8000, price: 0.5 },
      reward: { name: 'Reward Fest', ads: 14, tasks: 2000, minWithdraw: 6000, minDeposit: 6000, price: 1 },
      bonus: { name: 'Bonus Fest', ads: 16, tasks: 2000, minWithdraw: 4000, minDeposit: 4000, price: 2 },
      profit: { name: 'Profit Fest', ads: 20, tasks: 2000, minWithdraw: 2000, minDeposit: 2000, price: 5 }
    }
  });

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
