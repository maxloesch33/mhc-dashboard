const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('Testing MHC_Project.db connection...');

// Check if file exists
if (!fs.existsSync('MHC_Project.db')) {
    console.error('❌ ERROR: MHC_Project.db not found in current folder');
    console.log('Current folder:', process.cwd());
    console.log('Files:', fs.readdirSync('.'));
    process.exit(1);
}

// Try to connect
const db = new sqlite3.Database('MHC_Project.db', (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ Connected to MHC_Project.db');
        
        // Try a simple query
        db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
            if (err) {
                console.error('❌ Query error:', err.message);
            } else {
                console.log('📋 Tables found:', tables.map(t => t.name).join(', ') || 'None');
            }
            db.close();
        });
    }
});
