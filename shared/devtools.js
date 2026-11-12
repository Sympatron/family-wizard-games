export function mountDevtools(backend, parent = document.body) {
    if (backend.kind !== 'mock') return () => {};
    const panel = document.createElement('details');
    panel.className = 'devtools';
    panel.innerHTML = `<summary title="Mock-Werkzeuge" aria-label="Mock-Werkzeuge"><span aria-hidden="true">☰</span></summary>
      <div class="devtools-content">
        <label>Benutzer<select data-user></select></label>
        <label>Münzen<input type="number" min="0" step="1" data-coins></label>
        <label>Antwortverzögerung (ms)<input type="number" min="0" max="10000" step="1" data-delay></label>
        <div class="devtools-actions"><button type="button" data-apply>Werte übernehmen</button><button type="button" data-fail>Fehler bei nächster Aktion</button></div>
        <label>Beliebiger Spielstand (JSON)<textarea spellcheck="false" data-state></textarea></label>
        <div class="devtools-actions"><button type="button" data-save>Spielstand setzen</button><button type="button" data-reset>Zurücksetzen</button></div>
        <label>Szenario importieren / exportieren<textarea spellcheck="false" data-scenario></textarea></label>
        <div class="devtools-actions"><button type="button" data-export>Exportieren</button><button type="button" data-import>Importieren</button></div>
        <div class="devtools-note" role="status" data-status>Änderungen werden nur lokal gespeichert.</div>
      </div>`;
    parent.append(panel);
    const get = key => panel.querySelector(`[data-${key}]`);
    const status = (message, error = false) => { get('status').textContent = message; get('status').classList.toggle('error', error); };
    for (const user of backend.getUsers()) {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (${user.role})`;
        get('user').append(option);
    }
    async function refresh() {
        const snapshot = await backend.load();
        get('user').value = snapshot.user.id;
        if (document.activeElement !== get('coins')) get('coins').value = snapshot.coins;
        if (document.activeElement !== get('state')) get('state').value = JSON.stringify(snapshot.game, null, 2);
        if (document.activeElement !== get('delay')) get('delay').value = backend.controls().delayMs;
    }
    function act(callback) {
        try { callback(); status('Gespeichert.'); } catch (error) { status(error.message, true); }
    }
    get('user').addEventListener('change', () => act(() => backend.setUser(get('user').value)));
    get('apply').addEventListener('click', () => act(() => {
        backend.setCoins(Number(get('coins').value));
        backend.setControls({delayMs: Number(get('delay').value), failNext: backend.controls().failNext});
    }));
    get('fail').addEventListener('click', () => act(() => backend.setControls({...backend.controls(), failNext: true})));
    get('save').addEventListener('click', () => act(() => backend.setGameState(JSON.parse(get('state').value))));
    get('reset').addEventListener('click', () => act(() => backend.reset()));
    get('export').addEventListener('click', () => { get('scenario').value = backend.exportScenario(); status('Szenario exportiert.'); });
    get('import').addEventListener('click', () => act(() => backend.importScenario(get('scenario').value)));
    const unsubscribe = backend.subscribe(() => void refresh());
    void refresh();
    return () => { unsubscribe(); panel.remove(); };
}
