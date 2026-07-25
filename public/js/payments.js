async function upgradeToPro() {
    try {
        const data = await api.createPayment(window.location.origin + '/app.html');
        if (data.payment_url) {
            window.location.href = data.payment_url;
        }
    } catch (err) {
        alert('Ошибка: ' + err.message);
    }
}

function showPaywall() {
    document.getElementById('paywallModal').style.display = 'flex';
}
