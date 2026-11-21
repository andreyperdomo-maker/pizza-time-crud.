// ============================================================
//  PIZZA TIME - Lógica de la página (frontend)
//  Aquí están las 4 operaciones del CRUD:
//    CREATE -> crearPizza()      READ   -> leerPizzas()
//    UPDATE -> actualizarPizza() DELETE -> eliminarPizza()
// ============================================================

const API = '/api/pizzas';

// ----- Elementos de la página que vamos a usar -----
const formulario = document.getElementById('form-pizza');
const campoNombre = document.getElementById('nombre');
const campoIngredientes = document.getElementById('ingredientes');
const campoTamano = document.getElementById('tamano');
const campoPrecio = document.getElementById('precio');
const campoDisponible = document.getElementById('disponible');
const botonGuardar = document.getElementById('boton-guardar');
const botonCancelar = document.getElementById('boton-cancelar');
const tituloFormulario = document.getElementById('titulo-formulario');
const errorFormulario = document.getElementById('error-formulario');
const tablaPizzas = document.getElementById('tabla-pizzas');
const mensajeVacio = document.getElementById('mensaje-vacio');
const resumen = document.getElementById('resumen');
const buscador = document.getElementById('buscador');
const aviso = document.getElementById('aviso');

// Guardamos la lista actual y el id de la pizza que se está editando (null = modo "agregar")
let pizzasEnPantalla = [];
let idEditando = null;

// ------------------------------------------------------------
//  Función de ayuda: hace la petición al servidor y avisa si hubo error
// ------------------------------------------------------------
async function pedir(url, opciones = {}) {
  const respuesta = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || 'Ocurrió un error inesperado.');
  return datos;
}

// ============================================================
//  READ - Leer las pizzas del servidor y mostrarlas
// ============================================================
async function leerPizzas() {
  const texto = buscador.value.trim();
  const url = texto ? `${API}?buscar=${encodeURIComponent(texto)}` : API;
  pizzasEnPantalla = await pedir(url);
  pintarTabla(pizzasEnPantalla);
}

// ============================================================
//  CREATE - Enviar una pizza nueva al servidor
// ============================================================
async function crearPizza(pizza) {
  await pedir(API, { method: 'POST', body: JSON.stringify(pizza) });
  mostrarAviso('✅ Pizza agregada al menú');
}

// ============================================================
//  UPDATE - Enviar los cambios de una pizza existente
// ============================================================
async function actualizarPizza(id, pizza) {
  await pedir(`${API}/${id}`, { method: 'PUT', body: JSON.stringify(pizza) });
  mostrarAviso('✏️ Pizza actualizada');
}

// ============================================================
//  DELETE - Borrar una pizza (pide confirmación antes)
// ============================================================
async function eliminarPizza(id) {
  const pizza = pizzasEnPantalla.find((p) => p.id === id);
  if (!confirm(`¿Seguro que quieres eliminar la pizza "${pizza.nombre}"?`)) return;

  try {
    await pedir(`${API}/${id}`, { method: 'DELETE' });
    if (idEditando === id) salirDelModoEdicion();   // si la estaban editando, limpiamos el formulario
    mostrarAviso('🗑️ Pizza eliminada');
    await leerPizzas();
  } catch (error) {
    mostrarAviso('⚠️ ' + error.message);
  }
}

// ------------------------------------------------------------
//  Dibujar la tabla (se usa textContent para evitar que alguien
//  escriba código HTML malicioso en un campo)
// ------------------------------------------------------------
function pintarTabla(pizzas) {
  tablaPizzas.replaceChildren();

  pizzas.forEach((pizza) => {
    const fila = document.createElement('tr');

    // Columna 1: nombre + ingredientes
    const celdaNombre = document.createElement('td');
    const nombre = document.createElement('span');
    nombre.className = 'nombre-pizza';
    nombre.textContent = pizza.nombre;
    const ingredientes = document.createElement('span');
    ingredientes.className = 'ingredientes';
    ingredientes.textContent = pizza.ingredientes;
    celdaNombre.append(nombre, ingredientes);

    // Columna 2: tamaño
    const celdaTamano = document.createElement('td');
    celdaTamano.textContent = pizza.tamano;

    // Columna 3: precio con formato de pesos colombianos
    const celdaPrecio = document.createElement('td');
    celdaPrecio.textContent = formatearPrecio(pizza.precio);

    // Columna 4: estado (disponible / agotada)
    const celdaEstado = document.createElement('td');
    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta ' + (pizza.disponible ? 'si' : 'no');
    etiqueta.textContent = pizza.disponible ? 'Disponible' : 'Agotada';
    celdaEstado.append(etiqueta);

    // Columna 5: botones Editar y Eliminar
    const celdaAcciones = document.createElement('td');
    const contenedorBotones = document.createElement('div');
    contenedorBotones.className = 'acciones';

    const botonEditar = document.createElement('button');
    botonEditar.className = 'boton editar';
    botonEditar.textContent = 'Editar';
    botonEditar.addEventListener('click', () => entrarEnModoEdicion(pizza));

    const botonEliminar = document.createElement('button');
    botonEliminar.className = 'boton eliminar';
    botonEliminar.textContent = 'Eliminar';
    botonEliminar.addEventListener('click', () => eliminarPizza(pizza.id));

    contenedorBotones.append(botonEditar, botonEliminar);
    celdaAcciones.append(contenedorBotones);

    fila.append(celdaNombre, celdaTamano, celdaPrecio, celdaEstado, celdaAcciones);
    tablaPizzas.append(fila);
  });

  // Mensaje cuando no hay nada para mostrar y resumen de conteo
  mensajeVacio.hidden = pizzas.length > 0;
  const disponibles = pizzas.filter((p) => p.disponible).length;
  resumen.textContent = `${pizzas.length} pizzas · ${disponibles} disponibles`;
}

// ------------------------------------------------------------
//  Formulario: modo "agregar" y modo "editar"
// ------------------------------------------------------------
function entrarEnModoEdicion(pizza) {
  idEditando = pizza.id;
  campoNombre.value = pizza.nombre;
  campoIngredientes.value = pizza.ingredientes;
  campoTamano.value = pizza.tamano;
  campoPrecio.value = pizza.precio;
  campoDisponible.checked = pizza.disponible;

  tituloFormulario.textContent = `Editar pizza #${pizza.id}`;
  botonGuardar.textContent = 'Guardar cambios';
  botonCancelar.hidden = false;
  ocultarError();
  campoNombre.focus();
}

function salirDelModoEdicion() {
  idEditando = null;
  formulario.reset();
  campoTamano.value = 'Mediana';
  campoDisponible.checked = true;

  tituloFormulario.textContent = 'Agregar pizza';
  botonGuardar.textContent = 'Agregar pizza';
  botonCancelar.hidden = true;
  ocultarError();
}

// Toma lo que el usuario escribió en el formulario
function leerFormulario() {
  return {
    nombre: campoNombre.value.trim(),
    ingredientes: campoIngredientes.value.trim(),
    tamano: campoTamano.value,
    precio: Number(campoPrecio.value),
    disponible: campoDisponible.checked,
  };
}

// Primera revisión en el navegador (el servidor vuelve a validar)
function validarFormulario(pizza) {
  if (pizza.nombre.length < 2) return 'Escribe el nombre de la pizza (mínimo 2 letras).';
  if (pizza.ingredientes.length < 3) return 'Escribe los ingredientes (mínimo 3 letras).';
  if (!pizza.precio || pizza.precio <= 0) return 'Escribe un precio mayor que 0.';
  return null;
}

// Cuando se presiona el botón del formulario: crear o actualizar según el modo
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const pizza = leerFormulario();

  const problema = validarFormulario(pizza);
  if (problema) return mostrarError(problema);

  try {
    if (idEditando === null) {
      await crearPizza(pizza);
    } else {
      await actualizarPizza(idEditando, pizza);
    }
    salirDelModoEdicion();
    await leerPizzas();
  } catch (error) {
    mostrarError(error.message);
  }
});

botonCancelar.addEventListener('click', salirDelModoEdicion);

// Buscador: espera un momento después de escribir para no pedir datos en cada tecla
let temporizadorBusqueda;
buscador.addEventListener('input', () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(leerPizzas, 250);
});

// ------------------------------------------------------------
//  Mensajes y formato
// ------------------------------------------------------------
function mostrarError(texto) {
  errorFormulario.textContent = texto;
  errorFormulario.hidden = false;
}

function ocultarError() {
  errorFormulario.hidden = true;
  errorFormulario.textContent = '';
}

let temporizadorAviso;
function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 2500);
}

function formatearPrecio(valor) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
}

// ----- Al abrir la página, cargamos la lista -----
leerPizzas().catch((error) => mostrarAviso('⚠️ ' + error.message));
