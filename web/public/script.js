// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const sidebarLinks = document.querySelectorAll('.sidebar li');
const contentSections = document.querySelectorAll('.content-section');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const modal = document.getElementById('detail-modal');
const closeModal = document.querySelector('.close-modal');
const sidebarToggle = document.getElementById('sidebar-toggle');
const loginButton = document.getElementById('login-button');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const usernameSpan = document.getElementById('username');

// Chart instances
let commandsChart, categoriesChart, economyChart;

// Global data stores
let commandsData = [];
let economyData = [];
let gameData = {};
let botInfo = {};

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Load theme preference
    loadThemePreference();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load all data
    loadAllData();
    
    // Initialize charts with empty data
    initCharts();
    
    // Check for existing login
    checkLoginStatus();
});

function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeToggle.checked = true;
    }
}

function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('change', toggleTheme);
    
    // Sidebar navigation
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            const sectionId = link.getAttribute('data-section');
            showSection(sectionId);
        });
    });
    
    // Tab navigation
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            showTab(tabId);
        });
    });
    
    // Modal close
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Export commands button
    document.getElementById('export-commands').addEventListener('click', exportCommandsToCSV);
    
    // Sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Login button
    loginButton.addEventListener('click', loginWithDiscord);
    
    // Search listeners
    document.getElementById('command-search').addEventListener('input', searchCommands);
    document.getElementById('monster-search').addEventListener('input', searchMonsters);
    document.getElementById('raid-search').addEventListener('input', searchRaidBosses);
    document.getElementById('item-search').addEventListener('input', searchItems);
    document.getElementById('place-search').addEventListener('input', searchPlaces);
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const theme = themeToggle.checked ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    
    // Update charts with new theme colors
    updateChartThemes();
}

function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
}

function showSection(sectionId) {
    // Update active state in sidebar
    sidebarLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-section') === sectionId);
    });
    
    // Show the selected section
    contentSections.forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });
    
    // Load section data if needed
    if (sectionId === 'commands' && commandsData.length === 0) {
        loadCommandsData();
    } else if (sectionId === 'economy' && economyData.length === 0) {
        loadEconomyData();
    } else if (sectionId === 'game-data' && Object.keys(gameData).length === 0) {
        loadGameData();
    } else if (sectionId === 'bot-info' && Object.keys(botInfo).length === 0) {
        loadBotInfo();
    }
}

function showTab(tabId) {
    // Update active tab button
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-tab') === tabId);
    });
    
    // Show the selected tab content
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
    
    // Load tab data if needed
    if (tabId === 'monsters' && !gameData.monstersLoaded) {
        renderMonsters();
    } else if (tabId === 'raid-bosses' && !gameData.raidBossesLoaded) {
        renderRaidBosses();
    } else if (tabId === 'items' && !gameData.itemsLoaded) {
        renderItems();
    } else if (tabId === 'places' && !gameData.placesLoaded) {
        renderPlaces();
    }
}

function loadAllData() {
    loadOverviewData();
    loadCommandsData();
    loadEconomyData();
    loadGameData();
    loadBotInfo();
}

// Data loading functions
async function loadOverviewData() {
    try {
        const response = await fetch('/api/botinfo');
        botInfo = await response.json();
        updateOverviewUI();
    } catch (err) {
        console.error('Error loading overview data:', err);
    }
}

async function loadCommandsData() {
    try {
        const response = await fetch('/api/commands');
        const data = await response.json();
        commandsData = data.commands;
        renderCommandsTable();
        updateCommandsChart();
        updateCategoriesChart();
    } catch (err) {
        console.error('Error loading commands data:', err);
    }
}

async function loadEconomyData() {
    try {
        const response = await fetch('/api/leaderboard?type=balance&limit=10');
        economyData = await response.json();
        renderEconomyTable();
        updateEconomyChart();
    } catch (err) {
        console.error('Error loading economy data:', err);
    }
}

async function loadGameData() {
    try {
        const response = await fetch('/api/game-data');
        gameData = await response.json();
        gameData.monstersLoaded = false;
        gameData.raidBossesLoaded = false;
        gameData.itemsLoaded = false;
        gameData.placesLoaded = false;
        
        // Render the currently active tab
        const activeTab = document.querySelector('.tab-button.active')?.getAttribute('data-tab') || 'monsters';
        if (activeTab === 'monsters') renderMonsters();
        else if (activeTab === 'raid-bosses') renderRaidBosses();
        else if (activeTab === 'items') renderItems();
        else if (activeTab === 'places') renderPlaces();
    } catch (err) {
        console.error('Error loading game data:', err);
    }
}

async function loadBotInfo() {
    try {
        const response = await fetch('/api/botinfo');
        botInfo = await response.json();
        updateBotInfoUI();
    } catch (err) {
        console.error('Error loading bot info:', err);
    }
}

// UI Update functions
function updateOverviewUI() {
    document.getElementById('guild-count').textContent = botInfo.guildCount;
    document.getElementById('user-count').textContent = botInfo.userCount;
    document.getElementById('command-count').textContent = botInfo.commandCount;
    document.getElementById('uptime').textContent = formatUptime(botInfo.uptime);
}

function updateBotInfoUI() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('bot-status-text');
    
    if (botInfo.online) {
        statusIndicator.style.backgroundColor = '#00ff00';
        statusText.textContent = 'Online';
    } else {
        statusIndicator.style.backgroundColor = '#ff0000';
        statusText.textContent = 'Offline';
    }
    
    document.getElementById('ram-usage').textContent = `${Math.round(botInfo.ramUsage)} MB`;
    document.getElementById('bot-uptime').textContent = formatUptime(botInfo.uptime);
    document.getElementById('info-guild-count').textContent = botInfo.guildCount;
    document.getElementById('info-user-count').textContent = botInfo.userCount;
    document.getElementById('info-command-count').textContent = botInfo.commandCount;
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    seconds %= 3600 * 24;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Chart functions
function initCharts() {
    // Command Usage Chart (Bar)
    const commandsCtx = document.getElementById('commands-chart').getContext('2d');
    commandsChart = new Chart(commandsCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Usage Count',
                data: [],
                backgroundColor: '#00f5d4',
                borderWidth: 1
            }]
        },
        options: getChartOptions('Top Commands', true)
    });
    
    // Categories Chart (Doughnut)
    const categoriesCtx = document.getElementById('categories-chart').getContext('2d');
    categoriesChart = new Chart(categoriesCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#00f5d4', '#9d4edd', '#ff6d00', '#ff0054', '#7209b7', 
                    '#3a86ff', '#8338ec', '#ff006e', '#fb5607', '#ffbe0b'
                ],
                borderWidth: 1
            }]
        },
        options: getChartOptions('Command Categories')
    });
    
    // Economy Chart (Bar)
    const economyCtx = document.getElementById('economy-chart').getContext('2d');
    economyChart = new Chart(economyCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Balance',
                data: [],
                backgroundColor: '#00f5d4',
                borderWidth: 1
            }]
        },
        options: getChartOptions('Top 10 Richest Players', true)
    });
}

function updateChartThemes() {
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333' : '#fff';
    const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    
    // Update all charts
    [commandsChart, categoriesChart, economyChart].forEach(chart => {
        if (chart) {
            if (chart.options.scales) {
                chart.options.scales = getChartOptions('', chart.config.type !== 'doughnut').scales;
            }
            chart.options.plugins.legend.labels.color = textColor;
            chart.options.plugins.title.color = textColor;
            chart.update();
        }
    });
}

function getChartOptions(title, includeAxes = false) {
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333' : '#fff';
    const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: textColor,
                    font: {
                        family: 'Poppins'
                    }
                }
            },
            title: {
                display: !!title,
                text: title,
                color: textColor,
                font: {
                    family: 'Poppins',
                    size: 16
                },
                animation: {
                    animateScale: true,
                    duration: 1000
                }
            }
        },
        animation: {
            duration: 1000,
            easing: 'easeOutQuart'
        }
    };
    
    if (includeAxes) {
        options.scales = {
            x: {
                ticks: {
                    color: textColor
                },
                grid: {
                    color: gridColor
                }
            },
            y: {
                ticks: {
                    color: textColor
                },
                grid: {
                    color: gridColor
                },
                beginAtZero: true
            }
        };
    }
    
    return options;
}

function updateCommandsChart() {
    // Get top 5 most used commands
    const topCommands = [...commandsData]
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5);
    
    commandsChart.data.labels = topCommands.map(cmd => `/${cmd.name}`);
    commandsChart.data.datasets[0].data = topCommands.map(cmd => cmd.usageCount);
    commandsChart.update();
}

function updateCategoriesChart() {
    // Group by category
    const categories = {};
    commandsData.forEach(cmd => {
        categories[cmd.category] = (categories[cmd.category] || 0) + 1;
    });
    
    categoriesChart.data.labels = Object.keys(categories);
    categoriesChart.data.datasets[0].data = Object.values(categories);
    categoriesChart.update();
}

function updateEconomyChart() {
    // Take top 10
    economyChart.data.labels = economyData.map(user => user.username);
    economyChart.data.datasets[0].data = economyData.map(user => user.value);
    economyChart.update();
}

// Table rendering functions
function renderCommandsTable() {
    const tableBody = document.querySelector('#commands-table tbody');
    tableBody.innerHTML = '';
    
    commandsData.forEach(cmd => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>/${cmd.name}</td>
            <td>${cmd.description}</td>
            <td>${cmd.category}</td>
            <td>${cmd.usageCount}</td>
            <td>${formatPermissions(cmd.permissions)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderEconomyTable() {
    const tableBody = document.querySelector('#economy-table tbody');
    tableBody.innerHTML = '';
    
    economyData.forEach((user, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.username}</td>
            <td>${user.value.toLocaleString()}</td>
        `;
        tableBody.appendChild(row);
    });
}

function formatPermissions(permissions) {
    if (!permissions) return 'Everyone';
    // This is a simplified version - you could expand this to show actual permission names
    return 'Moderator+';
}

// Game data rendering functions
function renderMonsters() {
    const grid = document.getElementById('monsters-grid');
    grid.innerHTML = '';
    
    gameData.regularMonsters.forEach(monster => {
        const card = createGameDataCard(monster, 'monster');
        grid.appendChild(card);
    });
    
    gameData.monstersLoaded = true;
}

function renderRaidBosses() {
    const grid = document.getElementById('raid-bosses-grid');
    grid.innerHTML = '';
    
    gameData.raidBosses.forEach(boss => {
        const card = createGameDataCard(boss, 'raid-boss');
        grid.appendChild(card);
    });
    
    gameData.raidBossesLoaded = true;
}

function renderItems() {
    const grid = document.getElementById('items-grid');
    grid.innerHTML = '';
    
    gameData.items.forEach(item => {
        const card = createGameDataCard(item, 'item');
        grid.appendChild(card);
    });
    
    gameData.itemsLoaded = true;
}

function renderPlaces() {
    const grid = document.getElementById('places-grid');
    grid.innerHTML = '';
    
    gameData.places.forEach(place => {
        const card = createGameDataCard(place, 'place');
        grid.appendChild(card);
    });
    
    gameData.placesLoaded = true;
}

function createGameDataCard(data, type) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.setAttribute('data-id', data.id);
    card.setAttribute('data-type', type);
    
    let content = '';
    if (type === 'raid-boss') {
        content = `
            <div class="game-card-image" style="background-image: url('${data.image || 'https://via.placeholder.com/150'}')"></div>
            <div class="game-card-content">
                <h3>${data.name}</h3>
                <p>Level: ${data.level}</p>
                <p>HP: ${data.hp.toLocaleString()}</p>
            </div>
        `;
    } else {
        content = `
            <div class="game-card-content">
                <h3>${data.name}</h3>
                ${data.level ? `<p>Level: ${data.level}</p>` : ''}
                ${data.type ? `<p>Type: ${data.type}</p>` : ''}
                ${data.rarity ? `<p>Rarity: ${data.rarity}</p>` : ''}
            </div>
        `;
    }
    
    card.innerHTML = content;
    card.addEventListener('click', () => showDetailModal(data, type));
    return card;
}

function showDetailModal(data, type) {
    const modalBody = document.getElementById('modal-body');
    let content = '';
    
    if (type === 'raid-boss') {
        content = `
            <div class="modal-header">
                <h2>${data.name}</h2>
                <img src="${data.image || 'https://via.placeholder.com/300'}" alt="${data.name}">
            </div>
            <div class="modal-stats">
                <div class="stat-row">
                    <span>Level:</span>
                    <span>${data.level}</span>
                </div>
                <div class="stat-row">
                    <span>HP:</span>
                    <span>${data.hp.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span>Attack:</span>
                    <span>${data.attack}</span>
                </div>
            </div>
            <div class="modal-description">
                <h3>Description</h3>
                <p>A fearsome raid boss that requires a team to defeat.</p>
            </div>
        `;
    } else if (type === 'monster') {
        content = `
            <div class="modal-header">
                <h2>${data.name}</h2>
            </div>
            <div class="modal-stats">
                <div class="stat-row">
                    <span>Level:</span>
                    <span>${data.level}</span>
                </div>
            </div>
        `;
    } else if (type === 'item') {
        content = `
            <div class="modal-header">
                <h2>${data.name}</h2>
                <span class="rarity ${data.rarity}">${data.rarity}</span>
            </div>
            <div class="modal-stats">
                <div class="stat-row">
                    <span>Type:</span>
                    <span>${data.type}</span>
                </div>
            </div>
            <div class="modal-description">
                <h3>Description</h3>
                <p>${data.description || 'No description available.'}</p>
            </div>
        `;
    } else if (type === 'place') {
        content = `
            <div class="modal-header">
                <h2>${data.name}</h2>
                <span class="type">${data.type}</span>
            </div>
            <div class="modal-stats">
                <div class="stat-row">
                    <span>Level Range:</span>
                    <span>${data.levelRange[0]} - ${data.levelRange[1]}</span>
                </div>
            </div>
            <div class="modal-description">
                <h3>Description</h3>
                <p>${data.description || 'No description available.'}</p>
            </div>
        `;
    }
    
    modalBody.innerHTML = content;
    modal.style.display = 'block';
}

// Search functions
function searchCommands() {
    const searchTerm = this.value.toLowerCase();
    const filteredCommands = commandsData.filter(cmd => 
        cmd.name.toLowerCase().includes(searchTerm) || 
        cmd.description.toLowerCase().includes(searchTerm) ||
        cmd.category.toLowerCase().includes(searchTerm)
    );
    renderFilteredCommandsTable(filteredCommands);
}

function renderFilteredCommandsTable(commands) {
    const tableBody = document.querySelector('#commands-table tbody');
    tableBody.innerHTML = '';
    
    commands.forEach(cmd => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>/${cmd.name}</td>
            <td>${cmd.description}</td>
            <td>${cmd.category}</td>
            <td>${cmd.usageCount}</td>
            <td>${formatPermissions(cmd.permissions)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function searchMonsters() {
    const searchTerm = this.value.toLowerCase();
    if (!gameData.regularMonsters) return;
    
    const filteredMonsters = gameData.regularMonsters.filter(monster => 
        monster.name.toLowerCase().includes(searchTerm)
    );
    renderFilteredMonsters(filteredMonsters);
}

function renderFilteredMonsters(monsters) {
    const grid = document.getElementById('monsters-grid');
    grid.innerHTML = '';
    
    monsters.forEach(monster => {
        const card = createGameDataCard(monster, 'monster');
        grid.appendChild(card);
    });
}

function searchRaidBosses() {
    const searchTerm = this.value.toLowerCase();
    if (!gameData.raidBosses) return;
    
    const filteredBosses = gameData.raidBosses.filter(boss => 
        boss.name.toLowerCase().includes(searchTerm)
    );
    renderFilteredRaidBosses(filteredBosses);
}

function renderFilteredRaidBosses(bosses) {
    const grid = document.getElementById('raid-bosses-grid');
    grid.innerHTML = '';
    
    bosses.forEach(boss => {
        const card = createGameDataCard(boss, 'raid-boss');
        grid.appendChild(card);
    });
}

function searchItems() {
    const searchTerm = this.value.toLowerCase();
    if (!gameData.items) return;
    
    const filteredItems = gameData.items.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
    );
    renderFilteredItems(filteredItems);
}

function renderFilteredItems(items) {
    const grid = document.getElementById('items-grid');
    grid.innerHTML = '';
    
    items.forEach(item => {
        const card = createGameDataCard(item, 'item');
        grid.appendChild(card);
    });
}

function searchPlaces() {
    const searchTerm = this.value.toLowerCase();
    if (!gameData.places) return;
    
    const filteredPlaces = gameData.places.filter(place => 
        place.name.toLowerCase().includes(searchTerm)
    );
    renderFilteredPlaces(filteredPlaces);
}

function renderFilteredPlaces(places) {
    const grid = document.getElementById('places-grid');
    grid.innerHTML = '';
    
    places.forEach(place => {
        const card = createGameDataCard(place, 'place');
        grid.appendChild(card);
    });
}

// Utility functions
function exportCommandsToCSV() {
    let csv = 'Command,Description,Category,Usage Count,Permissions\n';
    
    commandsData.forEach(cmd => {
        csv += `"${cmd.name}","${cmd.description}","${cmd.category}",${cmd.usageCount},"${formatPermissions(cmd.permissions)}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bot-commands.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Discord login functions
function loginWithDiscord() {
    // In a real application, you would redirect to Discord's OAuth2 endpoint
    // For demo purposes, we'll simulate a login
    
    // Simulate API call
    setTimeout(() => {
        // Mock user data
        const user = {
            id: '123456789',
            username: 'DiscordUser',
            avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
        };
        
        // Save to localStorage
        localStorage.setItem('discordUser', JSON.stringify(user));
        
        // Update UI
        updateUserProfile(user);
    }, 1000);
}

function checkLoginStatus() {
    const userData = localStorage.getItem('discordUser');
    if (userData) {
        const user = JSON.parse(userData);
        updateUserProfile(user);
    }
}

function updateUserProfile(user) {
    userAvatar.src = user.avatar;
    usernameSpan.textContent = user.username;
    loginButton.style.display = 'none';
    userProfile.style.display = 'flex';
}