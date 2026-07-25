document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authTabs = document.querySelectorAll('.auth-tab');
    const authError = document.getElementById('auth-error');

    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            authTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const target = this.dataset.tab;
            loginForm.style.display = target === 'login' ? 'flex' : 'none';
            registerForm.style.display = target === 'register' ? 'flex' : 'none';
            authError.style.display = 'none';
        });
    });

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        authError.style.display = 'none';
        const email = this.email.value.trim();
        const password = this.password.value;
        try {
            await api.login(email, password);
            initApp();
        } catch (err) {
            authError.textContent = err.message;
            authError.style.display = 'block';
        }
    });

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        authError.style.display = 'none';
        const name = this.name.value.trim();
        const email = this.email.value.trim();
        const password = this.password.value;
        try {
            await api.register(email, password, name);
            initApp();
        } catch (err) {
            authError.textContent = err.message;
            authError.style.display = 'block';
        }
    });
});

function logout() {
    api.clearToken();
    localStorage.removeItem('vault_onboarding_done');
    closeModal('settingsModal');
    showScreen('auth-screen');
}
