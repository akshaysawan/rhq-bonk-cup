let allCups = [];
let winsChartInstance = null;
let mappersChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("cup-list");
    const searchInput = document.getElementById("search-input");
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
    // ------------------------------------------

    fetch('bonk_cup_data.json')
        .then(res => res.json())
        .then(data => {
            allCups = data;
            
            // Initial Renders
            renderStats(allCups);
            renderList(allCups);
            populateYearFilter(allCups);
            
            // Render Default (All Time)
            updateStatsView(allCups);

            setTimeout(checkDeepLink, 500);
        })
        .catch(err => console.error(err));

    // Search Listener
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) { renderList(allCups); return; }
        const filtered = allCups.filter(cup => {
            const inName = cup.campaign_name.toLowerCase().includes(query);
            const inWinner = (cup.winner || "").toLowerCase().includes(query);
            const inEdition = String(cup.edition).includes(query);
            let inMaps = false;
            if (cup.maps) inMaps = cup.maps.some(map => map.name.toLowerCase().includes(query) || map.author.toLowerCase().includes(query));
            return inName || inWinner || inEdition || inMaps;
        });
        renderList(filtered);
    });

    // Year Filter Listener
    yearFilter.addEventListener("change", (e) => {
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
});

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
    sortedYears.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });
}

// --- Master Update Function for Stats Tab ---
function updateStatsView(data) {
    renderWinsChart(data);
    renderMappersChart(data);
    renderTrivia(data); 
}

// --- UPDATED: renderStats now targets the Header Elements ---
function renderStats(data) {
    const totalCups = data.length;
    const uniqueWinners = new Set(data.map(c => c.winner).filter(w => w && w !== "Unknown"));
    
    // Update text directly in the sticky header
    const totalEl = document.getElementById("stat-total-cups");
    const winnersEl = document.getElementById("stat-unique-winners");
    
    if (totalEl) totalEl.textContent = totalCups;
    if (winnersEl) winnersEl.textContent = uniqueWinners.size;
}

function renderTrivia(data) {
    let longestMap = { time: 0, name: "N/A", author: "-" };
    let shortestMap = { time: 99999999, name: "N/A", author: "-" };
    
    data.forEach(cup => {
        if(cup.maps) {
            cup.maps.forEach(m => {
                if(m.time_author > longestMap.time) {
                    longestMap = { time: m.time_author, name: m.name, author: m.author };
                }
                if(m.time_author > 1000 && m.time_author < shortestMap.time) {
                    shortestMap = { time: m.time_author, name: m.name, author: m.author };
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
                <div class="trivia-sub">${formatTime(longestMap.time)} by ${longestMap.author}</div>
            </div>
        </div>
        <div class="trivia-item">
            <div class="trivia-icon"><i class="fas fa-stopwatch"></i></div>
            <div class="trivia-content">
                <div class="trivia-label">Shortest Map</div>
                <div class="trivia-value">${formatTmName(shortestMap.name)}</div>
                <div class="trivia-sub">${formatTime(shortestMap.time)} by ${shortestMap.author}</div>
            </div>
        </div>
        <div class="trivia-item">
            <div class="trivia-icon"><i class="fas fa-fire"></i></div>
            <div class="trivia-content">
                <div class="trivia-label">Highest Win Streak</div>
                <div class="trivia-value">${bestStreak.player}</div>
                <div class="trivia-sub">${bestStreak.count} Cups in a row</div>
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
    if (cups.length === 0) { container.innerHTML = "<p style='text-align:center; padding:20px; color:#666;'>No results found.</p>"; return; }

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

        let html = `
            <div class="accordion-header">
                <div class="cup-info">
                    <span class="edition-badge">#${cup.edition}</span>
                    <div>
                        <div class="cup-title">
                            ${formatTmName(cup.campaign_name)} 
                        </div>
                        <div class="cup-date">${dateStr}</div>
                    </div>
                </div>
                <div class="winner-badge"><i class="fas fa-trophy"></i> ${cup.winner || "Unknown"}</div>
            </div>
            <div class="accordion-content">
                <table><thead><tr><th width="50">#</th><th>Map Name</th><th>Author</th><th>Author Time</th></tr></thead><tbody>
        `;

        if (cup.maps && cup.maps.length > 0) {
            cup.maps.forEach((map, index) => {
                const timeSec = (map.time_author / 1000).toFixed(3);
                html += `<tr><td>${index + 1}</td><td><div class="map-cell"><a href="https://trackmania.io/#/leaderboard/${map.uid}" target="_blank" style="color:#fff; text-decoration:underline; font-weight:500;">${formatTmName(map.name)}</a><button class="copy-icon-btn" onclick="copyToClipboard('${map.uid}', this)" title="Copy UID"><i class="fas fa-copy"></i> UID</button></div></td><td>${map.author}</td><td>${timeSec}s</td></tr>`;
            });
        } else { html += `<tr><td colspan="4" style="text-align:center; padding:15px;">No maps loaded.</td></tr>`; }

        html += `</tbody></table><div class="action-buttons" style="margin-top:15px; display:flex; gap:10px; padding: 15px;"><a href="${cup.tm_io_url}" target="_blank" class="tm-btn" style="flex:1;"><i class="fas fa-external-link-alt"></i> Trackmania.io</a><button class="tm-btn copy-btn" onclick="shareCup('${cup.edition}', this)" style="flex:1; background:rgba(0,150,255,0.2); border:1px solid rgba(0,150,255,0.5); color:#fff;"><i class="fas fa-share-alt"></i> Share Cup</button></div></div>`;
        tab.innerHTML = html;
        container.appendChild(tab);
        tab.querySelector(".accordion-header").addEventListener("click", () => tab.classList.toggle("active"));
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
            html += `<span style="color:#${colorCode}">${part.substring(3)}</span>`;
        } else if (/^[zZgG]/.test(part)) html += `<span style="color:inherit">${part.substring(1)}</span>`;
        else if (/^[iIwWnNsSoO]/.test(part)) html += part.substring(1);
        else html += "$" + part;
    }
    return html;
}

window.openTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
};
window.copyToClipboard = function(text, btn) { navigator.clipboard.writeText(text).then(() => { const o = btn.innerHTML; btn.innerHTML = `<i class="fas fa-check"></i>`; btn.style.borderColor = "#00d26a"; setTimeout(() => { btn.innerHTML = o; btn.style.borderColor = "#444"; }, 1500); }); };
window.shareCup = function(edition, btn) { const url = `${window.location.origin}${window.location.pathname}#cup-${edition}`; navigator.clipboard.writeText(url).then(() => { const o = btn.innerHTML; btn.innerHTML = `<i class="fas fa-check"></i> Link Copied!`; btn.style.borderColor = "#fff"; setTimeout(() => { btn.innerHTML = o; btn.style.borderColor = "rgba(0,150,255,0.5)"; }, 2000); }); };
window.pickRandomCup = function() { openTab('campaigns-tab'); if(allCups.length===0)return; const c=allCups[Math.floor(Math.random()*allCups.length)]; const el=document.getElementById(`cup-${c.edition}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.querySelector('.accordion-header').click(); el.classList.add('highlight-flash'); }};
window.checkDeepLink = function() { const h=window.location.hash; if(h&&h.startsWith("#cup-")) { const id=h.replace("#cup-",""); openTab('campaigns-tab'); const el=document.getElementById(`cup-${id}`); if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.querySelector('.accordion-header').click(); el.classList.add('highlight-flash'); }}};

// --- BACK TO TOP LOGIC ---
const backToTopBtn = document.getElementById("back-to-top");
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