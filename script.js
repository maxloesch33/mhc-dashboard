// MHC Query Dashboard - Main JavaScript
class QueryDashboard {
    constructor() {
        this.queries = [];
        this.filteredQueries = [];
        this.currentSection = 'all';
        this.searchTerm = '';
        this.favorites = new Set();
        this.lastResults = null;
        
        this.init();
    }
    
    async init() {
        console.log('MHC Query Dashboard initializing...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load favorites from localStorage
        this.loadFavorites();
        
        // Check server status
        await this.checkServerStatus();
    }
    
    async checkServerStatus() {
        try {
            const response = await fetch('/api/execute');
            if (response.ok) {
                document.getElementById('server-status').innerHTML = 
                    '<i class="fas fa-check-circle" style="color: #48bb78;"></i> Connected';
                return true;
            }
        } catch (error) {
            console.log('Server not responding yet:', error.message);
        }
        
        document.getElementById('server-status').innerHTML = 
            '<i class="fas fa-times-circle" style="color: #e53e3e;"></i> Not Connected';
        return false;
    }
    
    async loadSQLFiles() {
        console.log('Loading SQL files from server...');
        
        try {
            // Get list of SQL files
            const response = await fetch('/api/execute');
            if (!response.ok) {
                throw new Error('Failed to fetch SQL files list');
            }
            
            const data = await response.json();
            const files = data.files || [];
            
            if (files.length === 0) {
                this.showMessage('No SQL files found in sql_queries/ folder', 'warning');
                this.updateQueryCount(0);
                return;
            }
            
            // Load each SQL file
            this.queries = [];
            let loadedCount = 0;
            
            for (const file of files) {
                try {
                    const fileQueries = await this.loadSQLFile(file.name);
                    if (fileQueries.length > 0) {
                        this.queries.push(...fileQueries);
                        loadedCount++;
                        console.log(`✓ Loaded ${fileQueries.length} queries from ${file.name}`);
                    }
                } catch (error) {
                    console.error(`Failed to load ${file.name}:`, error);
                }
            }
            
            // Update UI
            this.updateQueryCount(this.queries.length);
            this.createSectionTabs();
            this.filterBySection('all');
            
            this.showMessage(`Loaded ${this.queries.length} queries from ${loadedCount} files`, 'success');
            
        } catch (error) {
            console.error('Error loading SQL files:', error);
            this.showMessage(`Error: ${error.message}`, 'error');
            
            // Show fallback UI
            this.showFallbackUI();
        }
    }
    
    async loadSQLFile(filename) {
        const response = await fetch(`http://api/execute/${encodeURIComponent(filename)}`);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${filename}`);
        }
        
        const data = await response.json();
        const content = data.content;
        
        return this.parseSQLFile(content, filename);
    }
    
    parseSQLFile(content, filename) {
        const queries = [];
        const lines = content.split('\n');
        
        let currentQuery = null;
        let inQuery = false;
        
        // Determine section from filename
        const section = this.getSectionFromFilename(filename);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for query headers like "-- Query 1.1: Title"
            if (line.startsWith('-- Query')) {
                // Save previous query if exists
                if (currentQuery && currentQuery.sql.trim()) {
                    queries.push(currentQuery);
                }
                
                // Parse new query header
                const match = line.match(/-- Query (\d+\.\d+):\s*(.+)/);
                if (match) {
                    currentQuery = {
                        id: `${section}_${match[1].replace('.', '_')}_${Date.now()}`,
                        number: match[1],
                        title: match[2].trim(),
                        sql: '',
                        section: section,
                        filename: filename,
                        description: ''
                    };
                    inQuery = true;
                }
            }
            // Get description from next comment line
            else if (currentQuery && !currentQuery.description && line.startsWith('--') && !line.includes('Query')) {
                currentQuery.description = line.replace('--', '').trim();
            }
            // Collect SQL lines
            else if (inQuery && line && !line.startsWith('--')) {
                currentQuery.sql += line + '\n';
                
                // Check if this line ends the query
                if (line.endsWith(';')) {
                    inQuery = false;
                }
            }
        }
        
        // Add the last query
        if (currentQuery && currentQuery.sql.trim()) {
            queries.push(currentQuery);
        }
        
        // If no queries were found with -- Query format, try to extract any SQL
        if (queries.length === 0) {
            const sqlBlocks = content.split(';').filter(block => block.trim().length > 20);
            
            sqlBlocks.forEach((block, index) => {
                const sql = block.trim() + ';';
                if (sql.length > 10) {
                    queries.push({
                        id: `${section}_custom_${index}_${Date.now()}`,
                        number: `${index + 1}.0`,
                        title: this.extractTitleFromSQL(sql),
                        sql: sql,
                        section: section,
                        filename: filename,
                        description: 'Auto-extracted query'
                    });
                }
            });
        }
        
        return queries;
    }
    
    getSectionFromFilename(filename) {
        const sections = {
            'demographics': 'Demographics',
            'mental_health': 'Mental Health',
            'criminal_history': 'Criminal History',
            'performance': 'Performance',
            'analytics': 'Analytics'
        };
        
        for (const [key, value] of Object.entries(sections)) {
            if (filename.toLowerCase().includes(key)) {
                return value;
            }
        }
        
        return 'Other';
    }
    
    extractTitleFromSQL(sql) {
        // Try to create a title from the SQL
        const firstLine = sql.split('\n')[0].trim();
        if (firstLine.length > 50) {
            return firstLine.substring(0, 50) + '...';
        }
        return firstLine || 'SQL Query';
    }
    
    createSectionTabs() {
        // Get unique sections
        const sections = ['all', ...new Set(this.queries.map(q => q.section))];
        const container = document.getElementById('section-tabs');
        
        let html = '';
        sections.forEach(section => {
            const count = section === 'all' 
                ? this.queries.length 
                : this.queries.filter(q => q.section === section).length;
            
            const displayName = section === 'all' ? 'All Queries' : section;
            const activeClass = section === 'all' ? 'active' : '';
            
            html += `
                <button class="section-tab ${activeClass}" 
                        onclick="dashboard.filterBySection('${section}')"
                        data-count="${count}">
                    ${displayName} <span class="tab-count">(${count})</span>
                </button>
            `;
        });
        
        container.innerHTML = html;
    }
    
    filterBySection(section) {
        this.currentSection = section;
        
        // Update active tab
        document.querySelectorAll('.section-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`.section-tab[onclick*="${section}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        this.applyFilters();
    }
    
    filterQueries() {
        this.searchTerm = document.getElementById('search-input').value.toLowerCase();
        this.applyFilters();
    }
    
    applyFilters() {
        // Start with all queries
        this.filteredQueries = [...this.queries];
        
        // Filter by section
        if (this.currentSection !== 'all') {
            this.filteredQueries = this.filteredQueries.filter(q => q.section === this.currentSection);
        }
        
        // Filter by search term
        if (this.searchTerm) {
            this.filteredQueries = this.filteredQueries.filter(q => 
                q.title.toLowerCase().includes(this.searchTerm) ||
                q.sql.toLowerCase().includes(this.searchTerm) ||
                q.description.toLowerCase().includes(this.searchTerm) ||
                q.number.includes(this.searchTerm) ||
                q.section.toLowerCase().includes(this.searchTerm)
            );
        }
        
        this.displayQueries();
    }
    
    displayQueries() {
        const container = document.getElementById('queries-container');
        
        if (this.filteredQueries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 15px; color: #a0aec0;"></i>
                    <h3>No queries found</h3>
                    <p>${this.searchTerm ? 'Try a different search term' : 'No queries match the current filter'}</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        this.filteredQueries.forEach(query => {
            const isFavorite = this.favorites.has(query.id);
            
            html += `
                <div class="query-item" onclick="dashboard.loadQuery('${query.id}')">
                    <div class="query-header">
                        <div class="query-title">${this.escapeHtml(query.title)}</div>
                        <div class="query-number">${query.number}</div>
                    </div>
                    
                    ${query.description ? `
                    <div class="query-description">${this.escapeHtml(query.description)}</div>
                    ` : ''}
                    
                    <div class="query-sql" title="${this.escapeHtml(query.sql)}">
                        ${this.escapeHtml(this.truncateText(query.sql, 150))}
                    </div>
                    
                    <div class="query-footer">
                        <div>
                            <i class="fas fa-folder"></i>
                            ${query.section}
                        </div>
                        <div>
                            <i class="fas fa-file-code"></i>
                            ${query.filename}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    loadQuery(queryId) {
        const query = this.queries.find(q => q.id === queryId);
        if (!query) return;
        
        // Load into editor
        const editor = document.getElementById('sql-editor');
        editor.value = query.sql;
        editor.focus();
        
        // Update query info
        document.getElementById('query-info').innerHTML = `
            <i class="fas fa-check-circle" style="color: #48bb78;"></i>
            <span><strong>Query ${query.number}</strong> - ${this.escapeHtml(query.title)} (${query.section})</span>
        `;
        
        this.showMessage(`Loaded Query ${query.number}`, 'info');
    }
    
    async executeQuery() {
        const sql = document.getElementById('sql-editor').value.trim();
        
        if (!sql) {
            this.showMessage('No query to execute', 'warning');
            return;
        }
        
        // Security check: only allow SELECT queries
        const upperSQL = sql.toUpperCase();
        if (!upperSQL.startsWith('SELECT')) {
            this.showMessage('Only SELECT queries are allowed for security', 'error');
            return;
        }
        
        const runButton = document.getElementById('run-button');
        const originalText = runButton.innerHTML;
        runButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
        runButton.disabled = true;
        
        this.showMessage('Executing query against MHC_Project.db...', 'info');
        
        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sql: sql })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Query execution failed');
            }
            
            // Store results
            this.lastResults = result;
            
            // Display results
            this.displayResults(result.rows, result.columns, result.rowCount);
            
            this.showMessage(`Query executed successfully! Returned ${result.rowCount} rows`, 'success');
            
        } catch (error) {
            console.error('Query execution error:', error);
            this.showMessage(`Error: ${error.message}`, 'error');
            
            // Clear results
            this.displayResults([], [], 0);
        } finally {
            runButton.innerHTML = originalText;
            runButton.disabled = false;
        }
    }
    
    displayResults(rows, columns, count) {
        const panel = document.getElementById('results-panel');
        const container = document.getElementById('results-container');
        const countElement = document.getElementById('results-count');
        const exportButton = document.getElementById('export-btn');
        
        // Show results panel
        panel.style.display = 'block';
        
        // Update count
        countElement.textContent = `${count} row${count !== 1 ? 's' : ''}`;
        
        // Enable/disable export button
        exportButton.disabled = count === 0;
        
        if (count === 0) {
            container.innerHTML = `
                <div class="empty-results">
                    <i class="fas fa-database"></i>
                    <p>Query executed successfully but returned no results</p>
                </div>
            `;
            return;
        }
        
        // Create table
        let html = '<table class="results-table">';
        
        // Header
        html += '<thead><tr>';
        columns.forEach(col => {
            html += `<th>${this.escapeHtml(col)}</th>`;
        });
        html += '</tr></thead>';
        
        // Rows
        html += '<tbody>';
        rows.forEach((row, rowIndex) => {
            html += `<tr>`;
            columns.forEach(col => {
                const value = row[col] !== null ? row[col] : '<span style="color: #cbd5e0; font-style: italic;">NULL</span>';
                html += `<td title="${this.escapeHtml(String(value))}">${this.escapeHtml(String(value))}</td>`;
            });
            html += `</tr>`;
        });
        html += '</tbody></table>';
        
        container.innerHTML = html;
    }
    
    exportToCSV() {
        if (!this.lastResults || this.lastResults.rowCount === 0) {
            this.showMessage('No results to export', 'warning');
            return;
        }
        
        const { rows, columns } = this.lastResults;
        
        // Create CSV content
        let csv = columns.join(',') + '\n';
        
        rows.forEach(row => {
            const rowData = columns.map(col => {
                let value = row[col];
                if (value === null) value = '';
                // Escape quotes and wrap in quotes if contains comma or quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            });
            csv += rowData.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mhc_query_results_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showMessage(`Exported ${rows.length} rows to CSV`, 'success');
    }
    
    formatSQL() {
        const editor = document.getElementById('sql-editor');
        let sql = editor.value;
        
        // Basic formatting
        sql = sql
            .replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|LIMIT|HAVING)\b/gi, '\n$1')
            .replace(/\b(AND|OR)\b/gi, '\n  $1')
            .replace(/,\s*/g, ',\n  ')
            .replace(/\s+/g, ' ')
            .trim();
        
        editor.value = sql;
        this.showMessage('Query formatted', 'info');
    }
    
    copyToClipboard() {
        const sql = document.getElementById('sql-editor').value.trim();
        if (!sql) {
            this.showMessage('No query to copy', 'warning');
            return;
        }
        
        navigator.clipboard.writeText(sql).then(() => {
            this.showMessage('Query copied to clipboard', 'success');
        }).catch(err => {
            this.showMessage('Failed to copy to clipboard', 'error');
        });
    }
    
    clearEditor() {
        document.getElementById('sql-editor').value = '';
        document.getElementById('query-info').innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>No query loaded. Click a query from the library.</span>
        `;
        
        // Hide results panel
        document.getElementById('results-panel').style.display = 'none';
        
        this.showMessage('Editor cleared', 'info');
    }
    
    updateQueryCount(count) {
        document.getElementById('query-count').textContent = `${count} queries loaded`;
        
        // Update footer info
        const footerInfo = document.getElementById('footer-info');
        if (count === 0) {
            footerInfo.textContent = 'No queries loaded. Check sql_queries/ folder.';
        } else {
            footerInfo.textContent = `Ready to execute queries (${count} loaded)`;
        }
    }
    
    loadFavorites() {
        try {
            const saved = localStorage.getItem('mhc_favorites');
            if (saved) {
                this.favorites = new Set(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }
    
    saveFavorites() {
        try {
            localStorage.setItem('mhc_favorites', JSON.stringify([...this.favorites]));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }
    
    showFallbackUI() {
        const container = document.getElementById('queries-container');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; color: #ed8936;"></i>
                <h3>Cannot Load SQL Files</h3>
                <p>The server might not be running.</p>
                <p style="margin-top: 10px; font-size: 14px; color: #718096;">
                    Make sure you've run: <code>npm install</code> then <code>node server.js</code>
                </p>
            </div>
        `;
    }
    
    showMessage(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            border-left: 4px solid ${type === 'success' ? '#48bb78' : type === 'error' ? '#e53e3e' : '#4299e1'};
            animation: slideIn 0.3s ease;
        `;
        
        const icon = type === 'success' ? 'check-circle' :
                    type === 'error' ? 'exclamation-circle' :
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        notification.innerHTML = `
            <i class="fas fa-${icon}" style="color: ${type === 'success' ? '#48bb78' : type === 'error' ? '#e53e3e' : '#4299e1'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    setupEventListeners() {
        // Ctrl+Enter to execute query
        const editor = document.getElementById('sql-editor');
        if (editor) {
            editor.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.executeQuery();
                }
            });
        }
        
        // Auto-save current query
        let saveTimeout;
        if (editor) {
            editor.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    const sql = editor.value.trim();
                    if (sql) {
                        localStorage.setItem('mhc_last_query', sql);
                    }
                }, 1000);
            });
        }
        
        // Load last query on startup
        const lastQuery = localStorage.getItem('mhc_last_query');
        if (lastQuery && editor) {
            editor.value = lastQuery;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }  
}

// Initialize dashboard
let dashboard = new QueryDashboard();

// Make functions available globally
window.loadSQLFiles = () => dashboard.loadSQLFiles();
window.executeQuery = () => dashboard.executeQuery();
window.formatSQL = () => dashboard.formatSQL();
window.copyToClipboard = () => dashboard.copyToClipboard();
window.clearEditor = () => dashboard.clearEditor();
window.filterQueries = () => dashboard.filterQueries();
window.exportToCSV = () => dashboard.exportToCSV();
window.checkServerStatus = () => dashboard.checkServerStatus();
// PDF Viewer Functions
let currentPDF = '';
let currentZoom = 100;

function openPDF(filename, title, description = '') {
    currentPDF = filename;
    
    // Update UI
    document.getElementById('pdf-title').textContent = title;
    document.getElementById('pdf-filename').textContent = filename;
    document.getElementById('pdf-zoom').textContent = '100%';
    
    // Show loading
    document.getElementById('pdf-loading').style.display = 'flex';
    
    // Load PDF
    const viewer = document.getElementById('pdf-viewer');
    viewer.src = filename + '#toolbar=0&navpanes=0&scrollbar=0';
    
    // Show modal
    document.getElementById('pdf-modal').style.display = 'block';
    
    // Reset zoom
    currentZoom = 100;
    viewer.style.transform = `scale(${currentZoom / 100})`;
    viewer.style.transformOrigin = 'top left';
    
    // Hide loading when PDF loads
    viewer.onload = function() {
        setTimeout(() => {
            document.getElementById('pdf-loading').style.display = 'none';
        }, 500);
    };
}

function closePDF() {
    document.getElementById('pdf-modal').style.display = 'none';
    document.getElementById('pdf-viewer').src = '';
    currentPDF = '';
}

function zoomInPDF() {
    if (currentZoom < 200) {
        currentZoom += 10;
        updatePDFZoom();
    }
}

function zoomOutPDF() {
    if (currentZoom > 50) {
        currentZoom -= 10;
        updatePDFZoom();
    }
}

function updatePDFZoom() {
    const viewer = document.getElementById('pdf-viewer');
    document.getElementById('pdf-zoom').textContent = `${currentZoom}%`;
    viewer.style.transform = `scale(${currentZoom / 100})`;
}

function downloadCurrentPDF() {
    if (currentPDF) {
        const link = document.createElement('a');
        link.href = currentPDF;
        link.download = currentPDF;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show notification
        if (dashboard && dashboard.showMessage) {
            dashboard.showMessage(`Downloading ${currentPDF}`, 'success');
        }
    }
}

function printCurrentPDF() {
    if (currentPDF) {
        const printWindow = window.open(currentPDF, '_blank');
        printWindow.onload = function() {
            printWindow.print();
        };
    }
}

// Close modal on ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closePDF();
    }
});

// Close modal when clicking outside
document.getElementById('pdf-modal').addEventListener('click', function(e) {
    if (e.target.id === 'pdf-modal') {
        closePDF();
    }
});