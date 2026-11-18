/* Herramientas de duelo: puntos de vida, moneda y dado, probabilidad de robo.
   El temporizador está en script.js. */
(() => {
    const $ = (id) => document.getElementById(id);
    const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ===========================
       PUNTOS DE VIDA
       =========================== */
    const LP_KEY = 'xyz-lp-v1';
    const INICIAL = 8000;
    const players = [...document.querySelectorAll('.lp-player')];
    const amount = $('lpAmount');

    if (players.length === 2 && amount) {
        const guardado = XYZ.leer(LP_KEY, null);
        let estado = guardado || { lp: [INICIAL, INICIAL], nombres: ['Duelista 1', 'Duelista 2'], log: [] };
        const mostrado = [...estado.lp];

        players.forEach((el, i) => { el.querySelector('.lp-name').value = estado.nombres[i]; });

        function animar(i) {
            const out = players[i].querySelector('.lp-value');
            const desde = mostrado[i];
            const hasta = estado.lp[i];
            if (reducirMovimiento || desde === hasta) {
                mostrado[i] = hasta;
                out.textContent = hasta;
                return;
            }
            const t0 = performance.now();
            const dur = Math.min(900, 250 + Math.abs(hasta - desde) / 8);
            const paso = (t) => {
                const k = Math.min(1, (t - t0) / dur);
                const e = 1 - Math.pow(1 - k, 3);
                mostrado[i] = Math.round(desde + (hasta - desde) * e);
                out.textContent = mostrado[i];
                if (k < 1) requestAnimationFrame(paso);
            };
            requestAnimationFrame(paso);
        }

        function pintar(golpe) {
            players.forEach((el, i) => {
                const lp = estado.lp[i];
                el.querySelector('.lp-bar span').style.width = `${Math.min(100, lp / INICIAL * 100)}%`;
                el.classList.toggle('is-low', lp > 0 && lp <= 2000);
                el.classList.toggle('is-out', lp === 0);
                animar(i);
            });
            if (golpe) {
                const el = players[golpe.p];
                el.classList.remove('hit', 'heal');
                void el.offsetWidth;
                el.classList.add(golpe.tipo);
            }
            const log = $('lpLog');
            log.innerHTML = estado.log.slice().reverse().map(e =>
                `<li><span class="${e.delta < 0 ? 'neg' : 'pos'}">${XYZ.escapar(e.nombre)} ${e.delta < 0 ? '−' : '+'}${Math.abs(e.delta)}</span> <span>${e.antes} → ${e.despues}</span></li>`).join('');
            $('lpCount').textContent = estado.log.length;
            $('lpEmpty').hidden = estado.log.length > 0;
            $('lpUndo').disabled = !estado.log.length;
            XYZ.guardar(LP_KEY, estado);
        }

        function cantidad() {
            return Math.min(999999, parseInt(amount.value.replace(/\D/g, ''), 10) || 0);
        }

        function aplicar(p, op) {
            const antes = estado.lp[p];
            let despues = antes;
            if (op === 'half') despues = Math.ceil(antes / 2);
            else {
                const n = cantidad();
                if (!n) {
                    amount.focus();
                    mostrarToast('Escribe primero una cantidad');
                    return;
                }
                despues = op === '-' ? Math.max(0, antes - n) : antes + n;
            }
            if (despues === antes) return;
            estado.lp[p] = despues;
            estado.log.push({ p, nombre: estado.nombres[p], delta: despues - antes, antes, despues });
            amount.value = '';
            pintar({ p, tipo: despues < antes ? 'hit' : 'heal' });
            if (despues === 0) {
                mostrarToast(`${estado.nombres[1 - p]} gana el duelo`);
            }
        }

        players.forEach((el, p) => {
            el.querySelectorAll('[data-op]').forEach(btn => btn.addEventListener('click', () => aplicar(p, btn.dataset.op)));
            el.querySelector('.lp-name').addEventListener('input', (e) => {
                estado.nombres[p] = e.target.value.trim() || `Duelista ${p + 1}`;
                XYZ.guardar(LP_KEY, estado);
            });
        });

        document.querySelectorAll('.lp-keypad [data-k]').forEach(btn => btn.addEventListener('click', () => {
            const k = btn.dataset.k;
            amount.value = k === 'back' ? amount.value.slice(0, -1) : (amount.value + k).replace(/^0+/, '').slice(0, 6);
        }));
        document.querySelectorAll('.lp-chips [data-set]').forEach(btn => btn.addEventListener('click', () => {
            amount.value = btn.dataset.set;
        }));
        amount.addEventListener('input', () => { amount.value = amount.value.replace(/\D/g, '').slice(0, 6); });

        $('lpUndo').addEventListener('click', () => {
            const ultimo = estado.log.pop();
            if (!ultimo) return;
            estado.lp[ultimo.p] = ultimo.antes;
            pintar();
            mostrarToast('Último cambio deshecho');
        });
        $('lpReset').addEventListener('click', () => {
            if (estado.log.length && !confirm('¿Empezar un duelo nuevo? Los dos vuelven a 8000.')) return;
            estado = { lp: [INICIAL, INICIAL], nombres: estado.nombres, log: [] };
            pintar();
        });

        players.forEach((el, i) => { el.querySelector('.lp-value').textContent = estado.lp[i]; });
        pintar();
    }

    /* ===========================
       MONEDA Y DADO
       =========================== */
    const coin = $('coin');
    const die = $('die');
    const resultado = $('chanceResult');
    const historial = [];
    const azar = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

    function anotar(texto) {
        historial.unshift(texto);
        historial.length = Math.min(historial.length, 8);
        resultado.textContent = texto;
        $('chanceLog').textContent = historial.length > 1 ? `Anteriores: ${historial.slice(1).join(', ')}` : '';
    }

    if (coin) {
        let giro = 0;
        $('coinFlip').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const cara = azar(2) === 0;
            giro += 1800 + (cara ? 0 : 180) - (giro % 360);
            coin.style.transform = `rotateY(${giro}deg)`;
            btn.disabled = true;
            setTimeout(() => {
                anotar(cara ? 'Cara' : 'Cruz');
                btn.disabled = false;
            }, reducirMovimiento ? 0 : 1100);
        });
    }

    if (die) {
        $('dieRoll').addEventListener('click', (e) => {
            const v = azar(6) + 1;
            const btn = e.currentTarget;
            btn.disabled = true;
            if (reducirMovimiento) {
                die.dataset.v = v;
                anotar(`Dado: ${v}`);
                btn.disabled = false;
                return;
            }
            die.classList.add('rolling');
            let n = 0;
            const t = setInterval(() => {
                die.dataset.v = azar(6) + 1;
                if (++n >= 8) {
                    clearInterval(t);
                    die.dataset.v = v;
                    die.classList.remove('rolling');
                    anotar(`Dado: ${v}`);
                    btn.disabled = false;
                }
            }, 90);
        });
    }

    /* ===========================
       PROBABILIDAD (HIPERGEOMÉTRICA)
       =========================== */
    const form = $('oddsForm');
    if (form) {
        const comb = (n, k) => {
            if (k < 0 || k > n) return 0;
            let r = 1;
            for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
            return r;
        };
        const exacta = (N, K, n, k) => comb(K, k) * comb(N - K, n - k) / comb(N, n);
        const num = (id, min, max) => Math.max(min, Math.min(max, parseInt($(id).value, 10) || 0));
        const pct = (p) => {
            const v = p * 100;
            return `${v >= 99.95 ? '100' : v < 0.05 && v > 0 ? '<0,1' : v.toFixed(1).replace('.', ',').replace(',0', '')} %`;
        };

        function calcular() {
            const N = num('oddsN', 1, 60);
            const K = Math.min(num('oddsK', 0, 60), N);
            const n = Math.min(num('oddsH', 1, 60), N);
            const x = num('oddsX', 1, 60);
            let p = 0;
            for (let k = x; k <= Math.min(K, n); k++) p += exacta(N, K, n, k);
            $('oddsBig').textContent = pct(p);
            $('oddsText').textContent = `Robando ${n} de ${N} cartas con ${K} ${K === 1 ? 'copia' : 'copias'}, la probabilidad de ver al menos ${x} es ${pct(p)}.`;
            const filas = [];
            for (let k = 0; k <= Math.min(K, n, 5); k++) {
                const pk = exacta(N, K, n, k);
                filas.push(`<div class="odds-row ${k >= x ? 'is-hit' : ''}"><span>${k} ${k === 1 ? 'copia' : 'copias'}</span><div><i style="width:${(pk * 100).toFixed(1)}%"></i></div><b>${pct(pk)}</b></div>`);
            }
            $('oddsBars').innerHTML = filas.join('');
            form.querySelectorAll('[data-h]').forEach(b => b.classList.toggle('active', Number(b.dataset.h) === n));
        }

        form.addEventListener('input', calcular);
        form.addEventListener('submit', (e) => e.preventDefault());
        form.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => {
            $('oddsH').value = b.dataset.h;
            calcular();
        }));
        calcular();
    }
})();
