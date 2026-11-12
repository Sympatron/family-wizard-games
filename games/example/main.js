import {createGameBackend} from '../../shared/backend.js';
import {mountDevtools} from '../../shared/devtools.js';
import {watchDeployment} from '../../shared/deploy-watch.js';

const backend = createGameBackend({
    gameId: 'example',
    initialGame: {stars: 0, power: 1},
    reducer(game, action, {coins}) {
        switch (action.type) {
            case 'collect':
                return {game: {...game, stars: game.stars + game.power}, message: 'Stern gesammelt!'};
            case 'upgrade': {
                const price = game.power * 10;
                if (coins < price) throw new Error('Nicht genug Münzen.');
                return {game: {...game, power: game.power + 1}, coins: coins - price, message: 'Stärke verbessert!'};
            }
            default:
                throw new Error('Unbekannte Aktion.');
        }
    }
});

const buttons = [document.querySelector('#collect'), document.querySelector('#upgrade')];
const message = document.querySelector('#message');
async function render() {
    const state = await backend.load();
    document.querySelector('#player').textContent = `${state.user.name} · ${state.user.role}`;
    document.querySelector('#stars').textContent = state.game.stars;
    document.querySelector('#power').textContent = state.game.power;
    document.querySelector('#coins').textContent = state.coins;
    document.querySelector('#upgrade').textContent = `Stärke verbessern (${state.game.power * 10} Münzen)`;
}
async function perform(type) {
    buttons.forEach(button => button.disabled = true);
    try {
        const state = await backend.execute({id: crypto.randomUUID(), type});
        message.textContent = state.message;
        await render();
    } catch (error) {
        message.textContent = error.message;
    } finally {
        buttons.forEach(button => button.disabled = false);
    }
}
document.querySelector('#collect').addEventListener('click', () => void perform('collect'));
document.querySelector('#upgrade').addEventListener('click', () => void perform('upgrade'));
backend.subscribe(() => void render());
if (backend.kind === 'mock') mountDevtools(backend);
watchDeployment();
void render();
