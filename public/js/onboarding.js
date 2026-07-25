let currentSlide = 0;

function initOnboarding() {
    const onboarding = document.getElementById('onboarding');
    if (!onboarding) return;
    if (localStorage.getItem('vault_onboarding_done')) {
        onboarding.style.display = 'none';
        return false;
    }
    onboarding.style.display = 'flex';
    return true;
}

function nextSlide() {
    const slides = document.querySelectorAll('.onboarding-slide');
    const dots = document.querySelectorAll('.onboarding-dots .dot');
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    currentSlide++;
    if (currentSlide < slides.length) {
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }
}

function completeOnboarding() {
    localStorage.setItem('vault_onboarding_done', '1');
    document.getElementById('onboarding').style.display = 'none';
    api.trackEvent('onboarding_complete');
    showScreen('auth-screen');
}
