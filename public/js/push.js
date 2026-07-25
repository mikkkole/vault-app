async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
    }
    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        return !!subscription;
    } catch {
        return false;
    }
}

async function requestPushPermission() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push not supported');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Permission denied');
    }
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(getVapidPublicKey())
    });
    await api.request('push.php', {
        method: 'POST',
        body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
                auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
            }
        })
    });
    updateNotificationButton();
    return true;
}

async function unsubscribePush() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            await api.request('push.php', {
                method: 'DELETE',
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
        }
        updateNotificationButton();
    } catch (err) {
        console.error('Push unsubscribe error:', err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function getVapidPublicKey() {
    return 'BEl62iUYgUivxvkvfb9fpxZ4bfYJqP2VkJWqD7Fh9y9JwGFnYbR0nJXnKxL3vI0vG2fJ0fJ1vJ3bJ4mK2gU';
}

async function updateNotificationButton() {
    const btn = document.getElementById('notificationToggle');
    if (!btn) return;
    try {
        const subscribed = await initPushNotifications();
        btn.textContent = subscribed ? 'Выключить уведомления' : 'Включить уведомления';
        btn.onclick = subscribed ? unsubscribePush : requestPushPermission;
    } catch {
        btn.textContent = 'Уведомления недоступны';
        btn.disabled = true;
    }
}
