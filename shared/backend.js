import {MockBackend} from './mock-backend.js';
import {RealBackend} from './real-backend.js';

export function createGameBackend({gameId, initialGame, reducer, mode = 'mock', csrfToken = '', apiRoot = '/api/games'} = {}) {
    if (mode === 'mock') return new MockBackend({gameId, initialGame, reducer});
    if (mode === 'real') return new RealBackend({gameId, csrfToken, apiRoot});
    throw new Error(`Unsupported backend mode: ${mode}`);
}
