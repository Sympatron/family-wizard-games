export class RealBackend {
    constructor({gameId, csrfToken, apiRoot = '/api/games'}) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId)) throw new Error('Invalid game ID');
        this.kind = 'real';
        this.gameId = gameId;
        this.apiRoot = apiRoot.replace(/\/$/, '');
        this.csrfToken = csrfToken;
    }

    url(suffix) {
        return `${this.apiRoot}/${encodeURIComponent(this.gameId)}/${suffix}`;
    }

    async request(url, options = {}) {
        const response = await fetch(url, {credentials: 'same-origin', cache: 'no-store', ...options});
        if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
        return response.json();
    }

    load() {
        return this.request(this.url('state'));
    }

    execute(action) {
        if (typeof this.csrfToken !== 'string' || !this.csrfToken) throw new Error('Missing CSRF token');
        return this.request(this.url('actions'), {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRF-Token': this.csrfToken},
            body: JSON.stringify(action)
        });
    }
}
