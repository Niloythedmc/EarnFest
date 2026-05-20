import axios from 'axios';

let cachedPrice = 5.0;
let lastFetchTime = 0;
const CACHE_TTL = 300000; // 5 minutes

export const getTonPrice = async () => {
    const now = Date.now();
    if (now - lastFetchTime < CACHE_TTL) {
        return cachedPrice;
    }

    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
        cachedPrice = response.data['the-open-network'].usd;
        lastFetchTime = now;
        return cachedPrice;
    } catch (error) {
        console.error('Price Fetch Error:', error.message);
        return cachedPrice;
    }
};
