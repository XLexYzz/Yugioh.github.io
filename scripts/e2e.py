"""Pruebas de extremo a extremo de la web (Playwright).

Uso:
    py -3 -m http.server 8765          # en la raíz del repo, en otra terminal
    py -3 scripts/e2e.py               # capturas en %TEMP%/xyz-e2e (o la ruta de XYZ_E2E_OUT)

Requiere: pip install playwright && playwright install chromium
La prueba del validador consulta la API pública de YGOPRODeck (necesita conexión).
"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright

BASE = os.environ.get("XYZ_E2E_BASE", "http://localhost:8765")
OUT = os.environ.get("XYZ_E2E_OUT", os.path.join(tempfile.gettempdir(), "xyz-e2e"))
os.makedirs(OUT, exist_ok=True)
fallos = []
errores = []

def check(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond:
        fallos.append(msg)

def nueva(browser, **kw):
    ctx = browser.new_context(service_workers="block", **kw)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errores.append(f"{page.url}: {e}"))
    page.on("console", lambda m: m.type == "error" and errores.append(f"{page.url}: {m.text}"))
    return ctx, page

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ---------- Escritorio ----------
    ctx, page = nueva(b, viewport={"width": 1280, "height": 860})

    for ruta in ["index.html", "porfolio/torneos.html", "porfolio/banlist.html", "porfolio/reglas.html",
                 "porfolio/tierlist.html", "porfolio/mazos.html", "porfolio/herramientas.html",
                 "porfolio/estadisticas.html", "porfolio/editor.html"]:
        page.goto(f"{BASE}/{ruta}")
        page.wait_for_load_state("networkidle")
        check(page.locator(".palette-trigger").count() == 1, f"botón de búsqueda en {ruta}")
        sw = page.evaluate("document.documentElement.scrollWidth - innerWidth")
        check(sw <= 0, f"sin scroll horizontal en {ruta} ({sw})")
    page.goto(f"{BASE}/index.html"); page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{OUT}/d-index.png", full_page=False)

    # Paleta
    page.keyboard.press("Control+k")
    page.keyboard.type("yubel")
    page.wait_for_timeout(600)
    titulos = page.locator(".palette-list [role=option] .palette-title").all_inner_texts()
    check(titulos[:1] == ["Yubel"], f"paleta encuentra Yubel ({titulos[:3]})")
    page.screenshot(path=f"{OUT}/d-paleta.png")
    page.keyboard.press("Enter")
    page.wait_for_url("**/tierlist.html?q=*")
    page.wait_for_load_state("networkidle")
    check("tierlist.html?q=Yubel" in page.url, "paleta navega a la tierlist")
    visibles = page.evaluate("[...document.querySelectorAll('.tierlist-category figure')].filter(f=>!f.hidden && !f.closest('[hidden]')).length")
    check(visibles == 1, f"tierlist filtrada por ?q= ({visibles})")

    # Tiermaker
    page.goto(f"{BASE}/porfolio/tierlist.html#crea"); page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.removeItem('xyz-tiermaker-v1')")
    page.reload(); page.wait_for_load_state("networkidle")
    total = page.locator(".tm-pool .tm-chip").count()
    check(total == 77, f"77 decks en el pool ({total})")
    page.evaluate("window.scrollTo({top: document.querySelector('#tiermaker').getBoundingClientRect().top + scrollY - 160, behavior: 'instant'})")
    page.wait_for_timeout(300)
    chip = page.locator(".tm-pool .tm-chip").first
    destino = page.locator(".tm-drop[data-row='0']")
    cb = chip.bounding_box(); db = destino.bounding_box()
    page.mouse.move(cb["x"] + 20, cb["y"] + 20); page.mouse.down()
    page.mouse.move(cb["x"] + 60, cb["y"] - 40, steps=5)
    page.mouse.move(db["x"] + 80, db["y"] + 40, steps=10)
    page.mouse.up()
    check(page.locator(".tm-drop[data-row='0'] .tm-chip").count() == 1, "arrastrar deck al nivel S")
    # Teclado
    page.locator(".tm-pool .tm-chip").first.focus()
    page.keyboard.press("3")
    check(page.locator(".tm-drop[data-row='2'] .tm-chip").count() == 1, "tecla 3 mueve al nivel B")
    # Tocar y colocar
    page.locator(".tm-pool .tm-chip").first.click()
    page.locator(".tm-drop[data-row='4']").click(position={"x": 400, "y": 30})
    check(page.locator(".tm-drop[data-row='4'] .tm-chip").count() == 1, "clic + clic coloca en D")
    page.click("#tmPreset")
    check(page.locator(".tm-pool .tm-chip").count() == 0, "preset reparte todos los decks")
    page.reload(); page.wait_for_load_state("networkidle")
    check(page.locator(".tm-pool .tm-chip").count() == 0, "tierlist se guarda al recargar")
    with page.expect_download() as dl:
        page.click("#tmExport")
    ruta_png = f"{OUT}/tierlist-export.png"
    dl.value.save_as(ruta_png)
    check(os.path.getsize(ruta_png) > 50000, f"PNG exportado ({os.path.getsize(ruta_png)} bytes)")
    page.locator("#crea").screenshot(path=f"{OUT}/d-tiermaker.png")

    # Visor con zoom (torneos)
    page.goto(f"{BASE}/porfolio/torneos.html"); page.wait_for_load_state("networkidle")
    page.locator(".image-grid figure").first.click()
    page.wait_for_timeout(400)
    img = page.locator(".modal-content img")
    bb = img.bounding_box()
    page.mouse.move(bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2)
    page.mouse.wheel(0, -300)
    page.wait_for_timeout(300)
    tr = img.evaluate("e => e.style.transform")
    check("scale(1.2" in tr or "scale(1.44" in tr or "scale(1.7" in tr, f"zoom con rueda ({tr})")
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(200)
    check(img.evaluate("e => e.style.transform").endswith("scale(1)"), "zoom se reinicia al cambiar de imagen")
    page.keyboard.press("Escape")

    # Reglas
    page.goto(f"{BASE}/porfolio/reglas.html#fases"); page.wait_for_load_state("networkidle")
    page.click("#phaseNext"); page.click("#phaseNext"); page.click("#phaseNext")
    check("BATTLE PHASE" in page.inner_text("#phasePanel").upper(), "siguiente fase lleva a Battle")
    page.locator(".zone[data-zone='gy']").click()
    check("CEMENTERIO" in page.inner_text("#fieldInfo").upper(), "zona del campo muestra el Cementerio")
    for _ in range(10):
        page.locator(".quiz-options button").first.click()
        page.locator(".quiz-next").click()
    check(page.locator(".quiz-score").count() == 1, "test completo muestra la nota")
    page.locator("#fases").screenshot(path=f"{OUT}/d-fases.png")
    page.locator("#campo").screenshot(path=f"{OUT}/d-campo.png")

    # Herramientas
    page.goto(f"{BASE}/porfolio/herramientas.html"); page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.removeItem('xyz-lp-v1')"); page.reload(); page.wait_for_load_state("networkidle")
    for k in ["1", "0", "0", "0"]:
        page.click(f".lp-keypad [data-k='{k}']")
    page.click(".lp-player[data-p='0'] .lp-minus")
    page.wait_for_timeout(1200)
    check(page.inner_text(".lp-player[data-p='0'] .lp-value") == "7000", "restar 1000 deja 7000")
    page.click(".lp-chips [data-set='500']")
    page.click(".lp-player[data-p='1'] .lp-plus")
    page.click(".lp-player[data-p='1'] [data-op='half']")
    page.wait_for_timeout(1200)
    check(page.inner_text(".lp-player[data-p='1'] .lp-value") == "4250", "sumar 500 y mitad = 4250")
    page.click("#lpUndo"); page.wait_for_timeout(1200)
    check(page.inner_text(".lp-player[data-p='1'] .lp-value") == "8500", "deshacer vuelve a 8500")
    page.locator("#vida").screenshot(path=f"{OUT}/d-vida.png")
    page.click("#dieRoll"); page.wait_for_timeout(1200)
    check(page.inner_text("#chanceResult").startswith("Dado: "), "dado da resultado")
    page.click("#coinFlip"); page.wait_for_timeout(1400)
    check(page.inner_text("#chanceResult") in ("Cara", "Cruz"), "moneda da resultado")
    check(page.inner_text("#oddsBig").startswith("33,8"), f"40/3/5 = 33,8 % ({page.inner_text('#oddsBig')})")
    page.fill("#oddsK", "9"); page.wait_for_timeout(100)
    check(page.inner_text("#oddsBig").startswith("74,2"), f"9 copias = 74,2 % ({page.inner_text('#oddsBig')})")
    page.locator("#azar").screenshot(path=f"{OUT}/d-azar.png")
    page.locator("#probabilidad").screenshot(path=f"{OUT}/d-prob.png")

    # Validador con ydke y error
    page.goto(f"{BASE}/porfolio/mazos.html"); page.wait_for_load_state("networkidle")
    page.fill("#deckText", "hola")
    page.click("#deckCheck")
    check("No se ha podido leer" in page.inner_text("#deckVerdict"), "mensaje si el texto no es un mazo")
    # 39 cartas: debe avisar del mínimo de 40 y de Magic Cylinder (limitada a 1 en XYZ)
    ids = ([14558127] * 3 + [89631139] * 3 + [46986414] * 3 + [5318639] * 2 + [83764718] + [24224830] * 2
           + [97268402] * 2 + [10045474] * 2 + [65681983] * 3 + [40640057] * 3 + [70095154] * 3
           + [32807846] * 3 + [73915051] * 3 + [62279055] * 3 + [43898403] * 3)
    page.fill("#deckText", "#main\n" + "\n".join(map(str, ids)) + "\n#extra\n86066372\n!side\n")
    page.click("#deckCheck")
    page.wait_for_selector(".deck-verdict.is-good, .deck-verdict.is-bad", timeout=20000)
    page.wait_for_timeout(1500)
    check("40" in page.inner_text("#deckIssues") and "Magic Cylinder" in page.inner_text("#deckIssues"), "detecta mínimo de 40 y carta limitada")
    print("   veredicto:", page.inner_text("#deckVerdict").replace("\n", " | "), "| main:", len(ids))
    print("   problemas:", page.inner_text("#deckIssues").replace("\n", " | "))
    url = page.url
    check("#ydke=" in url, "URL compartible con #ydke=")
    page.goto(url); page.reload(); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".deck-tile", timeout=20000)
    check(page.locator(".deck-tile").count() > 5, "el mazo se carga desde el enlace")
    page.screenshot(path=f"{OUT}/d-mazos.png", full_page=True)

    # Portada con datos de torneos
    page.goto(f"{BASE}/index.html"); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".champ-name")
    check("REVOLVER" in page.inner_text("#heroChamp").upper(), "portada: campeón del último torneo")
    check(page.locator("#heroRanking li").count() == 5, "portada: top 5 por victorias")
    check(page.locator("#recentTours .recent-tour").count() == 3, "portada: tres últimos torneos")

    # Estadísticas
    page.goto(f"{BASE}/porfolio/estadisticas.html#mazo=Kaiba"); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".deck-panel-title h2")
    check(page.inner_text(".deck-panel-title h2").strip().upper() == "KAIBA", "estadísticas: abre la ficha desde el enlace")
    check(page.inner_text(".scoreline .score-w") == "11" and page.inner_text(".scoreline .score-l") == "7", "estadísticas: Kaiba 11-7")
    filas = page.locator("#statsBody tr[data-mazo]").count()
    check(filas > 50, f"estadísticas: ranking con {filas} mazos")
    page.uncheck("#statsPending")
    check(page.locator("#statsBody .pending").count() == 0, "estadísticas: ocultar mazos por confirmar")
    page.fill("#statsSearch", "nash")
    check(page.locator("#statsBody tr[data-mazo]").count() == 1, "estadísticas: buscador")
    page.locator("#statsBody tr[data-mazo]").first.click()
    check(page.inner_text(".deck-panel-title h2").strip().upper() == "NASH", "estadísticas: clic en una fila abre su ficha")
    page.screenshot(path=f"{OUT}/d-estadisticas.png")

    # Torneos: cuadro generado
    page.goto(f"{BASE}/porfolio/torneos.html"); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".bracket")
    check(page.locator(".tour-picker [role=tab]").count() == 13, "torneos: 13 torneos en el selector")
    page.click("#tab-1")
    check("KAIBA" in page.inner_text(".tour-champ").upper(), "torneos: campeón del torneo 1")
    check(page.locator(".round").count() == 4 and page.locator(".match").count() == 15, "torneos: cuadro de 16 con 15 partidas")
    page.locator(".slot[data-mazo='Kaiba']").first.hover()
    check(page.locator(".slot.is-trace").count() == 4, "torneos: rastro de Kaiba en sus 4 partidas")
    page.click("#tab-3")
    check(page.locator(".match").count() == 31, "torneos: cuadro de 32")
    page.click("[data-original]")
    page.wait_for_timeout(400)
    check(page.locator(".modal.active").count() == 1, "torneos: abre la imagen original")
    page.keyboard.press("Escape")
    page.screenshot(path=f"{OUT}/d-torneos.png")

    # Tierlist con récord
    page.goto(f"{BASE}/porfolio/tierlist.html"); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".deck-record")
    kaiba = page.locator(".tierlist-grid figure", has_text="Kaiba").first.locator(".deck-record").inner_text()
    check(kaiba.startswith("11–7"), f"tierlist: récord de Kaiba ({kaiba})")
    ancho = page.evaluate("(() => { const i = document.querySelector('.tierlist-grid img[src*=dino]'); return Math.round(i.getBoundingClientRect().width / i.getBoundingClientRect().height * 100); })()")
    check(abs(ancho - round(1024 / 330 * 100)) < 4, f"tierlist: imagen de Dino sin recortar (proporción {ancho / 100})")

    # Editor: confirmar un nombre y previsualizar
    page.goto(f"{BASE}/porfolio/editor.html"); page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.removeItem('xyz-torneos-borrador'); localStorage.removeItem('xyz-usar-borrador')")
    page.reload(); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".ed-name")
    antes = page.locator(".ed-name.is-pending").count()
    form = page.locator(".ed-name[data-nombre='?Rata gris']")
    form.locator("input").fill("Rata de prueba")
    form.locator("button[type=submit]").click()
    check(page.locator(".ed-name.is-pending").count() == antes - 1, "editor: confirmar un nombre lo quita de pendientes")
    page.check("#edPreview")
    page.goto(f"{BASE}/porfolio/estadisticas.html#mazo=Rata%20de%20prueba"); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".deck-panel-title h2")
    check("RATA DE PRUEBA" in page.inner_text(".deck-panel-title h2").upper(), "editor: la web usa el borrador al previsualizar")
    check("borrador" in page.inner_text("#statsNotice"), "editor: aviso de borrador en estadísticas")
    page.goto(f"{BASE}/porfolio/editor.html#torneo-2"); page.wait_for_load_state("networkidle")
    page.wait_for_selector(".ed-match")
    check(page.locator(".ed-match").count() == 15, "editor: abre el torneo del enlace")
    page.locator(".ed-match").first.locator(".ed-win[data-g='1']").click()
    check(page.locator("#edProblems li").count() >= 1, "editor: avisa si el ganador no coincide con la ronda siguiente")
    with page.expect_download() as dl:
        page.click("#edDownload")
    ruta_json = f"{OUT}/torneos-editor.json"
    dl.value.save_as(ruta_json)
    import json
    exportado = json.load(open(ruta_json, encoding="utf-8"))
    check(len(exportado["torneos"]) == 13, "editor: descarga un torneos.json válido")
    page.on("dialog", lambda d: d.accept())
    page.click("#edReset")
    page.wait_for_timeout(500)
    check(page.evaluate("localStorage.getItem('xyz-torneos-borrador')") is None, "editor: descartar borrador")
    ctx.close()

    # ---------- Móvil ----------
    ctx, page = nueva(b, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    for ruta, nombre in [("index.html", "m-index"), ("porfolio/herramientas.html", "m-herr"),
                         ("porfolio/reglas.html", "m-reglas"), ("porfolio/tierlist.html#crea", "m-tier"),
                         ("porfolio/mazos.html", "m-mazos"), ("porfolio/estadisticas.html", "m-estadisticas"),
                         ("porfolio/torneos.html", "m-torneos"), ("porfolio/editor.html", "m-editor")]:
        page.goto(f"{BASE}/{ruta}"); page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
        sw = page.evaluate("document.documentElement.scrollWidth - innerWidth")
        check(sw <= 0, f"móvil sin scroll horizontal en {ruta} ({sw})")
        page.screenshot(path=f"{OUT}/{nombre}.png", full_page=True)
    # Menú en móvil
    page.goto(f"{BASE}/index.html"); page.wait_for_load_state("networkidle")
    check(not page.locator("#menu").is_visible(), "móvil: menú cerrado al entrar")
    page.click(".menu-toggle")
    check(page.locator("#menu").is_visible(), "móvil: el botón Menú abre la navegación")
    page.keyboard.press("Escape")
    check(not page.locator("#menu").is_visible(), "móvil: Escape cierra el menú")
    # Tocar y colocar en móvil
    page.goto(f"{BASE}/porfolio/tierlist.html#crea"); page.wait_for_load_state("networkidle")
    page.click("#tmClear")
    page.locator(".tm-pool .tm-chip").first.tap()
    page.locator(".tm-drop[data-row='1']").tap(position={"x": 200, "y": 20})
    check(page.locator(".tm-drop[data-row='1'] .tm-chip").count() == 1, "móvil: tocar y colocar")
    ctx.close()
    b.close()

print("\nErrores de consola:", errores or "ninguno")
print("FALLOS:", fallos or "ninguno")
sys.exit(1 if fallos or errores else 0)
