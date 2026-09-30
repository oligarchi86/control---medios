# Control de Medios — PWA

Versión pensada para utilizarse desde un teléfono Android sin Android Studio.

## Incluye
- Inventario de equipos
- Nombre, categoría, modelo, marca, número de serie e inventario
- Ubicación y estado
- Fotografía desde cámara/galería
- Búsqueda
- Escaneo QR/código de barras cuando el navegador lo soporta
- Préstamos y devoluciones
- Historial de movimientos
- Exportación CSV
- Copia de seguridad JSON
- Instalación como PWA

## Acceso inicial
Usuario: admin
Contraseña: admin123

IMPORTANTE: esta versión guarda los datos localmente en el navegador del teléfono. Para varios teléfonos y sincronización central hace falta publicar un servidor/API. No uses la contraseña de demostración en producción.

## Cómo ponerla en el teléfono
Una PWA necesita servirse por HTTPS (o desde localhost) para que la cámara, instalación y service worker funcionen correctamente. Puedes subir esta carpeta a un servicio de hosting estático HTTPS. Después abre la dirección en Chrome Android y selecciona "Instalar aplicación" / "Añadir a pantalla de inicio".

La siguiente fase puede conectar esta PWA a un servidor central con usuarios, PostgreSQL, sincronización entre teléfonos y panel web.
