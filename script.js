document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("cup-list");
    const searchInput = document.getElementById("search-input");
    const statsContainer = document.getElementById("stats-container");

    let allCups = [];

    fetch('bonk_cup_data.json')
        .then(res => {
            if (!res.ok) throw new Error("JSON file not found");
            return res.json();
        })
        .then(data => {
            allCups = data;
            renderStats(allCups);
            renderList(allCups);
            
            // Render Only 2 Charts Now
            renderWinsChart(allCups);
            renderMappersChart(allCups);
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = `
                <div class="loading">
                    <p style="color: #ff4444;">Error loading data.</p>
                    <p style="font-size:0.8rem; color:#ccc;">Make sure 'bonk_cup_data.json' exists.</p>
                </div>`;
        });

    // --- KPI CARDS ---
    function renderStats(data) {
        const totalCups = data.length;
        const uniqueWinners = new Set(
            data.map(c => c.winner).filter(w => w && w !== "Unknown" && w.trim() !== "")
        );

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalCups}</div>
                <div class="stat-label">Total Cups</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${uniqueWinners.size}</div>
                <div class="stat-label">Unique Winners</div>
            </div>
        `;
    }

    // --- ACCORDION LIST ---
    function renderList(cups) {
        container.innerHTML = "";

        if (cups.length === 0) {
            container.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>No results found.</p>";
            return;
        }

        cups.forEach(cup => {
            const tab = document.createElement("div");
            tab.classList.add("accordion-tab");

            let dateStr = "Unknown Date";
            if (cup.display_date) {
                dateStr = cup.display_date; 
            } else if (cup.publish_date) {
                dateStr = new Date(cup.publish_date * 1000).toLocaleDateString();
            }

            const formattedCampaignName = formatTmName(cup.campaign_name);

            let html = `
                <div class="accordion-header">
                    <div class="cup-info">
                        <span class="edition-badge">#${cup.edition}</span>
                        <div>
                            <div class="cup-title">${formattedCampaignName}</div>
                            <div class="cup-date">${dateStr}</div>
                        </div>
                    </div>
                    <div class="winner-badge">
                        <i class="fas fa-trophy"></i> ${cup.winner || "Unknown"}
                    </div>
                </div>
                
                <div class="accordion-content">
                    <table>
                        <thead>
                            <tr>
                                <th width="50">#</th>
                                <th>Map Name</th>
                                <th>Author</th>
                                <th>Author Time</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            if (cup.maps && cup.maps.length > 0) {
                cup.maps.forEach((map, index) => {
                    const timeSec = (map.time_author / 1000).toFixed(3);
                    const formattedMapName = formatTmName(map.name);

                    html += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>
                                <div class="map-cell">
                                    <a href="https://trackmania.io/#/leaderboard/${map.uid}" target="_blank" style="color:#fff; text-decoration:underline; font-weight:500;">
                                        ${formattedMapName}
                                    </a>
                                    <button class="copy-icon-btn" onclick="copyToClipboard('${map.uid}', this)" title="Copy UID">
                                        <i class="fas fa-copy"></i> UID
                                    </button>
                                </div>
                            </td>
                            <td>${map.author}</td>
                            <td>${timeSec}s</td>
                        </tr>
                    `;
                });
            } else {
                html += `<tr><td colspan="4" style="text-align:center; padding:15px;">No maps loaded for this cup.</td></tr>`;
            }

            // Only One Button Now (View on TM.io)
            html += `
                        </tbody>
                    </table>
                    <div style="padding: 15px;">
                        <a href="${cup.tm_io_url}" target="_blank" class="tm-btn">
                            View on Trackmania.io <i class="fas fa-external-link-alt" style="margin-left:5px;"></i>
                        </a>
                    </div>
                </div>
            `;

            tab.innerHTML = html;
            container.appendChild(tab);

            const header = tab.querySelector(".accordion-header");
            header.addEventListener("click", () => {
                tab.classList.toggle("active");
            });
        });
    }

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderList(allCups);
            return;
        }
        const filtered = allCups.filter(cup => {
            const inName = cup.campaign_name.toLowerCase().includes(query);
            const inWinner = (cup.winner || "").toLowerCase().includes(query);
            const inEdition = String(cup.edition).includes(query);
            const inDate = (cup.display_date || "").includes(query);

            let inMaps = false;
            if (cup.maps) {
                inMaps = cup.maps.some(map => 
                    map.name.toLowerCase().includes(query) || 
                    map.author.toLowerCase().includes(query)
                );
            }
            return inName || inWinner || inEdition || inDate || inMaps;
        });
        renderList(filtered);
    });
});

// --- GLOBAL TAB FUNCTION ---
window.openTab = function(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
};

// --- NEW COPY FUNCTION (PER MAP) ---
window.copyToClipboard = function(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        // Visual Feedback on the button
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check" style="color:#00d26a;"></i>`;
        btn.style.borderColor = "#00d26a";
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.borderColor = "#444";
        }, 1500);
    }).catch(err => console.error(err));
};

// --- CHART 1: MOST WINS ---
function renderWinsChart(data) {
    const wins = {};
    data.forEach(cup => {
        let w = cup.winner;
        if(w && w !== "Unknown" && w.trim() !== "") {
            wins[w] = (wins[w] || 0) + 1;
        }
    });
    
    const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 25);
    
    new Chart(document.getElementById('winsChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{
                label: 'Wins',
                data: sorted.map(i => i[1]),
                backgroundColor: 'rgba(0, 210, 106, 0.6)',
                borderColor: '#00d26a',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
                x: { grid: { display: false }, ticks: { color: '#ccc' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- CHART 2: TOP MAPPERS ---
function renderMappersChart(data) {
    const mappers = {};
    data.forEach(cup => {
        if(cup.maps) {
            cup.maps.forEach(map => {
                const author = map.author;
                if(author && !author.includes("-")) {
                    mappers[author] = (mappers[author] || 0) + 1;
                }
            });
        }
    });

    const sorted = Object.entries(mappers).sort((a, b) => b[1] - a[1]).slice(0, 15);

    new Chart(document.getElementById('mappersChart').getContext('2d'), {
        type: 'bar',
        indexAxis: 'y', // Horizontal
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{
                label: 'Maps Built',
                data: sorted.map(i => i[1]),
                backgroundColor: 'rgba(255, 215, 0, 0.6)',
                borderColor: '#ffd700',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
                y: { grid: { display: false }, ticks: { color: '#ccc' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function formatTmName(raw) {
    if (!raw) return "";
    const parts = raw.split('$');
    let html = parts[0]; 
    for (let i = 1; i < parts.length; i++) {
        let part = parts[i];
        if (/^[0-9a-fA-F]{3}/.test(part)) {
            let colorCode = part.substring(0, 3);
            let textContent = part.substring(3);
            html += `<span style="color:#${colorCode}">${textContent}</span>`;
        } else if (/^[zZgG]/.test(part)) {
             html += `<span style="color:inherit">${part.substring(1)}</span>`;
        } else if (/^[iIwWnNsSoO]/.test(part)) {
            html += part.substring(1);
        } else {
            html += "$" + part;
        }
    }
    return html;
}