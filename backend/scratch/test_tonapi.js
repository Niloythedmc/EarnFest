import axios from 'axios';

async function test() {
    const testnetHash = '07096e27144e54865d496a84f39c19b068a14b03517c374640d04c4f346b0a1d';
    try {
        const resp = await axios.get(`https://tonapi.io/v2/blockchain/transactions/${testnetHash}`);
        console.log('Success:', resp.status);
    } catch (e) {
        console.log('Error:', e.response?.status || e.message);
    }
}

test();
