import { recordNewUser, ensureStatsDocExists } from './src/utils/stats.js';

const test = async () => {
    await ensureStatsDocExists();
    console.log("Stats document initialized.");

    const users = ['test1', 'test2', 'test3'];
    for (const u of users) {
        console.log(`Recording user: ${u}`);
        await recordNewUser(u);
    }
    console.log("User joins recorded.");
};

test().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
