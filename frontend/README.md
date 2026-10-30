# frontend

Dashboard del administrador en **React + Vite**, servido con **Nginx** en `http://localhost:3000`.

**Responsable:** David Mendoza Avalos · **Respaldo:** Rebeca Fields Gómez

## Qué va aquí

- Pantallas: Login (con recuperación simulada), Resumen, Clientes, Alertas y Simulador.
- Ventanas de Opciones: cupón por correo, QR para tienda física y contactar cliente.
- `Dockerfile` en dos etapas (compilar con Node y servir con Nginx) y `nginx.conf` que reenvía `/api/` a `http://backend:4000`.

## Reglas

- Solo llama al backend (`/api/*`). Nada de lógica de IA ni acceso a la base de datos.
- Usa los formatos de respuesta acordados con el backend; mientras la API no exista, trabaja con datos simulados que respeten ese formato.
- Referencia visual: el prototipo de Figma (enlace en el README principal).
