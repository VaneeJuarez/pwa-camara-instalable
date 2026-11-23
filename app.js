/* =========================================================
   Inspección Visual PWA - JavaScript Vanilla
   Toda la asincronía se resuelve con .then/.catch/.finally
   ========================================================= */

// ---------- Referencias del DOM ----------
const btnInstalar = document.getElementById('btn-instalar');
const btnPrepararCamara = document.getElementById('btn-preparar-camara');
const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');
const btnCancelarPermiso = document.getElementById('btn-cancelar-permiso');
const btnAlternarCamara = document.getElementById('btn-alternar-camara');
const btnApagarCamara = document.getElementById('btn-apagar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');
const controlesCamara = document.getElementById('controles-camara');
const visorVideo = document.getElementById('visor-camara');
const placeholderVisor = document.getElementById('placeholder-visor');
const mensajeEstado = document.getElementById('mensaje-estado');
const textoCamaraAviso = document.getElementById('texto-camara-aviso');

// ---------- Estado ----------
let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal
let cambiandoCamara = false;

function actualizarMensajeEstado(texto) {
  mensajeEstado.textContent = texto;
}

function nombreCamara(modo) {
  return modo === 'environment' ? 'Trasera' : 'Frontal';
}

// =========================================================
// FASE 1: Service Worker e instalación
// =========================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registro) => {
        console.log('Service Worker registrado. Scope:', registro.scope);
      })
      .catch((error) => {
        console.error('Error al registrar el Service Worker:', error);
      });
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;
  // Muestra el botón personalizado de instalación
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) {
    return;
  }

  eventoInstalacionDiferido.prompt();

  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        btnInstalar.hidden = true;
        console.log('El usuario aceptó instalar la PWA');
      } else {
        console.log('El usuario canceló la instalación');
      }
    })
    .catch((error) => {
      console.error('Error en el flujo de instalación:', error);
    })
    .finally(() => {
      // El evento solo puede usarse una vez
      eventoInstalacionDiferido = null;
    });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
  console.log('PWA instalada correctamente');
});

// =========================================================
// FASE 2: Control de hardware de cámara
// =========================================================

// Fragmento C: liberar el sensor antes de cualquier cambio
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

function mostrarVisorActivo(activo) {
  placeholderVisor.hidden = activo;
  controlesCamara.hidden = !activo;
  btnPrepararCamara.hidden = activo;
}

// Fragmento D: encendido con promesas y diagnóstico de errores
function iniciarCamara(modo) {
  detenerCamaraActiva();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Tu navegador no soporta acceso a cámara o el sitio no está en HTTPS.');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  actualizarMensajeEstado(`Encendiendo cámara ${nombreCamara(modo).toLowerCase()}...`);

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      visorVideo.classList.toggle('espejo', modo === 'user');
      mostrarVisorActivo(true);
      actualizarMensajeEstado(`Cámara activa (${nombreCamara(modo)})`);
    })
    .catch((error) => {
      visorVideo.srcObject = null;
      mostrarVisorActivo(false);

      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está siendo usada por otra aplicación.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    });
}

// Fragmento E: flujo de Pre-Permiso (UX ética)
// Paso 1: el usuario expresa su intención -> solo mostramos el aviso
btnPrepararCamara.addEventListener('click', () => {
  textoCamaraAviso.textContent = `cámara ${nombreCamara(modoCamaraActual).toLowerCase()}`;
  avisoPermiso.hidden = false;
  btnPrepararCamara.hidden = true;
  btnConfirmarPermiso.focus();
});

// Paso 2: confirmación consciente -> ahora sí se pide el permiso nativo
btnConfirmarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

// El usuario decide no continuar: no se toca el hardware
btnCancelarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  btnPrepararCamara.hidden = false;
  actualizarMensajeEstado('Acceso a cámara cancelado. No se solicitó ningún permiso.');
});

// Alternar entre lente trasera y frontal
btnAlternarCamara.addEventListener('click', () => {
  if (cambiandoCamara) {
    return; // Evita dobles clics mientras el sensor se libera
  }
  cambiandoCamara = true;
  btnAlternarCamara.disabled = true;

  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';

  iniciarCamara(modoCamaraActual)
    .finally(() => {
      cambiandoCamara = false;
      btnAlternarCamara.disabled = false;
    });
});

// Apagar cámara y liberar el sensor
btnApagarCamara.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  mostrarVisorActivo(false);
  actualizarMensajeEstado('Cámara apagada. El sensor fue liberado.');
});

// Liberar el hardware si la app pasa a segundo plano o se cierra
document.addEventListener('visibilitychange', () => {
  if (document.hidden && streamActual) {
    detenerCamaraActiva();
    visorVideo.srcObject = null;
    mostrarVisorActivo(false);
    actualizarMensajeEstado('Cámara apagada al salir de la aplicación.');
  }
});

window.addEventListener('pagehide', detenerCamaraActiva);
