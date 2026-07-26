// Vault App - Main JavaScript
let currentScreen = 'home';
let allItems = [];
let allContainers = [];
let currentItem = null;
let isRegisterMode = false;

// ===== Mass Add State =====
const massAddState = {
    photos: [],
    selectedContainerId: null,
    currentPhase: 'camera',
    maxQueueSize: 50,

    addPhoto(blob) {
        if (this.photos.length >= this.maxQueueSize) {
            throw new Error(`Максимум ${this.maxQueueSize} фото за сессию`);
        }
        const photo = {
            id: Date.now() + Math.random(),
            blob,
            url: URL.createObjectURL(blob),
            name: '',
            containerId: this.selectedContainerId,
            status: 'pending'
        };
        this.photos.push(photo);
        return photo;
    },

    removePhoto(id) {
        const index = this.photos.findIndex(p => p.id === id);
        if (index !== -1) {
            URL.revokeObjectURL(this.photos[index].url);
            this.photos.splice(index, 1);
        }
    },

    clear() {
        this.photos.forEach(p => URL.revokeObjectURL(p.url));
        this.photos = [];
        this.selectedContainerId = null;
        this.currentPhase = 'camera';
    }
};

// Error monitoring
window.onerror = function(msg, url, line, col, err) {
    fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, url, line, column: col, stack: err?.stack })
    }).catch(() => {});
};
window.addEventListener('unhandledrejection', function(e) {
    fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: e.reason?.message || String(e.reason), stack: e.reason?.stack })
    }).catch(() => {});
});

// ===== Loading State Helpers =====
function setBtnLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
        btn.classList.add('btn-loading');
        btn.disabled = true;
        if (!btn.querySelector('.btn-spinner')) {
            const spinner = document.createElement('span');
            spinner.className = 'btn-spinner';
            btn.appendChild(spinner);
        }
    } else {
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        const spinner = btn.querySelector('.btn-spinner');
        if (spinner) spinner.remove();
    }
}

function skeletonCards(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="skeleton-card">
            <div class="skeleton skeleton-image"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line skeleton-line-short"></div>
        </div>`;
    }
    return html;
}

// ===== Client-side Cache =====
const cache = {
    get(key) {
        try {
            const raw = localStorage.getItem('vault_' + key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },
    set(key, data) {
        try { localStorage.setItem('vault_' + key, JSON.stringify(data)); } catch {}
    },
    remove(key) {
        localStorage.removeItem('vault_' + key);
    }
};

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
    const btn = document.querySelector('#auth-screen .greeting-cta');
    errorEl.style.display = 'none';

    if (!email || !password) {
        errorEl.textContent = 'Заполните все поля';
        errorEl.style.display = 'block';
        return;
    }

    setBtnLoading(btn, true);
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
    } finally {
        setBtnLoading(btn, false);
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
    // Show skeleton while loading
    const recentGrid = document.getElementById('recent-items');
    if (recentGrid && recentGrid.children.length === 0) {
        recentGrid.innerHTML = skeletonCards(6);
    }

    // Load from cache first, then fetch in background
    const cachedItems = cache.get('items');
    const cachedContainers = cache.get('containers');

    if (cachedItems) {
        allItems = cachedItems;
        allContainers = cachedContainers || [];
        renderHome();
    }

    try {
        const [items, containers] = await Promise.all([
            api.getItems(),
            api.getContainers()
        ]);
        allItems = items;
        allContainers = containers;
        cache.set('items', items);
        cache.set('containers', containers);
        renderHome();
    } catch (err) {
        console.error('Load home error:', err);
        if (!cachedItems) {
            recentGrid.innerHTML = '';
            showSnackbar('Ошибка загрузки данных');
        }
    }
}

function renderHome() {
    document.getElementById('stat-items').textContent = allItems.length;
    document.getElementById('stat-containers').textContent = allContainers.length;

    const emptyEl = document.getElementById('home-empty');
    const withItemsEl = document.getElementById('home-with-items');

    if (allItems.length === 0) {
        emptyEl.style.display = 'block';
        withItemsEl.style.display = 'none';
    } else {
        emptyEl.style.display = 'none';
        withItemsEl.style.display = 'block';
        renderRecentItems(allItems.slice(0, 6));
    }

    document.getElementById('profile-stats').textContent = `${allItems.length} вещей, ${allContainers.length} мест`;
    document.getElementById('profile-progress').style.width = `${Math.min(allItems.length * 4, 100)}%`;
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
    // Show skeleton
    const grid = document.getElementById('search-items');
    if (grid && grid.children.length === 0) {
        grid.innerHTML = skeletonCards(6);
    }

    // Use cached data if available
    if (allItems.length > 0) {
        renderSearchItems(allItems);
        renderFilterTags();
    }

    try {
        const items = await api.getItems();
        allItems = items;
        cache.set('items', items);
        renderSearchItems(items);
        renderFilterTags();
    } catch (err) {
        console.error('Load search error:', err);
    }
}

function renderFilterTags() {
    // Categories
    const categories = [...new Set(allItems.map(i => i.category).filter(Boolean))].sort();
    const catContainer = document.getElementById('filter-categories');
    catContainer.innerHTML = '<span class="tag active" onclick="toggleCategory(this)">Все</span>' +
        categories.map(c => `<span class="tag" onclick="toggleCategory(this)">${escapeHtml(c)}</span>`).join('');

    // Locations
    const locations = [...new Set(allItems.map(i => i.container_name).filter(Boolean))].sort();
    const locContainer = document.getElementById('filter-locations');
    locContainer.innerHTML = '<span class="tag active" onclick="toggleLocation(this)">Все места</span>' +
        locations.map(l => `<span class="tag" onclick="toggleLocation(this)">${escapeHtml(l)}</span>`).join('');
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
let activeCategory = 'Все';
let activeLocation = 'Все места';

function applyFilters() {
    const query = (document.getElementById('search-input')?.value || '').trim().toLowerCase();

    let filtered = allItems;

    // Text search
    if (query) {
        filtered = filtered.filter(item =>
            item.name.toLowerCase().includes(query) ||
            (item.category && item.category.toLowerCase().includes(query)) ||
            (item.container_name && item.container_name.toLowerCase().includes(query))
        );
    }

    // Category filter
    if (activeCategory !== 'Все') {
        filtered = filtered.filter(i => i.category === activeCategory);
    }

    // Location filter
    if (activeLocation !== 'Все места') {
        filtered = filtered.filter(i => i.container_name === activeLocation);
    }

    renderSearchItems(filtered);
}

function onSearchInput(input) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 300);
}

function toggleCategory(el) {
    document.querySelectorAll('#filter-categories .tag').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    activeCategory = el.textContent.trim();
    applyFilters();
}

function toggleLocation(el) {
    document.querySelectorAll('#filter-locations .tag').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    activeLocation = el.textContent.trim();
    applyFilters();
}

// Storage
let currentStoragePath = [];
let containerTree = [];

async function loadStorage() {
    // Show skeleton
    const content = document.getElementById('storage-content');
    if (content && content.children.length === 0) {
        content.innerHTML = '<div style="padding:16px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">' + skeletonCards(4) + '</div>';
    }

    try {
        containerTree = await api.getContainerTree();
        allContainers = await api.getContainers();
        cache.set('containers', allContainers);
        currentStoragePath = [];
        renderStorageTree(containerTree);
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
        const photoHtml = node.photo
            ? `<img src="${node.photo}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;">`
            : `${icons[node.type] || '📁'}`;
        html += `
            <div class="storage-item" onclick="drillIntoStorage(${node.id}, '${escapeHtml(node.name)}', '${icons[node.type] || '📁'}')">
                <div class="storage-item-photo">${photoHtml}</div>
                <div class="storage-item-name">${escapeHtml(node.name)} (${totalItems})</div>
                <button class="storage-item-edit" onclick="event.stopPropagation(); editContainerById(${node.id})">✏️</button>
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
    // Find the node in the tree to get its children
    function findNode(nodes, targetId) {
        for (const node of nodes) {
            if (node.id === targetId) return node;
            if (node.children) {
                const found = findNode(node.children, targetId);
                if (found) return found;
            }
        }
        return null;
    }

    const parentNode = currentStoragePath.length > 0
        ? currentStoragePath[currentStoragePath.length - 1]
        : null;

    const searchNodes = parentNode ? (parentNode.children || []) : containerTree;
    const node = findNode(searchNodes, id);

    currentStoragePath.push({ id, name, icon, children: node?.children || [] });
    renderStorageTree(node?.children || []);
}

function navigateToStorage(index) {
    if (index === 0) {
        currentStoragePath = [];
        renderStorageTree(containerTree);
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
// ===== Mass Add Functions =====
function openMassAdd() {
    const lastContainer = localStorage.getItem('last-container-id');
    if (lastContainer) {
        massAddState.selectedContainerId = parseInt(lastContainer);
        const container = allContainers.find(c => c.id === massAddState.selectedContainerId);
        document.getElementById('mass-add-location-name').textContent = container ? container.name : 'Не выбрано';
    }
    massAddState.currentPhase = 'camera';
    document.getElementById('mass-add-screen').classList.add('active');
    document.getElementById('fab-add').style.display = 'none';
    document.getElementById('fab-mass-add').style.display = 'none';
    updateGallery();
}

function closeMassAdd() {
    if (massAddState.photos.length > 0) {
        document.getElementById('mass-add-close-overlay').classList.add('active');
    } else {
        document.getElementById('mass-add-screen').classList.remove('active');
        document.getElementById('fab-add').style.display = '';
        document.getElementById('fab-mass-add').style.display = '';
        massAddState.clear();
    }
}

function closeMassAddDialog() {
    document.getElementById('mass-add-close-overlay').classList.remove('active');
}

function discardMassAdd() {
    massAddState.clear();
    document.getElementById('mass-add-screen').classList.remove('active');
    document.getElementById('mass-add-close-overlay').classList.remove('active');
    document.getElementById('fab-add').style.display = '';
    document.getElementById('fab-mass-add').style.display = '';
    updateGallery();
}

function saveDraftMassAdd() {
    const draft = massAddState.photos.map(p => ({
        name: p.name,
        containerId: p.containerId
    }));
    localStorage.setItem('mass-add-draft', JSON.stringify(draft));
    massAddState.clear();
    document.getElementById('mass-add-screen').classList.remove('active');
    document.getElementById('mass-add-close-overlay').classList.remove('active');
    document.getElementById('fab-add').style.display = '';
    document.getElementById('fab-mass-add').style.display = '';
    showSnackbar('Черновик сохранён (без фото)');
}

function changeMassAddLocation(e) {
    if (e) e.stopPropagation();
    const isLabelReview = document.getElementById('label-review').classList.contains('active');
    const dropdownId = isLabelReview ? 'container-dropdown-label' : 'container-dropdown';
    const dropdown = document.getElementById(dropdownId);

    // Toggle: if already open, close it
    if (dropdown && dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
        return;
    }

    showContainerPicker((containerId) => {
        massAddState.selectedContainerId = containerId;
        const container = allContainers.find(c => c.id === containerId);
        document.getElementById('mass-add-location-name').textContent = container ? container.name : 'Не выбрано';
        localStorage.setItem('last-container-id', containerId);
    });
}

async function showContainerPicker(callback) {
    // Ensure we have tree data
    if (containerTree.length === 0) {
        try {
            containerTree = await api.getContainerTree();
        } catch (e) {
            console.error('Failed to load container tree:', e);
        }
    }
    const tree = containerTree.length > 0 ? containerTree : (cache.get('containers') || allContainers);

    // Build flat list with full paths
    function flattenWithPaths(nodes, prefix) {
        let result = [];
        nodes.forEach(node => {
            const path = prefix ? `${prefix} > ${node.name}` : node.name;
            result.push({ id: node.id, path });
            if (node.children && node.children.length) {
                result = result.concat(flattenWithPaths(node.children, path));
            }
        });
        return result;
    }

    const flatList = flattenWithPaths(tree, '');

    // Populate both dropdowns
    ['container-dropdown', 'container-dropdown-label'].forEach(id => {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        const listId = id === 'container-dropdown' ? 'container-list' : 'container-list-label';
        const list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = flatList.map(c =>
            `<div class="category-option" onclick="event.stopPropagation(); selectContainerForMassAdd(${c.id})">${escapeHtml(c.path)}</div>`
        ).join('');
    });

    window._massAddContainerCallback = callback;

    // Show the active dropdown
    const activeScreen = document.getElementById('label-review').classList.contains('active')
        ? 'container-dropdown-label'
        : 'container-dropdown';
    const dropdown = document.getElementById(activeScreen);
    if (dropdown) dropdown.classList.add('active');
}

function selectContainerForMassAdd(id) {
    if (window._massAddContainerCallback) {
        window._massAddContainerCallback(id);
    }
    // Close all dropdowns
    document.querySelectorAll('.container-select-dropdown').forEach(d => d.classList.remove('active'));
    // Update label review location if visible
    updateLabelLocation();
}

function compressImage(blob, maxWidth = 800) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(resolve, 'image/jpeg', 0.85);
        };
        img.src = URL.createObjectURL(blob);
    });
}

async function capturePhoto() {
    try {
        let blob;

        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera) {
            const { Camera, CameraResultType, CameraSource } = window.Capacitor.Plugins;
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Blob,
                source: CameraSource.Camera,
                width: 1024,
                height: 1024,
            });
            blob = image.blob;
        } else {
            // Fallback: use file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment';

            blob = await new Promise((resolve, reject) => {
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) resolve(file);
                    else reject(new Error('User cancelled'));
                };
                input.click();
            });
        }

        const compressedBlob = await compressImage(blob, 800);

        // Validate size (5MB max)
        if (compressedBlob.size > 5 * 1024 * 1024) {
            showSnackbar('Фото слишком большое (макс. 5MB)');
            return;
        }

        showFlash();
        massAddState.addPhoto(compressedBlob);
        updateGallery();

    } catch (error) {
        if (error.message !== 'User cancelled' && error.message !== 'User cancelled photos app') {
            console.error('Camera error:', error);
            showSnackbar('Ошибка камеры');
        }
    }
}

function showFlash() {
    const flash = document.getElementById('mass-add-flash');
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 300);
}

function updateGallery() {
    const gallery = document.getElementById('mass-add-gallery');
    gallery.innerHTML = massAddState.photos.map((photo, i) => `
        <div class="mass-add-thumb ${photo.name ? 'labeled' : 'unlabeled'}"
             onclick="editItem(${i})">
            <div class="mass-add-thumb-num">${i + 1}</div>
            <img src="${photo.url}"
                 style="width:100%;height:100%;object-fit:cover">
        </div>
    `).join('');

    const badge = document.getElementById('mass-add-gallery-badge');
    badge.textContent = massAddState.photos.length;
    badge.classList.toggle('visible', massAddState.photos.length > 0);

    const counter = document.getElementById('mass-add-counter');
    counter.textContent = massAddState.photos.length;

    const doneBtn = document.getElementById('mass-add-done');
    doneBtn.disabled = massAddState.photos.length === 0;
    doneBtn.textContent = `Подписать вещи (${massAddState.photos.length})`;

    const saveRawBtn = document.getElementById('mass-add-save-raw');
    saveRawBtn.disabled = massAddState.photos.length === 0;
}

// ===== Label Review =====
let currentLabelIndex = 0;

function openLabelReview() {
    if (massAddState.photos.length === 0) return;
    currentLabelIndex = 0;
    massAddState.currentPhase = 'labeling';

    document.getElementById('mass-add-screen').classList.remove('active');
    document.getElementById('label-review').classList.add('active');

    // Show current location
    updateLabelLocation();

    renderLabelCard();
    updateLabelProgress();
}

function updateLabelLocation() {
    const nameEl = document.getElementById('label-review-location-name');
    if (massAddState.selectedContainerId) {
        const container = allContainers.find(c => c.id === massAddState.selectedContainerId);
        nameEl.textContent = container ? container.name : 'Не выбрано';
    } else {
        nameEl.textContent = 'Не выбрано';
    }
}

function renderLabelCard() {
    if (currentLabelIndex >= massAddState.photos.length) {
        saveAllItems();
        return;
    }

    const photo = massAddState.photos[currentLabelIndex];
    const photoEl = document.getElementById('label-card-photo');
    const input = document.getElementById('label-card-input');

    photoEl.style.backgroundImage = `url(${photo.url})`;
    input.value = photo.name || '';
    input.focus();

    updateLabelDots();
    updateLabelProgress();

    // On last item, show only "Сохранить"
    const isLast = currentLabelIndex >= massAddState.photos.length - 1;
    const bottomBar = document.getElementById('label-review-bottom-bar');
    if (isLast) {
        bottomBar.innerHTML = '<button class="label-bottom-btn primary" onclick="saveAllItems()">Сохранить</button>';
    } else {
        bottomBar.innerHTML = `
            <button class="label-bottom-btn primary" onclick="skipCurrentItem()">Дальше</button>
            <button class="label-bottom-btn secondary" onclick="saveAllItems()">Сохранить все</button>
        `;
    }
}

function skipCurrentItem() {
    currentLabelIndex++;
    renderLabelCard();
    updateLabelProgress();
}

function acceptCurrentLabel() {
    const input = document.getElementById('label-card-input');
    massAddState.photos[currentLabelIndex].name = input.value.trim() || 'Без названия';
    currentLabelIndex++;
    renderLabelCard();
    updateLabelProgress();
}

function updateLabelProgress() {
    const total = massAddState.photos.length;
    const current = Math.min(currentLabelIndex + 1, total);
    document.getElementById('label-progress-fill').style.width = `${(current / total) * 100}%`;
    document.getElementById('label-progress-text').textContent = `${current}/${total}`;

    // Update navigation buttons
    const prevBtn = document.getElementById('label-nav-prev');
    const nextBtn = document.getElementById('label-nav-next');
    if (prevBtn) prevBtn.disabled = currentLabelIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentLabelIndex >= total - 1;
}

function updateLabelDots() {
    const dots = document.getElementById('label-review-dots');
    dots.innerHTML = massAddState.photos.map((photo, i) =>
        `<div class="label-review-dot ${i === currentLabelIndex ? 'active' : ''} ${photo.name ? 'labeled' : ''}" onclick="jumpToItem(${i})"></div>`
    ).join('');
}

function jumpToItem(index) {
    // Save current input before jumping
    saveCurrentInput();
    currentLabelIndex = index;
    renderLabelCard();
    updateLabelProgress();
}

function saveCurrentInput() {
    if (currentLabelIndex < massAddState.photos.length) {
        const input = document.getElementById('label-card-input');
        if (input) {
            massAddState.photos[currentLabelIndex].name = input.value.trim();
        }
    }
}

function labelNavPrev() {
    if (currentLabelIndex > 0) {
        saveCurrentInput();
        currentLabelIndex--;
        renderLabelCard();
        updateLabelProgress();
    }
}

function labelNavNext() {
    if (currentLabelIndex < massAddState.photos.length - 1) {
        saveCurrentInput();
        currentLabelIndex++;
        renderLabelCard();
        updateLabelProgress();
    }
}

function closeLabelReview() {
    document.getElementById('label-review').classList.remove('active');
    document.getElementById('mass-add-screen').classList.add('active');
}

function cancelLabelReview() {
    document.getElementById('label-review').classList.remove('active');
    document.getElementById('mass-add-screen').classList.remove('active');
    document.getElementById('fab-add').style.display = '';
    document.getElementById('fab-mass-add').style.display = '';
    massAddState.clear();
    updateGallery();
}

async function saveAllItems() {
    if (massAddState.currentPhase === 'saving') return;

    // Disable all save buttons to prevent double-click
    document.querySelectorAll('.label-bottom-btn.primary').forEach(b => b.disabled = true);

    massAddState.currentPhase = 'saving';

    // Save name for current item if still in labeling phase
    if (currentLabelIndex < massAddState.photos.length) {
        const input = document.getElementById('label-card-input');
        if (input && input.value.trim()) {
            massAddState.photos[currentLabelIndex].name = input.value.trim();
        }
    }

    await doSaveItems();
}

async function saveAllRaw() {
    if (massAddState.currentPhase === 'saving') return;
    massAddState.currentPhase = 'saving';
    await doSaveItems();
}

async function doSaveItems() {
    const itemsData = massAddState.photos.map(photo => ({
        name: photo.name || 'Без названия',
        container_id: massAddState.selectedContainerId,
    }));

    try {
        const itemsResponse = await api.createItemsBatch(itemsData, massAddState.selectedContainerId);

        if (!itemsResponse.data || itemsResponse.data.length === 0) {
            showSnackbar('Ошибка: вещи не созданы');
            return;
        }

        const files = massAddState.photos.map(p => p.blob);
        const itemIds = itemsResponse.data.map(item => item.id);

        const batchSize = 10;
        for (let i = 0; i < itemIds.length; i += batchSize) {
            const batchIds = itemIds.slice(i, i + batchSize);
            const batchFiles = files.slice(i, i + batchSize);
            await api.uploadPhotosBatch(batchIds, batchFiles);
        }

        const uploaded = itemsResponse.data.length;
        const errors = itemsResponse.errors ? itemsResponse.errors.length : 0;

        if (errors > 0) {
            showSnackbar(`Добавлено ${uploaded}, ошибок: ${errors}`);
        } else {
            showSnackbar(`Добавлено ${uploaded} вещей`);
        }

        massAddState.clear();
        document.getElementById('label-review').classList.remove('active');
        document.getElementById('mass-add-screen').classList.remove('active');
        document.getElementById('fab-add').style.display = '';
        document.getElementById('fab-mass-add').style.display = '';

        cache.remove('items');
        loadHome();

    } catch (err) {
        console.error('Save all items error:', err);
        showSnackbar('Ошибка сохранения: ' + err.message);
    }
}

// Add Item
function showAddItem() {
    document.getElementById('add-item-overlay').classList.add('active');
    document.getElementById('add-item-sheet').classList.add('active');
    document.getElementById('fab-add').style.display = 'none';
    document.getElementById('fab-mass-add').style.display = 'none';
    loadContainersForSelect();
}

function closeAddItem() {
    document.getElementById('add-item-overlay').classList.remove('active');
    document.getElementById('add-item-sheet').classList.remove('active');
    document.getElementById('fab-add').style.display = '';
    document.getElementById('fab-mass-add').style.display = '';
    document.getElementById('item-name').value = '';
    document.getElementById('item-color').value = '';
    document.getElementById('item-category').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    document.getElementById('photoInput').value = '';
    // Close dropdowns
    document.querySelectorAll('.category-dropdown, .color-dropdown').forEach(d => d.classList.remove('active'));
}

// Category/Color dropdowns
function loadExistingCategories() {
    const categories = [...new Set(allItems.map(item => item.category).filter(Boolean))].sort();
    const dropdown = document.getElementById('category-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = categories.map(cat =>
        `<div class="category-option" onclick="selectCategory('${escapeHtml(cat)}')">${escapeHtml(cat)}</div>`
    ).join('');
}

function loadExistingColors() {
    const colors = [...new Set(allItems.map(item => item.color).filter(Boolean))].sort();
    const dropdown = document.getElementById('color-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = colors.map(color =>
        `<div class="color-option" onclick="selectColor('${escapeHtml(color)}')">${escapeHtml(color)}</div>`
    ).join('');
}

function filterCategories(value) {
    const dropdown = document.getElementById('category-dropdown');
    if (!dropdown) return;
    const options = dropdown.querySelectorAll('.category-option');
    options.forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(value.toLowerCase()) ? 'block' : 'none';
    });
    dropdown.classList.add('active');
}

function filterColors(value) {
    const dropdown = document.getElementById('color-dropdown');
    if (!dropdown) return;
    const options = dropdown.querySelectorAll('.color-option');
    options.forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(value.toLowerCase()) ? 'block' : 'none';
    });
    dropdown.classList.add('active');
}

function selectCategory(cat) {
    document.getElementById('item-category').value = cat;
    document.getElementById('category-dropdown').classList.remove('active');
}

function selectColor(color) {
    document.getElementById('item-color').value = color;
    document.getElementById('color-dropdown').classList.remove('active');
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
    const nameInput = document.getElementById('item-name').value.trim();
    const photoInput = document.getElementById('photoInput');
    const photoFile = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;

    // Derive name: input > photo filename > default
    let name = nameInput;
    if (!name && photoFile) {
        name = photoFile.name.replace(/\.[^.]+$/, '');
    }
    if (!name) {
        name = 'Без названия';
    }

    const btn = document.querySelector('#add-item-sheet .btn-save');
    setBtnLoading(btn, true);

    const tempItem = {
        id: -Date.now(),
        name,
        container_id: document.getElementById('item-container').value || null,
        color: document.getElementById('item-color').value.trim() || null,
        category: document.getElementById('item-category').value.trim() || null,
        images: [],
        created_at: new Date().toISOString()
    };

    // Optimistic: add immediately
    allItems.unshift(tempItem);
    renderHome();
    closeAddItem();

    try {
        const item = await api.createItem({
            name: name,
            container_id: tempItem.container_id,
            color: tempItem.color,
            category: tempItem.category
        });

        if (photoFile) {
            await api.uploadPhoto(item.id, photoFile);
        }

        // Replace temp with real item
        const idx = allItems.findIndex(i => i.id === tempItem.id);
        if (idx !== -1) allItems[idx] = { ...item, images: [] };

        showSnackbar('Вещь добавлена!');
        cache.set('items', allItems);
        renderHome();
    } catch (err) {
        // Rollback
        allItems = allItems.filter(i => i.id !== tempItem.id);
        renderHome();
        showSnackbar('Ошибка: ' + err.message);
    } finally {
        setBtnLoading(btn, false);
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
    document.getElementById('containerPhotoInput').value = '';
    document.getElementById('container-photo-preview').style.display = 'none';
    document.getElementById('container-photo-placeholder').style.display = '';
}

async function saveContainer() {
    const name = document.getElementById('container-name').value.trim();
    if (!name) {
        showSnackbar('Введите название места');
        return;
    }

    const btn = document.querySelector('#add-container-sheet .bottom-sheet-save');
    setBtnLoading(btn, true);

    const tempContainer = {
        id: -Date.now(),
        name,
        type: document.getElementById('container-type').value,
        parent_id: document.getElementById('container-parent').value || null,
        photo: null,
        children: []
    };

    // Optimistic: add immediately
    allContainers.push(tempContainer);
    closeAddContainer();
    renderHome();

    try {
        const container = await api.createContainer(
            name,
            tempContainer.type,
            tempContainer.parent_id
        );

        const photoInput = document.getElementById('containerPhotoInput');
        if (photoInput.files[0]) {
            await api.uploadContainerPhoto(container.id, photoInput.files[0]);
        }

        // Replace temp with real
        const idx = allContainers.findIndex(c => c.id === tempContainer.id);
        if (idx !== -1) allContainers[idx] = { ...container, children: [] };

        showSnackbar('Место добавлено!');
        cache.set('containers', allContainers);
        renderHome();
    } catch (err) {
        // Rollback
        allContainers = allContainers.filter(c => c.id !== tempContainer.id);
        renderHome();
        showSnackbar('Ошибка: ' + err.message);
    } finally {
        setBtnLoading(btn, false);
    }
}

function handleContainerPhotoSelect(input, previewId, placeholderId) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    reader.onload = function(e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(input.files[0]);
}

let editingItemId = null;

let currentContainer = null;

function editContainerById(id) {
    const containers = cache.get('containers') || [];
    const container = containers.find(c => c.id === id);
    if (container) openEditContainer(container);
}

function openEditContainer(container) {
    currentContainer = container;
    document.getElementById('edit-container-name').value = container.name || '';
    document.getElementById('edit-container-type').value = container.type || 'other';

    // Load parent options
    loadContainerParentOptions(container.id, container.parent_id);

    const preview = document.getElementById('edit-container-photo-preview');
    const placeholder = document.getElementById('edit-container-photo-placeholder');
    if (container.photo) {
        preview.src = container.photo;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.style.display = 'none';
        placeholder.style.display = '';
    }

    document.getElementById('edit-container-overlay').classList.add('active');
    document.getElementById('edit-container-sheet').classList.add('active');
}

function loadContainerParentOptions(currentId, currentParentId) {
    const containers = allContainers.filter(c => c.id !== currentId);
    const select = document.getElementById('edit-container-parent');
    select.innerHTML = '<option value="">Нет (корневое)</option>';

    function addOptions(parentId, level) {
        const children = containers.filter(c => c.parent_id === parentId);
        children.forEach(child => {
            const indent = '\u2014'.repeat(level);
            const selected = child.id === currentParentId ? 'selected' : '';
            select.innerHTML += `<option value="${child.id}" ${selected}>${indent} ${escapeHtml(child.name)}</option>`;
            addOptions(child.id, level + 1);
        });
    }

    addOptions(null, 0);
}

function closeEditContainer() {
    document.getElementById('edit-container-overlay').classList.remove('active');
    document.getElementById('edit-container-sheet').classList.remove('active');
    document.getElementById('editContainerPhotoInput').value = '';
    currentContainer = null;
}

async function saveContainerEdit() {
    if (!currentContainer) return;
    const name = document.getElementById('edit-container-name').value.trim();
    if (!name) {
        showSnackbar('Введите название места');
        return;
    }

    const btn = document.querySelector('#edit-container-sheet .bottom-sheet-save');
    setBtnLoading(btn, true);

    try {
        await api.updateContainer(currentContainer.id, {
            name: name,
            type: document.getElementById('edit-container-type').value,
            parent_id: document.getElementById('edit-container-parent').value || null
        });

        const photoInput = document.getElementById('editContainerPhotoInput');
        if (photoInput.files[0]) {
            await api.uploadContainerPhoto(currentContainer.id, photoInput.files[0]);
        }

        closeEditContainer();
        showSnackbar('Место обновлено');
        cache.remove('containers');
        loadStorage();
    } catch (err) {
        showSnackbar('Ошибка: ' + err.message);
    } finally {
        setBtnLoading(btn, false);
    }
}

async function loadContainersForSelect() {
    try {
        const containers = await api.getContainers();
        const select = document.getElementById('item-container');
        select.innerHTML = '<option value="">Выберите место</option>' +
            containers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') +
            '<option value="__new__">+ Создать новое место</option>';

        select.onchange = function() {
            if (this.value === '__new__') {
                this.value = '';
                closeAddItem();
                showAddContainer();
            }
        };
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

function toggleDetailMenu() {
    const dropdown = document.getElementById('item-menu-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

function toggleCollapsible(header) {
    const collapsible = header.parentElement;
    collapsible.classList.toggle('open');
}

function editCurrentItem() {
    if (!currentItem) return;
    const item = currentItem;
    closeItemDetail();
    openEditItem(item);
}

async function openEditItem(item) {
    editingItemId = item.id;
    document.getElementById('edit-item-name').value = item.name || '';
    document.getElementById('edit-item-color').value = item.color || '';
    document.getElementById('edit-item-category').value = item.category || '';

    const preview = document.getElementById('edit-photo-preview');
    const placeholder = document.getElementById('edit-photo-placeholder');
    if (item.images && item.images.length) {
        preview.src = item.images[0];
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.style.display = 'none';
        placeholder.style.display = '';
    }

    const select = document.getElementById('edit-item-container');
    try {
        const containers = await api.getContainers();
        select.innerHTML = '<option value="">Без места</option>' +
            containers.map(c => `<option value="${c.id}" ${c.id === item.container_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    } catch (err) {
        select.innerHTML = '<option value="">Без места</option>';
    }

    document.getElementById('edit-item-overlay').classList.add('active');
    document.getElementById('edit-item-sheet').classList.add('active');
}

function closeEditItem() {
    document.getElementById('edit-item-overlay').classList.remove('active');
    document.getElementById('edit-item-sheet').classList.remove('active');
    document.getElementById('editPhotoInput').value = '';
    editingItemId = null;
}

function handleEditPhotoSelect(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    const preview = document.getElementById('edit-photo-preview');
    const placeholder = document.getElementById('edit-photo-placeholder');
    reader.onload = function(e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(input.files[0]);
}

async function saveItemEdit() {
    if (!editingItemId) return;
    const name = document.getElementById('edit-item-name').value.trim();
    if (!name) {
        showSnackbar('Введите название вещи');
        return;
    }

    const btn = document.querySelector('#edit-item-sheet .bottom-sheet-save');
    setBtnLoading(btn, true);

    try {
        await api.updateItem(editingItemId, {
            name: name,
            container_id: document.getElementById('edit-item-container').value || null,
            color: document.getElementById('edit-item-color').value.trim() || null,
            category: document.getElementById('edit-item-category').value.trim() || null
        });

        const photoInput = document.getElementById('editPhotoInput');
        if (photoInput.files[0]) {
            await api.uploadPhoto(editingItemId, photoInput.files[0]);
        }

        closeEditItem();
        showSnackbar('Вещь обновлена');
        cache.remove('items');
        loadHome();
    } catch (err) {
        showSnackbar('Ошибка: ' + err.message);
    } finally {
        setBtnLoading(btn, false);
    }
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
    const btn = document.querySelector('.detail-confirm-btn.confirm');
    setBtnLoading(btn, true);

    const deletedItem = { ...currentItem };
    const deletedIndex = allItems.findIndex(i => i.id === currentItem.id);

    // Optimistic: remove immediately
    allItems = allItems.filter(i => i.id !== currentItem.id);
    closeConfirmDelete();
    closeItemDetail();
    renderHome();

    try {
        await api.deleteItem(deletedItem.id);
        showSnackbar('Вещь удалена');
        cache.set('items', allItems);
    } catch (err) {
        // Rollback
        if (deletedIndex !== -1) {
            allItems.splice(deletedIndex, 0, deletedItem);
        } else {
            allItems.push(deletedItem);
        }
        renderHome();
        showSnackbar('Ошибка: ' + err.message);
    } finally {
        setBtnLoading(btn, false);
    }
}

// View Toggle
function setStorageView(view) {
    document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
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

function togglePasswordVisibility() {
    const input = document.getElementById('auth-password');
    input.type = input.type === 'password' ? 'text' : 'password';
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
        // Close container dropdowns
        document.querySelectorAll('.container-select-dropdown').forEach(d => {
            if (d.classList.contains('active') && !d.contains(e.target) && !e.target.closest('.mass-add-location-change')) {
                d.classList.remove('active');
            }
        });

        // Close item menu dropdown
        const menuDropdown = document.getElementById('item-menu-dropdown');
        if (menuDropdown && menuDropdown.classList.contains('active') && !menuDropdown.contains(e.target) && !e.target.closest('.menu-toggle')) {
            menuDropdown.classList.remove('active');
        }

        // Close category/color dropdowns
        if (!e.target.closest('.category-select')) {
            document.querySelectorAll('.category-dropdown').forEach(d => d.classList.remove('active'));
        }
        if (!e.target.closest('.color-select')) {
            document.querySelectorAll('.color-dropdown').forEach(d => d.classList.remove('active'));
        }
    });

    // Keyboard handler for label input
    const labelInput = document.getElementById('label-card-input');
    if (labelInput) {
        labelInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                acceptCurrentLabel();
            }
        });
    }
});
