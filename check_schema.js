require('dotenv').config({ path: './server/.env' });
const db = require('./server/database');

async function checkSchema() {
    try {
        const [rows] = await db.query('DESCRIBE payments');
        console.log('--- payments table ---');
        console.table(rows);
        
        const [rows2] = await db.query('DESCRIBE team_memberships');
        console.log('--- team_memberships table ---');
        console.table(rows2);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
