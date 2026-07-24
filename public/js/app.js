// Vault App - Main JavaScript
let currentScreen = 'home';
let allItems = [];
let allContainers = [];
let currentItem = null;
let isRegisterMode = false;

// Onboarding
function closeOnboarding() {
    const onboarding = document.getElementById('onboarding');
    onboarding.classList.add('closing');
    setTimeout(() => {
        onboarding.style.display = 'none';
        localStorage.setItem('vault_onboarded', '1');
        showAuthScreen();
    }, 350);
}

function initOnboarding() {
    if (localStorage.getItem('vault_onboarded')) {
        document.getElementById('onboarding').style.display = 'none';
        return false;
    }
    return true;
}

// Auth
function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'block';
    document.getElementById('app-frame').style.display = 'none';
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-name-group').style.display = isRegisterMode ? 'block' : 'none';
    document.getElementById('auth-toggle').textContent = isRegisterMode ? 'Войти' : 'Создать аккаунт';
    document.querySelector('.header h1').textContent = isRegisterMode ? 'Регистрация' : 'Добро пожаловать';
}

async function handleAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';

    if (!email || !password) {
        errorEl.textContent = 'Заполните все поля';
        errorEl.style.display = 'block';
        return;
    }

    try {
        if (isRegisterMode) {
            const name = document.getElementById('auth-name').value.trim();
            await api.register(email, password, name);
        } else {
            await api.login(email, password);
        }
        showApp();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
}

function logout() {
    api.clearToken();
    showAuthScreen();
}

// App
function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-frame').style.display = 'block';
    loadHome();
}

function showScreen(screenId) {
    currentScreen = screenId;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItems = document.querySelectorAll('.nav-item');
    const screenMap = { home: 0, search: 1, storage: 2, profile: 3 };
    if (screenMap[screenId] !== undefined) {
        navItems[screenMap[screenId]].classList.add('active');
    }

    // Load data
    if (screenId === 'home') loadHome();
    if (screenId === 'search') loadSearch();
    if (screenId === 'storage') loadStorage();
    if (screenId === 'profile') loadProfile();
}

// Home
async function loadHome() {
    try {
        const [items, containers] = await Promise.all([
            api.getItems(),
            api.getContainers()
        ]);
        allItems = items;
        allContainers = containers;

        document.getElementById('stat-items').textContent = items.length;
        document.getElementById('stat-containers').textContent = containers.length;

        const emptyEl = document.getElementById('home-empty');
        const withItemsEl = document.getElementById('home-with-items');

        if (items.length === 0) {
            emptyEl.style.display = 'block';
            withItemsEl.style.display = 'none';
        } else {
            emptyEl.style.display = 'none';
            withItemsEl.style.display = 'block';
            renderRecentItems(items.slice(0, 6));
        }

        // Update profile
        document.getElementById('profile-stats').textContent = `${items.length} вещей, ${containers.length} мест`;
        document.getElementById('profile-progress').style.width = `${Math.min(items.length * 4, 100)}%`;
    } catch (err) {
        console.error('Load home error:', err);
    }
}

function renderRecentItems(items) {
    const grid = document.getElementById('recent-items');
    const colors = [
        'linear-gradient(135deg, #74B9FF, #0984E3)',
        'linear-gradient(135deg, #00B894, #00CEC9)',
        'linear-gradient(135deg, #FDCB6E, #E17055)',
        'linear-gradient(135deg, #FD79A8, #E84393)',
        'linear-gradient(135deg, #A29BFE, #6C5CE7)',
        'linear-gradient(135deg, #FF7675, #D63031)'
    ];
    const icons = ['👕', '👟', '🔧', '📚', '📄', '🎒'];

    grid.innerHTML = items.map((item, i) => `
        <div class="item-card" onclick="showItemDetail(${item.id})">
            <div class="item-image" style="background: ${colors[i % colors.length]};">
                ${item.images && item.images.length
                    ? `<img src="${item.images[0]}" style="width:100%;height:100%;object-fit:cover;" alt="">`
                    : icons[i % icons.length]
                }
            </div>
            <div class="item-info">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-location">📍 ${escapeHtml(item.container_name || 'Не указано')}</div>
            </div>
        </div>
    `).join('');
}

// Search
async function loadSearch() {
    try {
        const items = await api.getItems();
        allItems = items;
        renderSearchItems(items);
    } catch (err) {
        console.error('Load search error:', err);
    }
}

function renderSearchItems(items) {
    const grid = document.getElementById('search-items');
    const emptyEl = document.getElementById('search-empty');

    if (items.length === 0) {
        grid.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }

    emptyEl.style.display = 'none';
    const colors = [
        'linear-gradient(135deg, #74B9FF, #0984E3)',
        'linear-gradient(135deg, #00B894, #00CEC9)',
        'linear-gradient(135deg, #FDCB6E, #E17055)',
        'linear-gradient(135deg, #FD79A8, #E84393)',
        'linear-gradient(135deg, #A29BFE, #6C5CE7)'
    ];

    grid.innerHTML = items.map((item, i) => `
        <div class="item-card" onclick="showItemDetail(${item.id})">
            <div class="item-image" style="background: ${colors[i % colors.length]};">
                ${item.images && item.images.length
                    ? `<img src="${item.images[0]}" style="width:100%;height:100%;object-fit:cover;" alt="">`
                    : '📦'
                }
            </div>
            <div class="item-info">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-location">📍 ${escapeHtml(item.container_name || 'Не указано')}</div>
            </div>
        </div>
    `).join('');
}

let searchTimeout;
function onSearchInput(input) {
    clearTimeout(searchTimeout);
    const query = input.value.trim().toLowerCase();
    
    if (!query) {
        renderSearchItems(allItems);
        return;
    }

    searchTimeout = setTimeout(() => {
        const filtered = allItems.filter(item =>
            item.name.toLowerCase().includes(query) ||
            (item.category && item.category.toLowerCase().includes(query)) ||
            (item.container_name && item.container_name.toLowerCase().includes(query))
        );
        renderSearchItems(filtered);
    }, 300);
}

function toggleCategory(el) {
    document.querySelectorAll('#filter-categories .tag').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    
    const category = el.textContent.trim();
    if (category === 'Все') {
        renderSearchItems(allItems);
    } else {
        const clean = category.replace(/^[^\w]+/, '').trim();
        renderSearchItems(allItems.filter(i => i.category && i.category.includes(clean)));
    }
}

function toggleLocation(el) {
    document.querySelectorAll('#filter-locations .tag').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    
    const location = el.textContent.trim();
    if (location.includes('Все')) {
        renderSearchItems(allItems);
    } else {
        const clean = location.replace(/^[^\w]+/, '').trim();
        renderSearchItems(allItems.filter(i => i.container_name && i.container_name.includes(clean)));
    }
}

// Storage
let currentStoragePath = [];

async function loadStorage() {
    try {
        const containers = await api.getContainerTree();
        allContainers = await api.getContainers();
        currentStoragePath = [];
        renderStorageTree(containers);
    } catch (err) {
        console.error('Load storage error:', err);
    }
}

function renderStorageTree(nodes, depth = 0) {
    const container = document.getElementById('storage-content');
    const icons = { room: '🏠', furniture: '🪑', box: '📦', shelf: '📚', other: '📁' };

    // Show breadcrumbs if we're inside a container
    let html = '';
    if (currentStoragePath.length > 0) {
        html += '<div class="storage-breadcrumbs">';
        html += '<span class="breadcrumb-chip" onclick="navigateToStorage(0)">📦 Все</span>';
        currentStoragePath.forEach((item, idx) => {
            html += '<span class="breadcrumb-sep">›</span>';
            if (idx < currentStoragePath.length - 1) {
                html += `<span class="breadcrumb-chip" onclick="navigateToStorage(${idx + 1})">${item.name}</span>`;
            } else {
                html += `<span class="breadcrumb-chip current">${item.name}</span>`;
            }
        });
        html += '</div>';
    }

    if (!nodes || nodes.length === 0) {
        // Show items at this level
        const items = currentStoragePath.length > 0 ? getItemsForCurrentStorage() : allItems;
        if (items.length > 0) {
            html += renderStorageItems(items);
        } else {
            html += `
                <div class="empty-state" style="padding-top: 60px;">
                    <div class="empty-icon">📦</div>
                    <div class="empty-title">Нет мест</div>
                    <div class="empty-text">Создайте первое место для хранения вещей</div>
                    <button class="empty-btn" onclick="showAddContainer()">Добавить место</button>
                </div>
            `;
        }
        container.innerHTML = html;
        return;
    }

    // Show containers
    html += '<div class="storage-items">';
    html += '<div class="storage-section-title">Места (' + nodes.length + ')</div>';
    html += '<div class="storage-grid">';
    nodes.forEach(node => {
        const totalItems = countItemsInNode(node);
        html += `
            <div class="storage-item" onclick="drillIntoStorage(${node.id}, '${escapeHtml(node.name)}', '${icons[node.type] || '📁'}')">
                <div class="storage-item-photo">${icons[node.type] || '📁'}</div>
                <div class="storage-item-name">${escapeHtml(node.name)} (${totalItems})</div>
            </div>
        `;
    });
    html += '</div>';

    // Show items at root level
    if (depth === 0 && allItems.length > 0) {
        const rootItems = allItems.filter(i => !i.container_id);
        if (rootItems.length > 0) {
            html += '<div class="storage-section-title">Вещи без места (' + rootItems.length + ')</div>';
            html += renderStorageItems(rootItems);
        }
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderStorageItems(items) {
    const colors = ['#74B9FF,#0984E3', '#00B894,#00CEC9', '#FDCB6E,#E17055', '#FD79A8,#E84393'];
    let html = '<div class="storage-grid-items">';
    items.forEach((item, i) => {
        const color = colors[item.id % colors.length];
        html += `
            <div class="storage-item" onclick="showItemDetail(${item.id})">
                <div class="storage-item-photo" style="background: linear-gradient(135deg, ${color});">
                    ${item.images && item.images.length
                        ? `<img src="${item.images[0]}" style="width:100%;height:100%;object-fit:cover;" alt="">`
                        : '📦'
                    }
                </div>
                <div class="storage-item-name">${escapeHtml(item.name)}</div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function countItemsInNode(node) {
    let count = 0;
    // Count items directly in this container
    allItems.forEach(item => {
        if (item.container_id === node.id) count++;
    });
    // Count items in children
    if (node.children) {
        node.children.forEach(child => {
            count += countItemsInNode(child);
        });
    }
    return count;
}

function getItemsForCurrentStorage() {
    if (currentStoragePath.length === 0) return allItems;
    const lastContainer = currentStoragePath[currentStoragePath.length - 1];
    return allItems.filter(i => i.container_id === lastContainer.id);
}

function drillIntoStorage(id, name, icon) {
    const containers = currentStoragePath.length > 0
        ? currentStoragePath[currentStoragePath.length - 1].children || allContainers
        : allContainers;
    const container = containers.find(c => c.id === id);

    currentStoragePath.push({ id, name, icon, children: container?.children || [] });
    renderStorageTree(container?.children || []);
}

function navigateToStorage(index) {
    if (index === 0) {
        currentStoragePath = [];
        loadStorage();
    } else {
        currentStoragePath = currentStoragePath.slice(0, index);
        const lastContainer = currentStoragePath[currentStoragePath.length - 1];
        renderStorageTree(lastContainer.children || []);
    }
}

// Profile
function loadProfile() {
    const user = api.token ? JSON.parse(localStorage.getItem('vault_user') || '{}') : {};
    const name = user.name || user.email || 'Пользователь';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = name;
}

// FAB
function toggleFabPopup() {
    document.getElementById('fab-popup').classList.toggle('active');
}

function closeFabPopup() {
    document.getElementById('fab-popup').classList.remove('active');
}

// Add Item
function showAddItem() {
    document.getElementById('add-item-overlay').classList.add('active');
    document.getElementById('add-item-sheet').classList.add('active');
    loadContainersForSelect();
}

function closeAddItem() {
    document.getElementById('add-item-overlay').classList.remove('active');
    document.getElementById('add-item-sheet').classList.remove('active');
    document.getElementById('item-name').value = '';
    document.getElementById('item-color').value = '';
    document.getElementById('item-category').value = '';
    document.getElementById('photoPreview').style.display = 'none';
}

function handlePhotoSelect(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('photoPreview');
        preview.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function saveItem() {
    const name = document.getElementById('item-name').value.trim();
    if (!name) {
        showSnackbar('Введите название вещи');
        return;
    }

    try {
        const item = await api.createItem({
            name: name,
            container_id: document.getElementById('item-container').value || null,
            color: document.getElementById('item-color').value.trim() || null,
            category: document.getElementById('item-category').value.trim() || null
        });

        const photoInput = document.getElementById('photoInput');
        if (photoInput.files[0]) {
            await api.uploadPhoto(item.id, photoInput.files[0]);
        }

        closeAddItem();
        showSnackbar('Вещь добавлена!');
        loadHome();
    } catch (err) {
        showSnackbar('Ошибка: ' + err.message);
    }
}

// Add Container
function showAddContainer() {
    document.getElementById('add-container-overlay').classList.add('active');
    document.getElementById('add-container-sheet').classList.add('active');
    loadContainersForParentSelect();
}

function closeAddContainer() {
    document.getElementById('add-container-overlay').classList.remove('active');
    document.getElementById('add-container-sheet').classList.remove('active');
    document.getElementById('container-name').value = '';
}

async function saveContainer() {
    const name = document.getElementById('container-name').value.trim();
    if (!name) {
        showSnackbar('Введите название места');
        return;
    }

    try {
        await api.createContainer(
            name,
            document.getElementById('container-type').value,
            document.getElementById('container-parent').value || null
        );
        closeAddContainer();
        showSnackbar('Место добавлено!');
        loadHome();
    } catch (err) {
        showSnackbar('Ошибка: ' + err.message);
    }
}

async function loadContainersForSelect() {
    try {
        const containers = await api.getContainers();
        const select = document.getElementById('item-container');
        select.innerHTML = '<option value="">Выберите место</option>' +
            containers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    } catch (err) {
        console.error(err);
    }
}

async function loadContainersForParentSelect() {
    try {
        const containers = await api.getContainers();
        const select = document.getElementById('container-parent');
        select.innerHTML = '<option value="">Нет (корневое)</option>' +
            containers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    } catch (err) {
        console.error(err);
    }
}

// Item Detail
function showItemDetail(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    currentItem = item;

    document.getElementById('detail-title').textContent = item.name;
    document.getElementById('detail-location-text').textContent = item.container_name || 'Место не указано';

    let infoHtml = '';
    if (item.color) infoHtml += `<p>🎨 Цвет: ${escapeHtml(item.color)}</p>`;
    if (item.category) infoHtml += `<p>📁 Категория: ${escapeHtml(item.category)}</p>`;
    if (item.description) infoHtml += `<p>📝 ${escapeHtml(item.description)}</p>`;
    document.getElementById('detail-info').innerHTML = infoHtml || '<p>Нет дополнительной информации</p>';

    const photoContainer = document.getElementById('detail-photo');
    if (item.images && item.images.length) {
        photoContainer.innerHTML = `<img src="${item.images[0]}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;" alt="">`;
    } else {
        const colors = ['#74B9FF,#0984E3', '#00B894,#00CEC9', '#FDCB6E,#E17055', '#FD79A8,#E84393'];
        const color = colors[item.id % colors.length];
        photoContainer.innerHTML = `<div style="width:100%;aspect-ratio:1;background:linear-gradient(135deg,${color});display:flex;align-items:center;justify-content:center;font-size:80px;border-radius:12px;">📦</div>`;
    }

    document.getElementById('item-detail-modal').classList.add('active');
}

function closeItemDetail() {
    document.getElementById('item-detail-modal').classList.remove('active');
    currentItem = null;
}

function editCurrentItem() {
    if (!currentItem) return;
    closeItemDetail();
    showSnackbar('Редактирование: ' + currentItem.name);
}

function deleteCurrentItem() {
    if (!currentItem) return;
    document.getElementById('confirm-delete-overlay').classList.add('active');
}

function closeConfirmDelete() {
    document.getElementById('confirm-delete-overlay').classList.remove('active');
}

async function confirmDelete() {
    if (!currentItem) return;
    try {
        await api.deleteItem(currentItem.id);
        closeConfirmDelete();
        closeItemDetail();
        showSnackbar('Вещь удалена');
        loadHome();
    } catch (err) {
        showSnackbar('Ошибка: ' + err.message);
    }
}

// View Toggle
function setStorageView(view) {
    document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('toggle-' + view).classList.add('active');
}

// Notifications
function toggleNotifications() {
    const status = document.getElementById('notifications-status');
    if (status.textContent === 'Отключены') {
        status.textContent = 'Включены';
        showSnackbar('Уведомления включены');
    } else {
        status.textContent = 'Отключены';
        showSnackbar('Уведомления отключены');
    }
}

// Snackbar
function showSnackbar(text) {
    const snackbar = document.getElementById('snackbar');
    document.getElementById('snackbar-text').textContent = text;
    snackbar.classList.add('active');
    setTimeout(() => snackbar.classList.remove('active'), 3000);
}

// Utilities
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Init
document.addEventListener('DOMContentLoaded', function() {
    if (initOnboarding()) return;

    if (api.token) {
        api.getMe().then(user => {
            localStorage.setItem('vault_user', JSON.stringify(user));
            showApp();
        }).catch(() => {
            api.clearToken();
            showAuthScreen();
        });
    } else {
        showAuthScreen();
    }

    // Close popups on outside click
    document.addEventListener('click', function(e) {
        const fab = document.getElementById('fab-add');
        const popup = document.getElementById('fab-popup');
        if (popup && popup.classList.contains('active') && !popup.contains(e.target) && !fab.contains(e.target)) {
            popup.classList.remove('active');
        }
    });
});
