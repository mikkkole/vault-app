// API Base URL - always points to the server
const API_BASE = 'https://vault-app-8vjd.onrender.com/api/';

class VaultAPI {
    constructor() {
        this.token = localStorage.getItem('vault_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('vault_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('vault_token');
    }

    async request(endpoint, options = {}) {
        const url = API_BASE + endpoint;
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        const res = await fetch(url, { ...options, headers });
        const data = await res.json();
        if (res.status === 401) {
            this.clearToken();
            showScreen('auth-screen');
            throw new Error('Unauthorized');
        }
        if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
    }

    async register(email, password, name) {
        const data = await this.request('auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
        this.setToken(data.data.token);
        return data.data;
    }

    async login(email, password) {
        const data = await this.request('auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.setToken(data.data.token);
        return data.data;
    }

    async getMe() {
        const data = await this.request('auth/me');
        return data.data.user;
    }

    async getContainers() {
        const data = await this.request('containers');
        return data.data;
    }

    async createContainer(name, type, description) {
        const data = await this.request('containers', {
            method: 'POST',
            body: JSON.stringify({ name, type, description })
        });
        return data.data;
    }

    async updateContainer(id, fields) {
        const data = await this.request(`containers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(fields)
        });
        return data.data;
    }

    async deleteContainer(id) {
        return this.request(`containers/${id}`, { method: 'DELETE' });
    }

    async getItems(containerId) {
        const url = containerId ? `items?container_id=${containerId}` : 'items';
        const data = await this.request(url);
        return data.data;
    }

    async createItem(item) {
        const data = await this.request('items', {
            method: 'POST',
            body: JSON.stringify(item)
        });
        return data.data;
    }

    async updateItem(id, fields) {
        const data = await this.request(`items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(fields)
        });
        return data.data;
    }

    async deleteItem(id) {
        return this.request(`items/${id}`, { method: 'DELETE' });
    }

    async uploadPhoto(itemId, file) {
        const formData = new FormData();
        formData.append('item_id', itemId);
        formData.append('photo', file);
        const res = await fetch(API_BASE + 'photos', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.data;
    }

    async uploadContainerPhoto(containerId, file) {
        const formData = new FormData();
        formData.append('container_id', containerId);
        formData.append('photo', file);
        const res = await fetch(API_BASE + 'photos', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data.data;
    }

    async deletePhoto(imageId) {
        return this.request('photos', {
            method: 'DELETE',
            body: JSON.stringify({ image_id: imageId })
        });
    }

    async search(query) {
        const data = await this.request(`search?q=${encodeURIComponent(query)}`);
        return data.data;
    }

    async trackEvent(eventName, eventData) {
        return this.request('analytics', {
            method: 'POST',
            body: JSON.stringify({ event_name: eventName, event_data: eventData })
        });
    }

    async getContainerTree() {
        const data = await this.request('containers/tree');
        return data.data;
    }

    async getSubscription() {
        const data = await this.request('payments?action=status');
        return data.data;
    }

    async createPayment(returnUrl) {
        const data = await this.request('payments', {
            method: 'POST',
            body: JSON.stringify({ action: 'create', return_url: returnUrl })
        });
        return data.data;
    }
}

const api = new VaultAPI();
