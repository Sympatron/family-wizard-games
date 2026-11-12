import {watchDeployment} from './shared/deploy-watch.js';

const container = document.querySelector('#games');
try {
    const response = await fetch('./games.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Der Spielekatalog konnte nicht geladen werden.');
    const games = await response.json();
    container.replaceChildren();
    if (!games.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Noch keine Spiele vorhanden.';
        container.append(empty);
    }
    for (const game of games) {
        const link = document.createElement('a');
        link.className = 'game-card';
        link.href = `./games/${encodeURIComponent(game.id)}/`;
        const icon = document.createElement('span');
        icon.className = 'game-icon';
        icon.textContent = game.icon;
        const title = document.createElement('strong');
        title.textContent = game.title;
        const description = document.createElement('small');
        description.textContent = game.description;
        link.append(icon, title, description);
        container.append(link);
    }
} catch (error) {
    container.textContent = error.message;
}
watchDeployment();
