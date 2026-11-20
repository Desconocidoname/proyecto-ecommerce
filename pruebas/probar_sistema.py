#!/usr/bin/env python3
"""Prueba integral del sistema Retención (solo librería estándar de Python).

Revisa contenedores, red, puertos, seguridad del login, la base de datos y,
sobre todo, que la IA prediga de verdad: compara contra la respuesta real,
predice clientes que no existen en la base y reacciona a los cambios.

Uso (con el sistema encendido, desde la raíz del repositorio):
    python3 pruebas/probar_sistema.py

Pide la contraseña del administrador sin mostrarla. No lee ni imprime secretos.
"""
import getpass
import http.cookiejar
import json
import subprocess
import time
import urllib.error
import urllib.request

URL = "http://localhost:3000"
resultados = []


def prueba(nombre, ok, detalle=""):
    resultados.append(ok)
    print(f"  [{'PASA' if ok else 'FALLA'}] {nombre}" + (f"  ·  {detalle}" if detalle else ""))


def seccion(titulo):
    print(f"\n== {titulo} ==")


def sh(comando):
    r = subprocess.run(comando, shell=True, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()


def sql(consulta):
    _, salida = sh(f"docker compose exec -T db sh -c 'psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -At -F \"|\"' <<'SQL'\n{consulta}\nSQL")
    return salida


cookies = http.cookiejar.CookieJar()
navegador = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))


def api(metodo, ruta, cuerpo=None, con_sesion=True):
    abridor = navegador if con_sesion else urllib.request.build_opener()
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    peticion = urllib.request.Request(URL + ruta, data=datos, method=metodo,
                                      headers={"Content-Type": "application/json"} if datos else {})
    inicio = time.perf_counter()
    try:
        r = abridor.open(peticion, timeout=120)
        codigo, texto = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        codigo, texto = e.code, e.read().decode()
    except Exception as e:  # sin conexión
        return 0, {"error": str(e)}, 0
    ms = (time.perf_counter() - inicio) * 1000
    try:
        return codigo, json.loads(texto), ms
    except ValueError:
        return codigo, texto, ms


def main():
    print("Prueba integral · Retención (Equipo Ecommerce)")

    # ---------------------------------------------------------------- 1
    seccion("1. Contenedores y red")
    _, salida = sh("docker compose ps --format '{{.Service}}|{{.State}}|{{.Health}}'")
    estados = {l.split("|")[0]: l.split("|")[1:] for l in salida.splitlines() if "|" in l}
    for servicio in ["db", "ml-service", "backend", "frontend"]:
        estado = estados.get(servicio)
        sano = bool(estado) and estado[0] == "running" and (servicio == "frontend" or estado[1] == "healthy")
        prueba(f"{servicio} encendido", sano, " ".join(estado) if estado else "no existe")
    _, red = sh("docker network inspect churn-net --format '{{range .Containers}}{{.Name}} {{end}}'")
    prueba("Los 4 contenedores están en la red churn-net", all(s in red for s in ["db", "ml-service", "backend", "frontend"]), red)
    _, servicios = sh("docker compose --profile training config --services")
    prueba("Existen los 5 servicios (training se ejecuta bajo demanda)", len(servicios.split()) == 5, " ".join(servicios.split()))

    seccion("2. Puertos (solo el frontend debe estar abierto)")
    for puerto, nombre in [(4000, "backend"), (8000, "servicio de IA")]:
        try:
            urllib.request.urlopen(f"http://localhost:{puerto}", timeout=2)
            abierto = True
        except urllib.error.HTTPError:
            abierto = True
        except Exception:
            abierto = False
        prueba(f"El {nombre} NO es accesible desde la laptop (puerto {puerto})", not abierto)
    codigo, salud, _ = api("GET", "/api/health", con_sesion=False)
    prueba("El frontend llega al backend por /api", codigo == 200, json.dumps(salud))

    # ---------------------------------------------------------------- 3
    seccion("3. Servicio de IA")
    _, s = sh("docker compose exec -T ml-service python -c \"import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read().decode())\"")
    try:
        ia = json.loads(s)
    except ValueError:
        ia = {}
    prueba("Modelo cargado", ia.get("modelLoaded") is True, f"versión {ia.get('modelVersion')}")
    prueba("Misma versión de scikit-learn al entrenar y al servir", ia.get("versionesCompatibles") is True,
           f"{ia.get('sklearnModelo')} / {ia.get('sklearnServicio')}")

    # ---------------------------------------------------------------- 4
    seccion("4. Seguridad del inicio de sesión")
    codigo, _, _ = api("GET", "/api/resumen", con_sesion=False)
    prueba("Sin sesión no se ven los datos", codigo == 401, f"HTTP {codigo}")
    email = input("  Correo del administrador (ADMIN_EMAIL de tu .env): ").strip()
    password = getpass.getpass("  Contraseña del administrador (no se muestra): ")
    codigo, _, _ = api("POST", "/api/auth/login", {"email": email, "password": password + "x"}, con_sesion=False)
    prueba("Contraseña incorrecta es rechazada", codigo == 401, f"HTTP {codigo}")
    codigo, r, _ = api("POST", "/api/auth/login", {"email": email, "password": password})
    prueba("Contraseña correcta da acceso", codigo == 200, f"HTTP {codigo}")
    if codigo != 200:
        print("\n  No se pudo iniciar sesión; el resto de las pruebas necesita la sesión.")
        return

    # ---------------------------------------------------------------- 5
    seccion("5. Base de datos y predicción masiva")
    fila = sql("SELECT (SELECT COUNT(*) FROM customers), (SELECT COUNT(*) FROM v_ultima_prediccion), "
               "(SELECT string_agg(version || ' umbral ' || threshold, ', ') FROM model_versions);").split("|")
    prueba("50,000 clientes cargados", fila[0] == "50000", fila[0])
    prueba("50,000 clientes con predicción", len(fila) > 1 and fila[1] == "50000", fila[1] if len(fila) > 1 else "")
    print(f"  Modelo registrado: {fila[2] if len(fila) > 2 else '?'}")

    # ---------------------------------------------------------------- 6
    seccion("6. ¿La IA acierta? Predicción contra la respuesta real")
    m = sql("""
        SELECT SUM((e.riesgo=1 AND p.churn_label=1)::int), SUM((e.riesgo=0 AND p.churn_label=1)::int),
               SUM((e.riesgo=1 AND p.churn_label=0)::int), SUM((e.riesgo=0 AND p.churn_label=0)::int)
        FROM v_entrenamiento e JOIN v_ultima_prediccion p USING (customer_id);""").split("|")
    if len(m) == 4 and all(x.isdigit() for x in m):
        vp, fp, fn, vn = map(int, m)
        precision, recall = vp / (vp + fp), vp / (vp + fn)
        f1 = 2 * precision * recall / (precision + recall)
        print(f"  Riesgo real y detectado: {vp:,} · Falsas alarmas: {fp:,} · No detectados: {fn:,} · Bien descartados: {vn:,}")
        print(f"  Precisión {precision:.3f} · Recall {recall:.3f} · F1 {f1:.3f}  (incluye clientes de entrenamiento)")
        prueba("La IA supera a la regla manual (F1 0.626)", f1 > 0.626, f"F1 {f1:.3f}")
        prueba("No es una copia de la respuesta (F1 < 0.99: sin fuga de datos)", f1 < 0.99)
    else:
        prueba("Matriz de confusión", False, " ".join(m))
    _, meta = sh("docker compose exec -T ml-service python -c \"import json; m=json.load(open('/models/metadata.json')); print(json.dumps(m['metricas_test']))\"")
    print(f"  Métricas oficiales en 10,000 clientes que el modelo NUNCA vio: {meta}")

    # ---------------------------------------------------------------- 7
    seccion("7. ¿Es IA o un SELECT? Predicción de un cliente que NO existe")
    codigo, cliente, _ = api("GET", "/api/clientes/CUST-013446")
    variables = cliente.get("variables", {}) if isinstance(cliente, dict) else {}
    prueba("Se cargan las 30 variables de CUST-013446", len(variables) == 30, f"{len(variables)} variables")
    _, base, ms = api("POST", "/api/simulador", variables)
    print(f"  CUST-013446 real: {base.get('probabilidad_riesgo')} · {base.get('clase_etiqueta')} · {base.get('tiempo_ms')} ms en el modelo")
    inventado = {**variables, "age": 33, "country": "Mexico", "satisfaction_score": 1, "complaint_count": 9,
                 "return_count": 12, "total_purchases": 7, "total_spent_usd": 2345.67, "tenure_months": 4}
    _, r1, _ = api("POST", "/api/simulador", inventado)
    existe = sql("SELECT COUNT(*) FROM customers WHERE age=33 AND country='Mexico' AND satisfaction_score=1 "
                 "AND complaint_count=9 AND return_count=12 AND total_purchases=7 AND total_spent_usd=2345.67;")
    prueba("El cliente inventado no existe en la base", existe == "0", f"coincidencias: {existe}")
    prueba("Aun así la IA estima su riesgo", r1.get("status") == "success",
           f"{r1.get('probabilidad_riesgo')} · {r1.get('clase_etiqueta')}")

    seccion("8. ¿Reacciona al comportamiento del cliente?")
    feliz = {**variables, "satisfaction_score": 5, "complaint_count": 0, "return_count": 0}
    _, r2, _ = api("POST", "/api/simulador", feliz)
    p0, p2 = base.get("probabilidad_riesgo"), r2.get("probabilidad_riesgo")
    prueba("Satisfacción 5 y sin quejas ni devoluciones baja el riesgo", None not in (p0, p2) and p2 < p0, f"{p0} -> {p2}")
    serie = []
    for s in range(1, 6):
        _, r, _ = api("POST", "/api/simulador", {**variables, "satisfaction_score": s})
        serie.append(r.get("probabilidad_riesgo"))
    print(f"  Riesgo de CUST-013446 con satisfacción 1..5: {serie}")
    numeros = all(isinstance(x, (int, float)) for x in serie)
    prueba("Más satisfacción, menos riesgo (tendencia)", numeros and serie[0] > serie[-1])

    seccion("9. Entradas inválidas (RNF-02)")
    codigo, r, _ = api("POST", "/api/simulador", {**variables, "satisfaction_score": 9})
    prueba("Satisfacción = 9 es rechazada con 422", codigo == 422, f"{r.get('error', {}).get('message')} · rango {r.get('error', {}).get('rango')}")
    codigo, _, _ = api("POST", "/api/simulador", {**variables, "age": "abc"})
    prueba("Edad = 'abc' es rechazada", codigo == 422, f"HTTP {codigo}")
    codigo, salud, _ = api("GET", "/api/health", con_sesion=False)
    prueba("El sistema sigue funcionando después de los errores", codigo == 200)

    seccion("10. Página pública del cupón")
    codigo, _, _ = api("GET", "/api/publico/cupon/VUELVE-ZZZZZ", con_sesion=False)
    prueba("Un código que no existe da 404", codigo == 404, f"HTTP {codigo}")
    codigo, _, _ = api("GET", "/api/publico/cupon/x'%20OR%20'1'='1", con_sesion=False)
    prueba("Un intento de inyección SQL da 404", codigo == 404, f"HTTP {codigo}")
    codigo, r, _ = api("GET", "/cupon/VUELVE-ZZZZZ", con_sesion=False)
    prueba("La ruta /cupon/... la sirve el frontend", codigo == 200)

    seccion("11. Tiempos de respuesta")
    _, _, ms = api("POST", "/api/simulador", variables)
    prueba("Una predicción tarda menos de 3 s (RF-02)", ms < 3000, f"{ms:.0f} ms")
    _, _, ms = api("GET", "/api/resumen")
    prueba("El Resumen carga en menos de 2 s (RF-04)", ms < 2000, f"{ms:.0f} ms")

    total, pasan = len(resultados), sum(resultados)
    print(f"\nResultado: {pasan} de {total} pruebas pasan." + ("" if pasan == total else " Revisa las que dicen FALLA."))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nPrueba cancelada.")
    except Exception as error:  # cualquier fallo inesperado se reporta sin ocultarlo
        print(f"\n[ERROR] La prueba se detuvo: {error!r}")
        print(f"Pasaron {sum(resultados)} de {len(resultados)} pruebas antes del error.")
