// LoadingScreen.js
class LoadingScreen {
    constructor() {
        this.loadingScreen = document.getElementById('loading-screen');
        this.progressBar = document.getElementById('loading-progress');
        this.loadingText = document.getElementById('loading-text');
    }

    show() {
        this.loadingScreen.style.display = 'flex';
        this.loadingScreen.classList.remove('fade-out');
    }

    hide() {
        this.loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            this.loadingScreen.style.display = 'none';
        }, 500);
    }

    updateProgress(progress, message = null) {
        if (this.progressBar) {
            this.progressBar.style.width = `${progress}%`;
        }
        if (message && this.loadingText) {
            this.loadingText.textContent = message;
        }
    }

    setError(message) {
        if (this.loadingText) {
            this.loadingText.textContent = message;
            this.loadingText.classList.add('error');
        }
    }
}
