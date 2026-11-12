const ENVIRONMENT = new URL('../', import.meta.url).pathname.includes('/preview/') ? 'preview' : 'stable';
const PREFIX = `family-wizard-games:mock:v1:${ENVIRONMENT}`;
const DEFAULT_USERS = Object.freeze([
    {id: 'alex', name: 'Alex', role: 'user'},
    {id: 'sam', name: 'Sam', role: 'user'},
    {id: 'manager', name: 'Manager', role: 'manager'}
]);
const clone = value => structuredClone(value);
const stateObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export class MockBackend {
    constructor({gameId, initialGame, reducer, storage = globalThis.localStorage, users = DEFAULT_USERS}) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId)) throw new Error('Invalid gameId');
        if (!stateObject(initialGame) || typeof reducer !== 'function') throw new TypeError('Invalid mock game configuration');
        this.kind = 'mock';
        this.gameId = gameId;
        this.initialGame = clone(initialGame);
        this.reducer = reducer;
        this.storage = storage;
        this.users = users.map(user => ({...user}));
        this.listeners = new Set();
        globalThis.window?.addEventListener('storage', event => {
            if (event.key?.startsWith(PREFIX)) this.notify();
        });
    }

    key(type, userId = this.user().id) {
        return `${PREFIX}:${type}:${userId}`;
    }

    user() {
        const id = this.storage.getItem(`${PREFIX}:active-user`);
        return this.users.find(user => user.id === id) ?? this.users[0];
    }

    getUsers() {
        return clone(this.users);
    }

    setUser(userId) {
        if (!this.users.some(user => user.id === userId)) throw new Error('Unknown mock user');
        this.storage.setItem(`${PREFIX}:active-user`, userId);
        this.notify();
    }

    coins() {
        const value = this.storage.getItem(this.key('coins'));
        return value === null ? 250 : Number(value);
    }

    setCoins(amount) {
        if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('Coins must be a nonnegative integer');
        this.storage.setItem(this.key('coins'), String(amount));
        this.notify();
    }

    record() {
        const stored = this.storage.getItem(this.key(`game:${this.gameId}`));
        return stored === null ? {revision: 0, game: clone(this.initialGame), operations: [], message: ''} : JSON.parse(stored);
    }

    saveRecord(record) {
        this.storage.setItem(this.key(`game:${this.gameId}`), JSON.stringify(record));
    }

    snapshot(record = this.record()) {
        return clone({user: this.user(), coins: this.coins(), game: record.game, revision: record.revision, message: record.message ?? ''});
    }

    async load() {
        return this.snapshot();
    }

    controls() {
        return JSON.parse(this.storage.getItem(this.key('controls')) ?? '{"delayMs":0,"failNext":false}');
    }

    setControls(controls) {
        const delayMs = Number(controls.delayMs);
        if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 10000) throw new RangeError('Delay must be 0–10000 ms');
        this.storage.setItem(this.key('controls'), JSON.stringify({delayMs, failNext: Boolean(controls.failNext)}));
        this.notify();
    }

    async execute(action) {
        if (!action || typeof action.id !== 'string' || !action.id || typeof action.type !== 'string' || !action.type) throw new TypeError('Invalid game action');
        const controls = this.controls();
        if (controls.delayMs) await new Promise(resolve => setTimeout(resolve, controls.delayMs));
        if (controls.failNext) {
            this.setControls({...controls, failNext: false});
            throw new Error('Simulierter Netzwerkfehler.');
        }
        const record = this.record();
        const request = JSON.stringify(action);
        const existing = record.operations.find(entry => entry.id === action.id);
        if (existing) {
            if (existing.request !== request) throw new Error('Action ID already used for a different request');
            return clone(existing.response);
        }
        const result = await this.reducer(clone(record.game), clone(action), {user: clone(this.user()), coins: this.coins()});
        if (!result || !stateObject(result.game)) throw new TypeError('Game reducer must return {game, coins?, message?}');
        const nextCoins = result.coins === undefined ? this.coins() : result.coins;
        if (!Number.isSafeInteger(nextCoins) || nextCoins < 0) throw new RangeError('Invalid mock coin balance');
        record.game = clone(result.game);
        record.revision++;
        record.message = String(result.message ?? '');
        this.storage.setItem(this.key('coins'), String(nextCoins));
        const response = this.snapshot(record);
        record.operations.push({id: action.id, request, response});
        record.operations = record.operations.slice(-100);
        this.saveRecord(record);
        this.notify();
        return response;
    }

    setGameState(game) {
        if (!stateObject(game)) throw new TypeError('Game state must be a JSON object');
        const record = this.record();
        record.game = clone(game);
        record.revision++;
        record.operations = [];
        record.message = '';
        this.saveRecord(record);
        this.notify();
    }

    reset() {
        this.storage.removeItem(this.key(`game:${this.gameId}`));
        this.storage.removeItem(this.key('coins'));
        this.storage.removeItem(this.key('controls'));
        this.notify();
    }

    exportScenario() {
        return JSON.stringify({gameId: this.gameId, userId: this.user().id, coins: this.coins(), game: this.record().game}, null, 2);
    }

    importScenario(source) {
        const scenario = typeof source === 'string' ? JSON.parse(source) : source;
        if (scenario.gameId !== this.gameId || !stateObject(scenario.game)) throw new Error('Invalid game scenario');
        if (!Number.isSafeInteger(scenario.coins) || scenario.coins < 0) throw new Error('Invalid scenario coins');
        this.setGameState(scenario.game);
        this.setCoins(scenario.coins);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        for (const listener of this.listeners) listener();
    }
}
