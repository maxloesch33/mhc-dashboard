const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve frontend files

// Database connection
const dbPath = path.join(__dirname, 'MHC_Project.db');
console.log('📂 Database path:', dbPath);

// Debug: list files in current directory
try {
    const files = fs.readdirSync(__dirname);
    console.log('📁 Files in directory:', files.filter(f => f.includes('.db') || f.includes('.sql')).join(', '));
} catch (err) {
    console.log('⚠️  Cannot list directory:', err.message);
}

let db;
try {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error('❌ Read-write connection failed:', err.message);
            
            // Try read-only as fallback
            db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err2) => {
                if (err2) {
                    console.error('❌ Read-only also failed:', err2.message);
                    console.log('💡 The database file might not exist on Render');
                } else {
                    console.log('✅ Connected to MHC_Project.db (read-only)');
                }
            });
        } else {
            console.log('✅ Connected to MHC_Project.db (read-write)');
        }
    });
} catch (error) {
    console.error('❌ Database initialization error:', error.message);
    // Don't exit - let the server start without database
    console.log('⚠️  Starting server without database connection');
}

// API: Execute SQL Query
app.post('/api/execute', async (req, res) => {
    const { sql } = req.body;
    
    if (!sql || sql.trim() === '') {
        return res.status(400).json({ error: 'No SQL query provided' });
    }
    
    // Security: Only allow SELECT queries
    const upperSQL = sql.toUpperCase().trim();
    if (!upperSQL.startsWith('SELECT')) {
        return res.status(403).json({ 
            error: 'For security, only SELECT queries are allowed' 
        });
    }
    
    console.log(`🔍 Executing query: ${sql.substring(0, 80)}...`);
    
    try {
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Query error:', err.message);
                return res.status(500).json({ error: err.message });
            }
            
            // Get column names
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            
            res.json({
                success: true,
                rows: rows,
                columns: columns,
                rowCount: rows.length,
                sql: sql
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Get list of SQL files
app.get('/api/sql-files', (req, res) => {
    const sqlDir = path.join(__dirname, 'sql_queries');
    
    if (!fs.existsSync(sqlDir)) {
        return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(sqlDir)
        .filter(file => file.endsWith('.sql'))
        .map(file => ({
            name: file,
            path: `sql_queries/${file}`
        }));
    
    res.json({ files });
});

// API: Get content of a specific SQL file
app.get('/api/sql-file/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'sql_queries', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 MHC Query Dashboard Server Started!
========================================
📊 Database: MHC_Project.db
🌐 Frontend: http://localhost:${PORT}
🔧 API Ready:
   - POST /api/execute    (Run queries)
   - GET  /api/sql-files  (List SQL files)
========================================
✅ Server running. Keep this terminal open.
✅ Open http://localhost:${PORT} in your browser.
`);
});