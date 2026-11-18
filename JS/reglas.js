/* Reglas interactivas: fases del turno, mapa del campo y test. */
(() => {
    const $ = (id) => document.getElementById(id);

    /* ===========================
       FASES DEL TURNO
       =========================== */
    const FASES = [
        {
            nombre: 'Draw Phase',
            resumen: 'Robas 1 carta del Deck.',
            puntos: [
                'El jugador del turno roba 1 carta. Quien empieza el duelo no roba en su primer turno.',
                'Si tienes que robar y el Deck está vacío, pierdes el duelo.',
                'Ya se pueden activar Trampas y Mágicas Rápidas colocadas, y efectos rápidos de monstruos.',
            ],
        },
        {
            nombre: 'Standby Phase',
            resumen: 'Se resuelven los efectos que dicen “durante la Standby Phase”.',
            puntos: [
                'Aquí se pagan costes de mantenimiento y se aplican efectos que se activan en esta fase.',
                'Si no hay nada que resolver, se pasa directamente a la Main Phase 1.',
            ],
        },
        {
            nombre: 'Main Phase 1',
            resumen: 'La fase en la que montas tu jugada.',
            puntos: [
                '1 Invocación Normal o Colocación por turno (incluida la Invocación por Sacrificio).',
                'Invocaciones Especiales: Fusión, Sincronía, Xyz, Péndulo, Link y por efectos, sin límite salvo que una carta diga lo contrario.',
                'Activar Mágicas y efectos, colocar Mágicas y Trampas boca abajo.',
                'Cambiar la posición de batalla de cada monstruo una vez por turno, salvo el turno en que se invocó.',
            ],
        },
        {
            nombre: 'Battle Phase',
            resumen: 'Atacas con tus monstruos en Posición de Ataque.',
            puntos: [
                'No existe en el primer turno del duelo: quien empieza no puede atacar.',
                'Pasos: Start Step, Battle Step, Damage Step y End Step.',
                'Cada monstruo en Posición de Ataque puede declarar 1 ataque. Si el rival no tiene monstruos, el ataque es directo.',
                'Ataque contra Ataque: el de menor ATK se destruye y su dueño recibe la diferencia. Contra Defensa: si el ATK es mayor, se destruye el defensor sin daño; si es menor, el atacante recibe la diferencia.',
            ],
        },
        {
            nombre: 'Main Phase 2',
            resumen: 'Segunda oportunidad para jugar cartas después de atacar.',
            puntos: [
                'Puedes hacer lo mismo que en la Main Phase 1. La Invocación Normal sigue siendo una por turno: si la usaste antes de atacar, ya no tienes otra.',
                'Buen momento para colocar Trampas o hacer Invocaciones Especiales que defiendan tu campo.',
                'Solo existe si has entrado en la Battle Phase.',
            ],
        },
        {
            nombre: 'End Phase',
            resumen: 'Se cierra el turno.',
            puntos: [
                'Se resuelven los efectos que dicen “durante la End Phase”.',
                'Si tienes más de 6 cartas en la mano, descartas hasta quedarte con 6.',
                'Después empieza el turno del rival en su Draw Phase.',
            ],
        },
    ];

    const tabs = [...document.querySelectorAll('.phase-track [role="tab"]')];
    const panel = $('phasePanel');
    if (tabs.length && panel) {
        let actual = 0;
        function ir(i, foco) {
            actual = (i + FASES.length) % FASES.length;
            tabs.forEach((t, j) => {
                t.setAttribute('aria-selected', j === actual);
                t.tabIndex = j === actual ? 0 : -1;
                t.parentElement.classList.toggle('done', j < actual);
            });
            const f = FASES[actual];
            panel.setAttribute('aria-labelledby', tabs[actual].id);
            panel.innerHTML = `<h3>${f.nombre}</h3><p class="phase-sum">${f.resumen}</p><ul class="card-list">${f.puntos.map(p => `<li>${p}</li>`).join('')}</ul>`;
            panel.classList.remove('enter');
            void panel.offsetWidth;
            panel.classList.add('enter');
            $('phasePrev').disabled = actual === 0;
            $('phaseNext').textContent = actual === FASES.length - 1 ? 'Volver a empezar' : 'Siguiente fase';
            if (foco) tabs[actual].focus();
        }
        tabs.forEach((t, i) => {
            t.addEventListener('click', () => ir(i));
            t.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); ir(actual + 1, true); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); ir(actual - 1, true); }
                if (e.key === 'Home') { e.preventDefault(); ir(0, true); }
                if (e.key === 'End') { e.preventDefault(); ir(FASES.length - 1, true); }
            });
        });
        $('phasePrev').addEventListener('click', () => ir(actual - 1));
        $('phaseNext').addEventListener('click', () => ir(actual + 1));
        ir(0);
    }

    /* ===========================
       ZONAS DEL CAMPO
       =========================== */
    const ZONAS = {
        mmz: ['Zonas de Monstruo Principal', 'Cinco espacios para tus monstruos, boca arriba en Ataque o Defensa, o boca abajo en Defensa. Los monstruos de Fusión, Sincronía y Xyz que salen del Extra Deck pueden ir aquí directamente.'],
        emz: ['Zonas de Monstruo Extra', 'Las dos del centro son compartidas: cada duelista solo puede ocupar una. Los monstruos Link y los Péndulo boca arriba que salen del Extra Deck van aquí o a una zona a la que apunte una flecha Link.'],
        st: ['Zonas de Magia y Trampa', 'Para activar Mágicas o colocar Mágicas y Trampas boca abajo. Una Trampa no se puede activar el mismo turno en que se coloca (salvo que una carta lo permita).'],
        pendulum: ['Zonas de Péndulo', 'Son las zonas de Magia y Trampa de los extremos. Con una carta de Péndulo en cada una puedes hacer una Invocación por Péndulo por turno, de los Niveles que queden entre las dos escalas.'],
        field: ['Zona de Campo', 'Una Mágica de Campo por duelista. Si activas otra, la anterior va al Cementerio.'],
        gy: ['Cementerio', 'Cartas destruidas, usadas o descartadas, boca arriba. Cualquiera de los dos puede consultarlo en cualquier momento.'],
        banish: ['Cartas desterradas', 'Quedan fuera del juego, normalmente boca arriba. Algunos efectos pueden recuperarlas, pero no hay una zona fija en el tablero.'],
        deck: ['Deck', 'Tu Deck Principal de 40 a 60 cartas, boca abajo. Si tienes que robar y está vacío, pierdes.'],
        extra: ['Extra Deck', 'Hasta 15 monstruos de Fusión, Sincronía, Xyz y Link, más los Péndulo que vuelven aquí boca arriba al dejar el campo.'],
    };

    const zonas = document.querySelectorAll('.field-board .zone');
    const info = $('fieldInfo');

    // En pantallas estrechas el texto es más grande: lo comprime si no cabe en su casilla
    function ajustarTextos() {
        document.querySelectorAll('.field-board text').forEach(t => {
            t.removeAttribute('textLength');
            t.removeAttribute('lengthAdjust');
            const ancho = t.textContent === 'Monstruos' || t.textContent === 'Magia y Trampa' ? 170 : 74;
            if (t.getComputedTextLength() > ancho) {
                t.setAttribute('textLength', ancho);
                t.setAttribute('lengthAdjust', 'spacingAndGlyphs');
            }
        });
    }
    if (zonas.length) {
        document.fonts?.ready.then(ajustarTextos);
        matchMedia('(max-width: 560px)').addEventListener('change', ajustarTextos);
    }
    zonas.forEach(z => {
        const elegir = () => {
            zonas.forEach(o => o.classList.toggle('active', o === z));
            const [t, d] = ZONAS[z.dataset.zone];
            info.innerHTML = `<h3>${t}</h3><p>${d}</p>`;
        };
        z.addEventListener('click', elegir);
        z.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); }
        });
    });

    /* ===========================
       TEST
       =========================== */
    const PREGUNTAS = [
        { q: '¿Con cuántos Life Points empieza cada duelista?', o: ['4000', '8000', '10000'], a: 1, e: 'Cada duelista empieza con 8000 LP.' },
        { q: '¿Cuál es el mínimo de cartas del Deck Principal?', o: ['30', '40', '45'], a: 1, e: 'El Deck Principal tiene entre 40 y 60 cartas.' },
        { q: '¿Cuántas cartas puede tener el Extra Deck como máximo?', o: ['10', '15', '20'], a: 1, e: 'Extra Deck y Side Deck admiten hasta 15 cartas cada uno.' },
        { q: '¿Quien juega primero roba en su primer turno?', o: ['Sí', 'No'], a: 1, e: 'El jugador que empieza se salta el robo de su primer turno.' },
        { q: '¿Puede atacar quien empieza el duelo en su primer turno?', o: ['Sí, con monstruos invocados ese turno', 'No, no tiene Battle Phase'], a: 1, e: 'En el primer turno del duelo no hay Battle Phase.' },
        { q: '¿Cuántos sacrificios pide un monstruo de Nivel 7 para su Invocación por Sacrificio?', o: ['1', '2', '3'], a: 1, e: 'Nivel 5 y 6 piden 1 sacrificio; Nivel 7 o más, 2.' },
        { q: '¿Cuántas Invocaciones Normales o Colocaciones puedes hacer por turno?', o: ['1', '2', 'Las que quieras'], a: 0, e: 'Solo una, salvo que un efecto te dé más.' },
        { q: 'Al final de tu turno tienes 8 cartas en la mano. ¿Qué pasa?', o: ['Nada', 'Descartas hasta tener 6', 'Descartas hasta tener 5'], a: 1, e: 'En la End Phase descartas hasta quedarte con 6.' },
        { q: '¿Puedes activar una Mágica Rápida desde la mano en el turno del rival?', o: ['Sí', 'No, primero hay que colocarla'], a: 1, e: 'En el turno del rival solo puedes activarla si estaba colocada, y no el mismo turno en que la colocaste.' },
        { q: 'Una carta está Limitada. ¿Cuántas copias puedes llevar entre Main, Extra y Side?', o: ['1 en total', '1 en cada deck', '2 en total'], a: 0, e: 'El límite cuenta todas las copias juntas: Main, Extra y Side.' },
        { q: '¿Qué Spell Speed tiene una Trampa de Contraefecto?', o: ['1', '2', '3'], a: 2, e: 'Las Contraefecto son Spell Speed 3: solo otra de velocidad 3 puede responderles.' },
        { q: 'Desde la Regla Maestra 2020, ¿dónde puede ir un monstruo de Fusión invocado desde el Extra Deck?', o: ['Solo en una Zona de Monstruo Extra', 'En una Zona de Monstruo Principal o en una Extra', 'Solo donde apunte una flecha Link'], a: 1, e: 'Fusión, Sincronía y Xyz pueden ir a cualquier Zona de Monstruo Principal; Link y Péndulo necesitan la Zona Extra o una zona apuntada.' },
    ];

    const quiz = $('quiz');
    if (quiz) {
        const BEST_KEY = 'xyz-quiz-mejor';
        let orden = [];
        let i = 0;
        let aciertos = 0;

        function barajar() {
            orden = PREGUNTAS.map((_, k) => k).sort(() => Math.random() - 0.5).slice(0, 10);
            i = 0;
            aciertos = 0;
        }

        function pregunta() {
            const p = PREGUNTAS[orden[i]];
            quiz.innerHTML = `
                <div class="quiz-progress" aria-hidden="true"><span style="width:${(i / orden.length) * 100}%"></span></div>
                <p class="quiz-count">Pregunta ${i + 1} de ${orden.length}</p>
                <h3 class="quiz-q" tabindex="-1">${p.q}</h3>
                <div class="quiz-options">${p.o.map((o, k) => `<button type="button" data-k="${k}">${o}</button>`).join('')}</div>
                <p class="quiz-feedback" role="status" aria-live="polite"></p>
                <button type="button" class="button button-primary quiz-next" hidden>${i === orden.length - 1 ? 'Ver resultado' : 'Siguiente pregunta'}</button>`;
            quiz.querySelectorAll('.quiz-options button').forEach(b => b.addEventListener('click', () => responder(Number(b.dataset.k))));
            quiz.querySelector('.quiz-next').addEventListener('click', () => {
                i++;
                if (i < orden.length) pregunta(); else final();
                quiz.querySelector('h3, .quiz-score strong')?.focus();
            });
        }

        function responder(k) {
            const p = PREGUNTAS[orden[i]];
            const bien = k === p.a;
            if (bien) aciertos++;
            quiz.querySelectorAll('.quiz-options button').forEach((b, j) => {
                b.disabled = true;
                if (j === p.a) b.classList.add('is-right');
                else if (j === k) b.classList.add('is-wrong');
            });
            const fb = quiz.querySelector('.quiz-feedback');
            fb.className = `quiz-feedback ${bien ? 'ok' : 'ko'}`;
            fb.textContent = `${bien ? 'Correcto.' : 'No es correcto.'} ${p.e}`;
            const next = quiz.querySelector('.quiz-next');
            next.hidden = false;
            next.focus();
        }

        function final() {
            const mejor = Math.max(aciertos, XYZ.leer(BEST_KEY, 0));
            XYZ.guardar(BEST_KEY, mejor);
            const nota = aciertos === orden.length ? 'Pleno. Estás listo para el torneo.'
                : aciertos >= 7 ? 'Muy bien. Repasa las que fallaste y a jugar.'
                : 'Repasa las fases y las zonas de arriba y vuelve a intentarlo.';
            quiz.innerHTML = `
                <div class="quiz-score">
                    <strong tabindex="-1">${aciertos}<small>/${orden.length}</small></strong>
                    <p>${nota}</p>
                    <p class="quiz-best">Tu mejor resultado: ${mejor}/${orden.length}</p>
                    <button type="button" class="button button-primary">Repetir el test</button>
                </div>`;
            quiz.querySelector('button').addEventListener('click', () => { barajar(); pregunta(); });
        }

        barajar();
        pregunta();
    }
})();
