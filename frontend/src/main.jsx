import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ConfigProvider } from './context/ConfigContext';
import { UserProvider } from './context/UserContext';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { LanguageProvider } from './context/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl="https://eidfest.up.railway.app/tonconnect-manifest.json">
      <ConfigProvider>
        <UserProvider>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </UserProvider>
      </ConfigProvider>
    </TonConnectUIProvider>
  </React.StrictMode>
);
