let allCups = [];
let allFlatMaps = [];
let winsChartInstance = null;
let mappersChartInstance = null;
let currentCupSort = "edition-desc";
let currentMapSort = "edition-desc";
let currentMapPage = 1;
let mapPageSize = 72;

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-input");
    const cupSortSelect = document.getElementById("cup-sort-select");
    const mapSearchInput = document.getElementById("map-search-input");
    const mapSortSelect = document.getElementById("map-sort-select");
    const mapPageSizeSelect = document.getElementById("map-page-size-select");
    const yearFilter = document.getElementById("year-filter");

    // --- SCROLL LISTENER FOR STICKY HEADER ---
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    fetch('bonk_cup_data.json')
        .then(res => res.json())
        .then(data => {
            allCups = data;
            allFlatMaps = extractAllMaps(data);
            
            // Initial Renders
            renderStats(allCups);
            applyCampaignFilterAndSort();
            renderMapsTab();
            populateYearFilter(allCups);
            
            // Render Stats View (All Time)
            updateStatsView(allCups);

            setTimeout(checkDeepLink, 500);
        })
        .catch(err => console.error(err));

    // Campaign Search & Sort Listeners
    if (searchInput) searchInput.addEventListener("input", applyCampaignFilterAndSort);
    if (cupSortSelect) cupSortSelect.addEventListener("change", (e) => {
        currentCupSort = e.target.value;
        applyCampaignFilterAndSort();
    });

    // Maps Tab Search, Sort & Page Size Listeners
    if (mapSearchInput) mapSearchInput.addEventListener("input", () => {
        currentMapPage = 1;
        renderMapsTab();
    });
    if (mapSortSelect) mapSortSelect.addEventListener("change", (e) => {
        currentMapSort = e.target.value;
        currentMapPage = 1;
        renderMapsTab();
    });
    if (mapPageSizeSelect) mapPageSizeSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        mapPageSize = val === "all" ? 999999 : parseInt(val);
        currentMapPage = 1;
        renderMapsTab();
    });

    // Year Filter Listener
    if (yearFilter) yearFilter.addEventListener("change", (e) => {
        const selectedYear = e.target.value;
        let filteredData = allCups;

        if (selectedYear !== "all") {
            filteredData = allCups.filter(cup => {
                const year = getYearFromCup(cup);
                return String(year) === selectedYear;
            });
        }
        
        updateStatsView(filteredData);
    });

    // Modal Keyboard Close (ESC)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closePlayerModal();
    });
});

// --- HELPER: Extract All Flat Maps ---
function extractAllMaps(cups) {
    const maps = [];
    cups.forEach(cup => {
        if (cup.maps && Array.isArray(cup.maps)) {
            cup.maps.forEach(map => {
                maps.push({
                    ...map,
                    edition: cup.edition,
                    campaign_name: cup.campaign_name,
                    winner: cup.winner,
                    display_date: cup.display_date,
                    publish_date: cup.publish_date
                });
            });
        }
    });
    return maps;
}

// --- HELPER: Get Year from Cup ---
function getYearFromCup(cup) {
    if (cup.display_date) {
        const parts = cup.display_date.split('.');
        if (parts.length === 3) return parts[2]; 
    }
    if (cup.publish_date) {
        return new Date(cup.publish_date * 1000).getFullYear();
    }
    return "Unknown";
}

// --- Populate Year Dropdown ---
function populateYearFilter(data) {
    const years = new Set();
    data.forEach(cup => {
        const y = getYearFromCup(cup);
        if (y && y !== "Unknown") years.add(y);
    });
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    const select = document.getElementById("year-filter");
    if (!select) return;
    
    sortedYears.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });
}

// --- Campaign Filter & Sort Master ---
function applyCampaignFilterAndSort() {
    const searchInput = document.getElementById("search-input");
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    let filtered = [...allCups];

    if (query) {
        filtered = filtered.filter(cup => {
            const inName = (cup.campaign_name || "").toLowerCase().includes(query);
            const inWinner = (cup.winner || "").toLowerCase().includes(query);
            const inEdition = String(cup.edition).includes(query);
            let inMaps = false;
            if (cup.maps) {
                inMaps = cup.maps.some(map => 
                    (map.name || "").toLowerCase().includes(query) || 
                    (map.author || "").toLowerCase().includes(query)
                );
            }
            return inName || inWinner || inEdition || inMaps;
        });
    }

    // Sort
    filtered.sort((a, b) => {
        if (currentCupSort === "edition-desc") return b.edition - a.edition;
        if (currentCupSort === "edition-asc") return a.edition - b.edition;
        if (currentCupSort === "maps-desc") return (b.maps ? b.maps.length : 0) - (a.maps ? a.maps.length : 0);
        if (currentCupSort === "time-desc") {
            const totalA = (a.maps || []).reduce((acc, m) => acc + (m.time_author || 0), 0);
            const totalB = (b.maps || []).reduce((acc, m) => acc + (m.time_author || 0), 0);
            return totalB - totalA;
        }
        return b.edition - a.edition;
    });

    renderList(filtered);
}

// --- Master Update Function for Stats Tab ---
function updateStatsView(data) {
    renderWinsChart(data);
    renderMappersChart(data);
    renderTrivia(data); 
}

function renderStats(data) {
    const totalCups = data.length;
    const uniqueWinners = new Set(data.map(c => c.winner).filter(w => w && w !== "Unknown"));
    
    const totalEl = document.getElementById("stat-total-cups");
    const winnersEl = document.getElementById("stat-unique-winners");
    
    if (totalEl) totalEl.textContent = totalCups;
    if (winnersEl) winnersEl.textContent = uniqueWinners.size;
}

function renderTrivia(data) {
    let longestMap = { time: 0, name: "N/A", author: "-", edition: 0 };
    let shortestMap = { time: 99999999, name: "N/A", author: "-", edition: 0 };
    const mappersCount = {};
    const winsCount = {};
    
    data.forEach(cup => {
        if (cup.winner && cup.winner !== "Unknown") {
            winsCount[cup.winner] = (winsCount[cup.winner] || 0) + 1;
        }

        if(cup.maps) {
            cup.maps.forEach(m => {
                if (m.author && !m.author.includes("-")) {
                    mappersCount[m.author] = (mappersCount[m.author] || 0) + 1;
                }

                if(m.time_author > longestMap.time) {
                    longestMap = { time: m.time_author, name: m.name, author: m.author, edition: cup.edition };
                }
                if(m.time_author > 1000 && m.time_author < shortestMap.time) {
                    shortestMap = { time: m.time_author, name: m.name, author: m.author, edition: cup.edition };
                }
            });
        }
    });

    let currentStreak = 0;
    let bestStreak = { count: 0, player: "N/A" };
    let lastWinner = "";
    
    const chron = [...data].sort((a, b) => a.edition - b.edition);
    
    chron.forEach(cup => {
        const w = cup.winner;
        if(w && w !== "Unknown" && w.trim() !== "") {
            if(w === lastWinner) {
                currentStreak++;
            } else {
                if(currentStreak > bestStreak.count) bestStreak = { count: currentStreak, player: lastWinner };
                currentStreak = 1;
                lastWinner = w;
            }
        }
    });
    if(currentStreak > bestStreak.count) bestStreak = { count: currentStreak, player: lastWinner };

    // Find top mapper & winner
    const topMapper = Object.entries(mappersCount).sort((a,b) => b[1] - a[1])[0] || ["N/A", 0];
    const topWinner = Object.entries(winsCount).sort((a,b) => b[1] - a[1])[0] || ["N/A", 0];
    const pioneerCup = chron.find(c => c.edition === 1 || c.winner);

    const formatTime = (ms) => {
        if (ms === 0 || ms === 99999999) return "-";
        const min = Math.floor(ms / 60000);
        const sec = ((ms % 60000) / 1000).toFixed(2);
        return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
    };

    const html = `
        <div class="trivia-item">
            <div class="trivia-icon"><i class="fas fa-hourglass-end"></i></div>
            <div class="trivia-content">
                <div class="trivia-label">Longest Map</div>
                <div class="trivia-value">${formatTmName(longestMap.name)}</div>
                <div class="trivia-sub">${formatTime(longestMap.time)} by <span class="player-link" onclick="openPlayerModal('${escapeJsStr(longestMap.author)}')">${longestMap.author}</span> (Cup #${longestMap.edition})</div>
            </div>
        </div>
        <div class="trivia-item">
            <div class="trivia-icon"><i class="fas fa-stopwatch"></i></div>
            <div class="trivia-content">
                <div class="trivia-label">Shortest Map</div>
                <div class="trivia-value">${formatTmName(shortestMap.name)}</div>
                <div class="trivia-sub">${formatTime(shortestMap.time)} by <span class="player-link" onclick="openPlayerModal('${escapeJsStr(shortestMap.author)}')">${shortestMap.author}</span> (Cup #${shortestMap.edition})</div>
            </div>
        </div>
        <div class="trivia-item">
            <div class="trivia-icon"><i class="fas fa-fire"></i></div>
            <div class="trivia-content">
                <div class="trivia-label">Highest Win Streak</div>
                <div class="trivia-value"><span class="player-link" onclick="openPlayerModal('${escapeJsStr(bestStreak.player)}')">${bestStreak.player}</span></div>
                <div class="trivia-sub">${bestStreak.count} Cups in a row</div>
            </div>
        </div>

        <div style="margin-top:20px;">
            <h4 style="margin:0 0 10px; color:#fff; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-award" style="color:#ffd700;"></i> Community Achievement Badges
            </h4>
            <div class="badges-grid">
                <div class="badge-card">
                    <div class="badge-icon"><i class="fas fa-crown"></i></div>
                    <div class="badge-info">
                        <div class="badge-title">Dominator</div>
                        <div class="badge-desc">Most Bonk Cup Victories</div>
                        <div class="badge-winner"><span class="player-link" onclick="openPlayerModal('${escapeJsStr(topWinner[0])}')">${topWinner[0]}</span> (${topWinner[1]} Wins)</div>
                    </div>
                </div>

                <div class="badge-card">
                    <div class="badge-icon"><i class="fas fa-hammer"></i></div>
                    <div class="badge-info">
                        <div class="badge-title">Master Builder</div>
                        <div class="badge-desc">Most Campaign Maps Created</div>
                        <div class="badge-winner"><span class="player-link" onclick="openPlayerModal('${escapeJsStr(topMapper[0])}')">${topMapper[0]}</span> (${topMapper[1]} Maps)</div>
                    </div>
                </div>

                <div class="badge-card">
                    <div class="badge-icon"><i class="fas fa-bolt"></i></div>
                    <div class="badge-info">
                        <div class="badge-title">Speed Demon</div>
                        <div class="badge-desc">Fastest Map Author Time</div>
                        <div class="badge-winner">${formatTime(shortestMap.time)} by <span class="player-link" onclick="openPlayerModal('${escapeJsStr(shortestMap.author)}')">${shortestMap.author}</span></div>
                    </div>
                </div>

                <div class="badge-card">
                    <div class="badge-icon"><i class="fas fa-flag-checkered"></i></div>
                    <div class="badge-info">
                        <div class="badge-title">Pioneer</div>
                        <div class="badge-desc">Winner of Bonk Cup #1</div>
                        <div class="badge-winner"><span class="player-link" onclick="openPlayerModal('${escapeJsStr(pioneerCup ? pioneerCup.winner : 'N/A')}')">${pioneerCup ? pioneerCup.winner : 'N/A'}</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.getElementById("trivia-content").innerHTML = html;
}

function renderWinsChart(data) {
    const wins = {};
    data.forEach(cup => {
        let w = cup.winner;
        if(w && w !== "Unknown" && w.trim() !== "") wins[w] = (wins[w] || 0) + 1;
    });
    const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 25);
    
    if (winsChartInstance) winsChartInstance.destroy();

    const ctx = document.getElementById('winsChart').getContext('2d');
    winsChartInstance = new Chart(ctx, {
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
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const playerName = sorted[index][0];
                    openPlayerModal(playerName);
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
                x: { grid: { display: false }, ticks: { color: '#ccc' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderMappersChart(data) {
    const mappers = {};
    data.forEach(cup => {
        if(cup.maps) cup.maps.forEach(map => {
            const author = map.author;
            if(author && !author.includes("-")) mappers[author] = (mappers[author] || 0) + 1;
        });
    });
    const sorted = Object.entries(mappers).sort((a, b) => b[1] - a[1]).slice(0, 15);

    if (mappersChartInstance) mappersChartInstance.destroy();

    const ctx = document.getElementById('mappersChart').getContext('2d');
    mappersChartInstance = new Chart(ctx, {
        type: 'bar', indexAxis: 'y',
        data: {
            labels: sorted.map(i => i[0]),
            datasets: [{
                label: 'Maps',
                data: sorted.map(i => i[1]),
                backgroundColor: 'rgba(255, 215, 0, 0.6)',
                borderColor: '#ffd700',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const playerName = sorted[index][0];
                    openPlayerModal(playerName);
                }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } },
                y: { grid: { display: false }, ticks: { color: '#ccc' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderList(cups) {
    const container = document.getElementById("cup-list");
    container.innerHTML = "";
    if (cups.length === 0) { 
        container.innerHTML = "<p style='text-align:center; padding:30px; color:#888; font-size:1.1rem;'>No matching campaigns found.</p>"; 
        return; 
    }

    cups.forEach((cup) => {
        const tab = document.createElement("div");
        tab.classList.add("accordion-tab");
        tab.id = `cup-${cup.edition}`; 

        let dateStr = "Unknown Date";
        if (cup.display_date) dateStr = cup.display_date; 
        else if (cup.publish_date) dateStr = new Date(cup.publish_date * 1000).toLocaleDateString();

        let totalMs = 0;
        if(cup.maps) cup.maps.forEach(m => totalMs += m.time_author);
        const minutes = Math.floor(totalMs / 60000);
        const seconds = ((totalMs % 60000) / 1000).toFixed(0);
        const timeFormatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

        let html = `
            <div class="accordion-header">
                <div class="cup-info">
                    <span class="edition-badge">#${cup.edition}</span>
                    <div>
                        <div class="cup-title">
                            ${formatTmName(cup.campaign_name)} 
                        </div>
                        <div class="cup-date">${dateStr} · ${timeFormatted}</div>
                    </div>
                </div>
                <div class="winner-badge player-link" onclick="event.stopPropagation(); openPlayerModal('${escapeJsStr(cup.winner || '')}')">
                    <i class="fas fa-trophy"></i> ${cup.winner || "Unknown"}
                </div>
            </div>
            <div class="accordion-content">
                <table>
                    <thead>
                        <tr>
                            <th width="40">#</th>
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
                
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>
                            <div class="map-cell">
                                <div class="map-cell-title">
                                    <div class="map-cell-icon"><i class="fas fa-flag-checkered"></i></div>
                                    <a href="https://trackmania.io/#/leaderboard/${map.uid}" target="_blank" style="color:#fff; text-decoration:underline; font-weight:500;">
                                        ${formatTmName(map.name)}
                                    </a>
                                </div>
                                <button class="copy-icon-btn" onclick="copyToClipboard('${map.uid}', this)" title="Copy UID">
                                    <i class="fas fa-copy"></i> UID
                                </button>
                            </div>
                        </td>
                        <td>
                            <span class="player-link" onclick="openPlayerModal('${escapeJsStr(map.author)}')">${map.author}</span>
                        </td>
                        <td style="font-family:monospace;">${timeSec}s</td>
                    </tr>
                `;
            });
        } else { 
            html += `<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">No maps loaded for this cup.</td></tr>`; 
        }

        html += `
                    </tbody>
                </table>
                <div class="action-buttons" style="margin-top:15px; display:flex; gap:10px; padding: 15px;">
                    <a href="${cup.tm_io_url}" target="_blank" class="tm-btn" style="flex:1;">
                        <i class="fas fa-external-link-alt"></i> Trackmania.io
                    </a>
                    <button class="tm-btn copy-btn" onclick="shareCup('${cup.edition}', this)" style="flex:1; background:rgba(0,150,255,0.2); border:1px solid rgba(0,150,255,0.5); color:#fff;">
                        <i class="fas fa-share-alt"></i> Share Cup
                    </button>
                </div>
            </div>
        `;
        tab.innerHTML = html;
        container.appendChild(tab);
        
        tab.querySelector(".accordion-header").addEventListener("click", () => {
            tab.classList.toggle("active");
        });
    });
}

// --- DEDICATED MAPS TAB RENDER WITH PAGINATION ---
function renderMapsTab() {
    const grid = document.getElementById("map-grid");
    const counter = document.getElementById("maps-counter");
    const searchInput = document.getElementById("map-search-input");
    const paginationContainer = document.getElementById("maps-pagination");
    if (!grid) return;

    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    let filtered = [...allFlatMaps];

    if (query) {
        filtered = filtered.filter(map => 
            (map.name || "").toLowerCase().includes(query) ||
            (map.author || "").toLowerCase().includes(query) ||
            String(map.edition).includes(query)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        if (currentMapSort === "edition-desc") return b.edition - a.edition;
        if (currentMapSort === "time-asc") return a.time_author - b.time_author;
        if (currentMapSort === "time-desc") return b.time_author - a.time_author;
        if (currentMapSort === "name-asc") return (a.name || "").localeCompare(b.name || "");
        if (currentMapSort === "author-asc") return (a.author || "").localeCompare(b.author || "");
        return b.edition - a.edition;
    });

    const totalCount = filtered.length;
    const totalPages = mapPageSize >= 999999 ? 1 : Math.ceil(totalCount / mapPageSize) || 1;
    
    if (currentMapPage > totalPages) currentMapPage = totalPages;
    if (currentMapPage < 1) currentMapPage = 1;

    const startIndex = (currentMapPage - 1) * mapPageSize;
    const endIndex = mapPageSize >= 999999 ? totalCount : Math.min(startIndex + mapPageSize, totalCount);

    if (counter) {
        if (totalCount === 0) {
            counter.textContent = "Showing 0 maps";
        } else if (mapPageSize >= 999999 || totalPages === 1) {
            counter.textContent = `Showing all ${totalCount} maps`;
        } else {
            counter.textContent = `Showing maps ${startIndex + 1}–${endIndex} of ${totalCount} maps`;
        }
    }

    if (totalCount === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px 20px; color:#888; font-size:1.1rem;"><i class="fas fa-search" style="font-size:2rem; margin-bottom:10px; display:block; opacity:0.5;"></i>No maps match your search criteria.</div>`;
        if (paginationContainer) paginationContainer.innerHTML = "";
        return;
    }

    const displayBatch = mapPageSize >= 999999 ? filtered : filtered.slice(startIndex, endIndex);

    let html = "";
    displayBatch.forEach(map => {
        const timeSec = (map.time_author / 1000).toFixed(2);
        
        html += `
            <div class="map-card">
                <div class="map-card-banner">
                    <div class="map-card-banner-bg"></div>
                    <div class="map-card-edition-tag">Cup #${map.edition}</div>
                    <div class="map-card-icon-badge"><i class="fas fa-flag-checkered"></i></div>
                </div>
                <div class="map-card-body">
                    <div class="map-card-title">${formatTmName(map.name)}</div>
                    <div class="map-card-meta">
                        <span>by <span class="map-card-author" onclick="openPlayerModal('${escapeJsStr(map.author)}')">${map.author}</span></span>
                        <span class="map-card-time"><i class="fas fa-stopwatch"></i> ${timeSec}s</span>
                    </div>
                    <div class="map-card-actions">
                        <a href="https://trackmania.io/#/leaderboard/${map.uid}" target="_blank" class="tm-btn" style="flex:1; padding:8px; font-size:0.8rem;">
                            <i class="fas fa-trophy"></i> Leaderboard
                        </a>
                        <button class="copy-icon-btn" onclick="copyToClipboard('${map.uid}', this)" title="Copy UID" style="padding:8px 12px;">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;

    renderMapsPagination(totalPages);
}

function renderMapsPagination(totalPages) {
    const container = document.getElementById("maps-pagination");
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    let html = "";

    // Prev Button
    html += `<button class="page-btn" ${currentMapPage === 1 ? 'disabled' : ''} onclick="goToMapPage(${currentMapPage - 1})"><i class="fas fa-chevron-left"></i> Prev</button>`;

    // Numeric Pages with smart windowing
    const pagesToShow = [];
    pagesToShow.push(1);

    if (currentMapPage > 3) pagesToShow.push("...");

    for (let p = Math.max(2, currentMapPage - 1); p <= Math.min(totalPages - 1, currentMapPage + 1); p++) {
        pagesToShow.push(p);
    }

    if (currentMapPage < totalPages - 2) pagesToShow.push("...");

    if (totalPages > 1 && !pagesToShow.includes(totalPages)) pagesToShow.push(totalPages);

    pagesToShow.forEach(item => {
        if (item === "...") {
            html += `<span class="page-ellipsis">...</span>`;
        } else {
            const isActive = item === currentMapPage ? "active" : "";
            html += `<button class="page-num-btn ${isActive}" onclick="goToMapPage(${item})">${item}</button>`;
        }
    });

    // Next Button
    html += `<button class="page-btn" ${currentMapPage === totalPages ? 'disabled' : ''} onclick="goToMapPage(${currentMapPage + 1})">Next <i class="fas fa-chevron-right"></i></button>`;

    container.innerHTML = html;
}

window.goToMapPage = function(pageNum) {
    currentMapPage = pageNum;
    renderMapsTab();
    const target = document.getElementById("maps-counter");
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

// --- PLAYER PROFILE MODAL LOGIC ---
window.openPlayerModal = function(playerName) {
    if (!playerName || playerName === "Unknown" || playerName === "N/A") return;
    
    const modal = document.getElementById("player-modal");
    const content = document.getElementById("modal-content");
    if (!modal || !content) return;

    // Calculate player stats
    const cupsWon = allCups.filter(c => c.winner === playerName);
    const mapsBuilt = allFlatMaps.filter(m => m.author === playerName);
    const totalCupsCount = allCups.length;
    const winRate = totalCupsCount > 0 ? ((cupsWon.length / totalCupsCount) * 100).toFixed(1) : 0;

    // Win Streak & Timeline
    let currentStreak = 0;
    let maxStreak = 0;
    const chronCups = [...allCups].sort((a,b) => a.edition - b.edition);
    chronCups.forEach(c => {
        if (c.winner === playerName) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
            currentStreak = 0;
        }
    });

    const editionsWon = cupsWon.map(c => c.edition).sort((a,b) => b - a);

    // Rivals (who finished 2nd or competing mappers)
    const rivals = {};
    cupsWon.forEach(c => {
        if (c.maps) {
            c.maps.forEach(m => {
                if (m.author && m.author !== playerName) {
                    rivals[m.author] = (rivals[m.author] || 0) + 1;
                }
            });
        }
    });
    const topRivals = Object.entries(rivals).sort((a,b) => b[1] - a[1]).slice(0, 5);

    let html = `
        <div class="player-modal-header">
            <div class="player-avatar">${playerName.substring(0, 2).toUpperCase()}</div>
            <div>
                <h2 class="player-name-title">${playerName}</h2>
                <div class="player-subtitle">Trackmania Competitor & Mapper</div>
            </div>
        </div>

        <div class="player-stats-grid">
            <div class="p-stat-box">
                <div class="p-stat-val">${cupsWon.length}</div>
                <div class="p-stat-lbl">Cups Won</div>
            </div>
            <div class="p-stat-box">
                <div class="p-stat-val">${mapsBuilt.length}</div>
                <div class="p-stat-lbl">Maps Authored</div>
            </div>
            <div class="p-stat-box">
                <div class="p-stat-val">${maxStreak}</div>
                <div class="p-stat-lbl">Max Win Streak</div>
            </div>
        </div>
    `;

    if (editionsWon.length > 0) {
        html += `
            <div class="player-section-title"><i class="fas fa-trophy" style="color:#ffd700;"></i> Bonk Cup Victories (${editionsWon.length})</div>
            <div class="player-history-tags">
                ${editionsWon.map(ed => `<span class="history-tag player-link" onclick="closePlayerModal(); scrollToCup(${ed});">#${ed}</span>`).join('')}
            </div>
        `;
    }

    if (mapsBuilt.length > 0) {
        const uniqueCupEditionsMapped = Array.from(new Set(mapsBuilt.map(m => m.edition))).sort((a,b) => b - a);
        html += `
            <div class="player-section-title"><i class="fas fa-map" style="color:var(--accent-color);"></i> Editions Mapped (${uniqueCupEditionsMapped.length})</div>
            <div class="player-history-tags">
                ${uniqueCupEditionsMapped.slice(0, 15).map(ed => `<span class="history-tag player-link" onclick="closePlayerModal(); scrollToCup(${ed});">#${ed}</span>`).join('')}
                ${uniqueCupEditionsMapped.length > 15 ? `<span class="history-tag">+${uniqueCupEditionsMapped.length - 15} more</span>` : ''}
            </div>
        `;
    }

    if (topRivals.length > 0) {
        html += `
            <div class="player-section-title"><i class="fas fa-handshake-alt" style="color:#00bfff;"></i> Top Featured Mappers in Victory Cups</div>
            <div class="player-history-tags">
                ${topRivals.map(([name, count]) => `<span class="history-tag player-link" onclick="openPlayerModal('${escapeJsStr(name)}')">${name} (${count} maps)</span>`).join('')}
            </div>
        `;
    }

    content.innerHTML = html;
    modal.classList.add("active");
};

window.closePlayerModal = function() {
    const modal = document.getElementById("player-modal");
    if (modal) modal.classList.remove("active");
};

window.closePlayerModalOnBackdrop = function(e) {
    if (e.target.id === "player-modal") closePlayerModal();
};

window.scrollToCup = function(edition) {
    openTab('campaigns-tab');
    const el = document.getElementById(`cup-${edition}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!el.classList.contains('active')) {
            el.querySelector('.accordion-header').click();
        }
        el.classList.add('highlight-flash');
    }
};

// --- ENHANCED TRACKMANIA FORMAT PARSER ---
function formatTmName(raw) {
    if (!raw) return "";
    
    let result = "";
    let i = 0;
    let currentColor = null;
    let isItalic = false;
    let isBold = false;
    let isShadow = false;
    let isUpper = false;
    let isWide = false;
    let isNarrow = false;
    
    let currentChunk = "";
    
    function flushChunk() {
        if (!currentChunk) return;
        let text = currentChunk;
        if (isUpper) text = text.toUpperCase();
        
        let styles = [];
        if (currentColor) styles.push(`color:#${currentColor}`);
        if (isItalic) styles.push(`font-style:italic`);
        if (isBold) styles.push(`font-weight:bold`);
        if (isShadow) styles.push(`text-shadow:1px 1px 2px rgba(0,0,0,0.8)`);
        if (isWide) styles.push(`letter-spacing:1px`);
        if (isNarrow) styles.push(`letter-spacing:-0.5px`);
        
        if (styles.length > 0) {
            result += `<span style="${styles.join(';')}">${escapeHtml(text)}</span>`;
        } else {
            result += escapeHtml(text);
        }
        currentChunk = "";
    }
    
    while (i < raw.length) {
        if (raw[i] === '$') {
            if (i + 1 < raw.length && raw[i + 1] === '$') {
                currentChunk += '$';
                i += 2;
                continue;
            }
            
            // Check for 3-digit hex color code ($00f to $FFF)
            if (i + 3 < raw.length && /^[0-9a-fA-F]{3}$/.test(raw.substring(i + 1, i + 4))) {
                flushChunk();
                currentColor = raw.substring(i + 1, i + 4);
                i += 4;
                continue;
            }
            
            // Single char formatting codes
            if (i + 1 < raw.length) {
                const code = raw[i + 1].toLowerCase();
                if (code === 'z') {
                    flushChunk();
                    currentColor = null; isItalic = false; isBold = false;
                    isShadow = false; isUpper = false; isWide = false; isNarrow = false;
                    i += 2; continue;
                } else if (code === 'i') {
                    flushChunk(); isItalic = true; i += 2; continue;
                } else if (code === 'w' || code === 'b') {
                    flushChunk(); isBold = true; i += 2; continue;
                } else if (code === 's') {
                    flushChunk(); isShadow = true; i += 2; continue;
                } else if (code === 't') {
                    flushChunk(); isUpper = true; i += 2; continue;
                } else if (code === 'o') {
                    flushChunk(); isWide = true; i += 2; continue;
                } else if (code === 'n') {
                    flushChunk(); isNarrow = true; i += 2; continue;
                } else if (code === 'g') {
                    flushChunk(); currentColor = null; i += 2; continue;
                } else if ('h l m p a f u'.includes(code)) {
                    i += 2; continue;
                }
            }
            
            i++;
        } else {
            currentChunk += raw[i];
            i++;
        }
    }
    flushChunk();
    return result;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJsStr(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

window.openTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    const target = document.getElementById(tabId);
    if (target) target.style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    
    if (tabId === 'maps-tab') {
        renderMapsTab();
    }
};

window.copyToClipboard = function(text, btn) { 
    navigator.clipboard.writeText(text).then(() => { 
        const o = btn.innerHTML; 
        btn.innerHTML = `<i class="fas fa-check"></i>`; 
        btn.style.borderColor = "#00d26a"; 
        setTimeout(() => { 
            btn.innerHTML = o; 
            btn.style.borderColor = "#444"; 
        }, 1500); 
    }); 
};

window.shareCup = function(edition, btn) { 
    const url = `${window.location.origin}${window.location.pathname}#cup-${edition}`; 
    navigator.clipboard.writeText(url).then(() => { 
        const o = btn.innerHTML; 
        btn.innerHTML = `<i class="fas fa-check"></i> Link Copied!`; 
        btn.style.borderColor = "#fff"; 
        setTimeout(() => { 
            btn.innerHTML = o; 
            btn.style.borderColor = "rgba(0,150,255,0.5)"; 
        }, 2000); 
    }); 
};

window.pickRandomCup = function() { 
    openTab('campaigns-tab'); 
    if(allCups.length===0) return; 
    const c = allCups[Math.floor(Math.random() * allCups.length)]; 
    scrollToCup(c.edition);
};

window.checkDeepLink = function() { 
    const h = window.location.hash; 
    if(h && h.startsWith("#cup-")) { 
        const id = h.replace("#cup-",""); 
        scrollToCup(id);
    }
};

// --- BACK TO TOP LOGIC ---
const backToTopBtn = document.getElementById("back-to-top");
if (backToTopBtn) {
    window.addEventListener("scroll", () => {
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            backToTopBtn.classList.add("show");
        } else {
            backToTopBtn.classList.remove("show");
        }
    });
    backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// =============================================================================
// XPEVO EVENT ANNOUNCEMENT SYSTEM
// =============================================================================
(function initEventAnnouncement() {
    // Event date: September 12th, 2026 (end of day — hide after this)
    const EVENT_DATE = new Date('2026-09-12T23:59:59');
    const now = new Date();

    // If the event has passed, hide everything and bail out
    if (now > EVENT_DATE) {
        const banner = document.getElementById('event-banner');
        const modal = document.getElementById('event-modal');
        if (banner) banner.style.display = 'none';
        if (modal) modal.style.display = 'none';
        return;
    }

    // --- BANNER LOGIC ---
    const banner = document.getElementById('event-banner');
    const bannerDismissed = sessionStorage.getItem('xpevo-banner-dismissed');

    if (banner) {
        if (bannerDismissed) {
            banner.classList.add('hidden');
        } else {
            document.body.classList.add('has-event-banner');
        }
    }

    // --- FIRST-VISIT MODAL LOGIC ---
    const modalSeen = localStorage.getItem('xpevo-modal-seen');
    if (!modalSeen) {
        setTimeout(() => {
            openEventModal();
        }, 800);
    }

    // --- COUNTDOWN TIMER ---
    const countdownTarget = EVENT_DATE.getTime();
    let countdownInterval = null;

    function updateCountdown() {
        const now = new Date().getTime();
        const diff = countdownTarget - now;

        const cdDays = document.getElementById('cd-days');
        const cdHours = document.getElementById('cd-hours');
        const cdMins = document.getElementById('cd-mins');
        const cdSecs = document.getElementById('cd-secs');

        if (diff <= 0) {
            // Event is live or passed
            const countdownGrid = document.getElementById('event-countdown');
            if (countdownGrid) {
                countdownGrid.innerHTML = '<div class="countdown-live">🎉 Event is LIVE! 🎉</div>';
            }
            if (countdownInterval) clearInterval(countdownInterval);
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        if (cdDays) cdDays.textContent = String(days).padStart(2, '0');
        if (cdHours) cdHours.textContent = String(hours).padStart(2, '0');
        if (cdMins) cdMins.textContent = String(mins).padStart(2, '0');
        if (cdSecs) cdSecs.textContent = String(secs).padStart(2, '0');
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
})();

// --- EVENT MODAL CONTROLS ---
window.openEventModal = function() {
    const modal = document.getElementById('event-modal');
    if (modal) modal.classList.add('active');
};

window.closeEventModal = function() {
    const modal = document.getElementById('event-modal');
    if (modal) modal.classList.remove('active');
    localStorage.setItem('xpevo-modal-seen', 'true');
};

window.closeEventModalOnBackdrop = function(e) {
    if (e.target.id === 'event-modal') closeEventModal();
};

window.dismissEventBanner = function() {
    const banner = document.getElementById('event-banner');
    if (banner) {
        banner.classList.add('hidden');
        document.body.classList.remove('has-event-banner');
        sessionStorage.setItem('xpevo-banner-dismissed', 'true');
    }
};

// Also close event modal on ESC (extend existing listener)
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const eventModal = document.getElementById('event-modal');
        if (eventModal && eventModal.classList.contains('active')) {
            closeEventModal();
        }
    }
});