export function watchDeployment({intervalMs = 8000} = {}) {
    const url = new URL('../version.json', import.meta.url);
    let revision = null;
    let stopped = false;
    async function check() {
        if (stopped || document.visibilityState === 'hidden') return;
        try {
            const response = await fetch(url, {cache: 'no-store'});
            if (!response.ok) return;
            const next = (await response.json()).revision;
            if (typeof next !== 'string') return;
            if (revision !== null && revision !== next) window.location.reload();
            revision = next;
        } catch { /* Deployment may be in progress or the device may be offline. */ }
    }
    const timer = setInterval(() => void check(), intervalMs);
    const onVisibility = () => void check();
    document.addEventListener('visibilitychange', onVisibility);
    void check();
    return () => {
        stopped = true;
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisibility);
    };
}
