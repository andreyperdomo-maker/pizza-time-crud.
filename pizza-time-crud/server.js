// ============================================================
//  PIZZA TIME - Servidor (backend)
//  Usa solo módulos que ya trae Node.js: no hay que instalar nada.
//  Los datos se guardan en un archivo JSON (data/pizzas.json).
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ARCHIVO_DATOS = path.join(__dirname, 'data', 'pizzas.json');
const CARPETA_PUBLICA = path.join(__dirname, 'public');
const TAMANOS_VALIDOS = ['Personal', 'Mediana', 'Grande'];

// Tipos de archivo que el servidor sabe entregar al navegador
const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ------------------------------------------------------------
//  1. Manejo del archivo de datos
// ------------------------------------------------------------

// Pizzas de ejemplo que se cargan la primera vez
const PIZZAS_INICIALES = [
  { id: 1, nombre: 'Margarita', ingredientes: 'Salsa de tomate, mozzarella y albahaca', tamano: 'Mediana', precio: 28000, disponible: true },
  { id: 2, nombre: 'Hawaiana', ingredientes: 'Jamón, piña y queso mozzarella', tamano: 'Grande', precio: 38000, disponible: true },
  { id: 3, nombre: 'Pepperoni', ingredientes: 'Pepperoni, queso mozzarella y orégano', tamano: 'Personal', precio: 18000, disponible: true },
  { id: 4, nombre: 'Vegetariana', ingredientes: 'Champiñones, pimentón, cebolla y aceitunas', tamano: 'Mediana', precio: 30000, disponible: false },
];

function leerPizzas() {
  if (!fs.existsSync(ARCHIVO_DATOS)) {
    guardarPizzas(PIZZAS_INICIALES);
    return [...PIZZAS_INICIALES];
  }
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO_DATOS, 'utf8'));
  } catch (error) {
    console.error('El archivo de datos está dañado, se reinicia con los datos de ejemplo.');
    guardarPizzas(PIZZAS_INICIALES);
    return [...PIZZAS_INICIALES];
  }
}

function guardarPizzas(pizzas) {
  fs.mkdirSync(path.dirname(ARCHIVO_DATOS), { recursive: true });
  fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(pizzas, null, 2), 'utf8');
}

// ------------------------------------------------------------
//  2. Validación: revisa que los datos recibidos sean correctos
//     Devuelve { error } si algo está mal, o { pizza } si todo bien.
// ------------------------------------------------------------
function validarPizza(datos) {
  const nombre = String(datos.nombre ?? '').trim();
  const ingredientes = String(datos.ingredientes ?? '').trim();
  const tamano = String(datos.tamano ?? '').trim();
  const precio = Number(datos.precio);

  if (nombre.length < 2 || nombre.length > 40) {
    return { error: 'El nombre debe tener entre 2 y 40 caracteres.' };
  }
  if (ingredientes.length < 3 || ingredientes.length > 120) {
    return { error: 'Los ingredientes deben tener entre 3 y 120 caracteres.' };
  }
  if (!TAMANOS_VALIDOS.includes(tamano)) {
    return { error: 'El tamaño debe ser Personal, Mediana o Grande.' };
  }
  if (!Number.isFinite(precio) || precio <= 0 || precio > 500000) {
    return { error: 'El precio debe ser un número mayor que 0 y menor o igual a 500.000.' };
  }
  return { pizza: { nombre, ingredientes, tamano, precio: Math.round(precio), disponible: Boolean(datos.disponible) } };
}

// ------------------------------------------------------------
//  3. Funciones de ayuda para responder y leer peticiones
// ------------------------------------------------------------
function responderJSON(res, codigo, contenido) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(contenido));
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let texto = '';
    req.on('data', (parte) => {
      texto += parte;
      if (texto.length > 1e6) {           // máximo 1 MB
        reject(new Error('Petición demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(texto ? JSON.parse(texto) : {}); }
      catch { reject(new Error('El cuerpo no es un JSON válido')); }
    });
  });
}

// ------------------------------------------------------------
//  4. API REST: aquí está el CRUD
//     POST   /api/pizzas      -> CREATE
//     GET    /api/pizzas      -> READ (lista, con ?buscar=texto opcional)
//     GET    /api/pizzas/:id  -> READ (una sola)
//     PUT    /api/pizzas/:id  -> UPDATE
//     DELETE /api/pizzas/:id  -> DELETE
// ------------------------------------------------------------
async function manejarApi(req, res, url) {
  const partes = url.pathname.split('/').filter(Boolean); // ['api','pizzas', '3']
  const id = partes[2] !== undefined ? Number(partes[2]) : null;
  const pizzas = leerPizzas();

  // ----- READ: lista de pizzas -----
  if (req.method === 'GET' && id === null) {
    const buscar = (url.searchParams.get('buscar') || '').toLowerCase().trim();
    const resultado = buscar
      ? pizzas.filter((p) => (p.nombre + ' ' + p.ingredientes).toLowerCase().includes(buscar))
      : pizzas;
    return responderJSON(res, 200, resultado);
  }

  // ----- CREATE: agregar una pizza nueva -----
  if (req.method === 'POST' && id === null) {
    const { error, pizza } = validarPizza(await leerCuerpo(req));
    if (error) return responderJSON(res, 400, { error });
    const nuevoId = pizzas.reduce((mayor, p) => Math.max(mayor, p.id), 0) + 1;
    const nueva = { id: nuevoId, ...pizza };
    pizzas.push(nueva);
    guardarPizzas(pizzas);
    return responderJSON(res, 201, nueva);
  }

  // Las siguientes acciones necesitan un id válido
  if (id === null || !Number.isInteger(id)) {
    return responderJSON(res, 400, { error: 'Falta un id válido en la dirección.' });
  }
  const posicion = pizzas.findIndex((p) => p.id === id);
  if (posicion === -1) {
    return responderJSON(res, 404, { error: 'La pizza no existe.' });
  }

  // ----- READ: una sola pizza -----
  if (req.method === 'GET') {
    return responderJSON(res, 200, pizzas[posicion]);
  }

  // ----- UPDATE: editar una pizza -----
  if (req.method === 'PUT') {
    const { error, pizza } = validarPizza(await leerCuerpo(req));
    if (error) return responderJSON(res, 400, { error });
    pizzas[posicion] = { id, ...pizza };
    guardarPizzas(pizzas);
    return responderJSON(res, 200, pizzas[posicion]);
  }

  // ----- DELETE: eliminar una pizza -----
  if (req.method === 'DELETE') {
    const [eliminada] = pizzas.splice(posicion, 1);
    guardarPizzas(pizzas);
    return responderJSON(res, 200, { mensaje: `Se eliminó la pizza ${eliminada.nombre}.` });
  }

  return responderJSON(res, 405, { error: 'Método no permitido.' });
}

// ------------------------------------------------------------
//  5. Archivos de la página (HTML, CSS, JS)
// ------------------------------------------------------------
function servirArchivo(res, rutaUrl) {
  const nombre = rutaUrl === '/' ? '/index.html' : rutaUrl;
  const ruta = path.normalize(path.join(CARPETA_PUBLICA, nombre));

  // Seguridad: no permitir salir de la carpeta "public"
  if (!ruta.startsWith(CARPETA_PUBLICA + path.sep)) {
    res.writeHead(403); return res.end('Acceso denegado');
  }
  fs.readFile(ruta, (error, contenido) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Página no encontrada');
    }
    res.writeHead(200, { 'Content-Type': TIPOS_MIME[path.extname(ruta)] || 'application/octet-stream' });
    res.end(contenido);
  });
}

// ------------------------------------------------------------
//  6. Servidor principal
// ------------------------------------------------------------
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/pizzas')) {
      await manejarApi(req, res, url);
    } else {
      servirArchivo(res, url.pathname);
    }
  } catch (error) {
    console.error(error.message);
    responderJSON(res, 400, { error: error.message });
  }
});

servidor.listen(PORT, () => {
  console.log(`🍕 Pizza Time funcionando en http://localhost:${PORT}`);
});
