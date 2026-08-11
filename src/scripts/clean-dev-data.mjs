const BASE_URL = 'http://192.168.1.126:5000';

const EMPRESA_ID = 'd1b23ac7-892e-484b-86db-86b20a15d63f';

/**
 * true  = solo muestra qué haría
 * false = ejecuta cambios reales
 */
const DRY_RUN = true;

/**
 * Usa aquí los IDs que espera /api/sensores/retirar.
 * Si ese endpoint espera id_hardware tipo SEN-12345,
 * agrega esos valores aquí.
 */
const SENSORES_PROTEGIDOS = new Set(['acae8a9a-f11a-4167-bbbd-d63b4177d8eb']);

async function api(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const text = await response.text();

  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      [`${response.status} ${response.statusText}`, endpoint, JSON.stringify(body)].join('\n'),
    );
  }

  return body;
}

function logSection(title) {
  console.log('\n');
  console.log('='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

/**
 * Ajusta esta función según cuál sea el ID
 * que realmente usa /api/sensores/retirar.
 *
 * Si espera SEN-12345:
 *   return sensor.id_hardware;
 *
 * Si espera UUID:
 *   return sensor.id;
 */
function getSensorApiId(sensor) {
  return sensor.id ?? sensor.id_hardware;
}

async function obtenerMotoresEmpresa() {
  const [motores, equipos, areas, divisiones] = await Promise.all([
    api('/api/motores'),
    api('/api/equipos'),
    api('/api/areas'),
    api('/api/divisiones'),
  ]);

  const equiposPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));

  const areasPorId = new Map(areas.map((area) => [area.id, area]));

  const divisionesPorId = new Map(divisiones.map((division) => [division.id, division]));

  return motores.filter((motor) => {
    const equipo = equiposPorId.get(motor.equipo_id);

    if (!equipo) {
      return false;
    }

    const area = areasPorId.get(equipo.area_id);

    if (!area) {
      return false;
    }

    const division = divisionesPorId.get(area.division_id);

    if (!division) {
      return false;
    }

    return division.empresa_id === EMPRESA_ID;
  });
}

async function obtenerDatosALimpiar() {
  logSection('Buscando datos');

  const [motoresEmpresa, anillos, carbones, sensores] = await Promise.all([
    obtenerMotoresEmpresa(),
    api('/api/anillos'),
    api('/api/carbones'),
    api('/api/sensores'),
  ]);

  const idsMotores = new Set(motoresEmpresa.map((motor) => motor.id));

  /**
   * Todos los anillos de los motores
   * pertenecientes a la empresa.
   */
  const anillosEmpresaOriginal = anillos.filter((anillo) => idsMotores.has(anillo.motor_id));

  const idsAnillosEmpresa = new Set(anillosEmpresaOriginal.map((anillo) => anillo.id));

  /**
   * Todos los carbones de esos anillos.
   */
  const carbonesEmpresaOriginal = carbones.filter((carbon) =>
    idsAnillosEmpresa.has(carbon.anillo_id),
  );

  const idsCarbonesEmpresa = new Set(carbonesEmpresaOriginal.map((carbon) => carbon.id));

  /**
   * Busca los sensores protegidos.
   */
  function esSensorProtegido(sensor) {
    return SENSORES_PROTEGIDOS.has(sensor.id) || SENSORES_PROTEGIDOS.has(sensor.id_hardware);
  }
  const sensoresProtegidos = sensores.filter(esSensorProtegido);

  /**
   * Carbones protegidos:
   * cualquier carbon_id_actual asociado
   * a un sensor protegido.
   */
  const idsCarbonesProtegidos = new Set(
    sensoresProtegidos
      .map((sensor) => sensor.carbon_id_actual)
      .filter((carbonId) => carbonId && carbonId !== '0'),
  );

  /**
   * Anillos protegidos:
   * si contienen un carbón protegido,
   * tampoco podemos borrarlos.
   */
  const idsAnillosProtegidos = new Set(
    carbonesEmpresaOriginal
      .filter((carbon) => idsCarbonesProtegidos.has(carbon.id))
      .map((carbon) => carbon.anillo_id),
  );

  /**
   * Sensores que sí podemos retirar.
   */
  const sensoresInstalados = sensores.filter((sensor) => {
    const carbonId = sensor.carbon_id_actual;

    return (
      carbonId && carbonId !== '0' && idsCarbonesEmpresa.has(carbonId) && !esSensorProtegido(sensor)
    );
  });

  /**
   * Carbones que sí podemos borrar.
   */
  const carbonesEmpresa = carbonesEmpresaOriginal.filter(
    (carbon) => !idsCarbonesProtegidos.has(carbon.id),
  );

  /**
   * Anillos que sí podemos borrar.
   *
   * Si un anillo contiene al menos un
   * carbón protegido, se conserva completo.
   */
  const anillosEmpresa = anillosEmpresaOriginal.filter(
    (anillo) => !idsAnillosProtegidos.has(anillo.id),
  );

  return {
    motoresEmpresa,

    anillosEmpresa,
    carbonesEmpresa,
    sensoresInstalados,

    sensoresProtegidos,
    idsCarbonesProtegidos,
    idsAnillosProtegidos,
  };
}

async function retirarSensores(sensores) {
  logSection('Retirando sensores');

  for (const sensor of sensores) {
    const sensorApiId = getSensorApiId(sensor);

    console.log(`Sensor: ${sensorApiId}`);

    console.log(`  carbón actual: ${sensor.carbon_id_actual}`);

    if (DRY_RUN) {
      console.log('  [DRY RUN] no se retiró');

      continue;
    }

    await api('/api/sensores/retirar', {
      method: 'POST',

      body: JSON.stringify({
        sensor_id: sensorApiId,
      }),
    });

    console.log('  ✓ desasociado');
  }
}

async function eliminarCarbones(carbones) {
  logSection('Eliminando carbones');

  for (const carbon of carbones) {
    console.log(`Carbón: ${carbon.identificador ?? carbon.id}`);

    console.log(`  id: ${carbon.id}`);

    if (DRY_RUN) {
      console.log('  [DRY RUN] no se eliminó');

      continue;
    }

    await api(`/api/carbones/${encodeURIComponent(carbon.id)}`, {
      method: 'DELETE',
    });

    console.log('  ✓ eliminado');
  }
}

async function eliminarAnillos(anillos) {
  logSection('Eliminando anillos');

  for (const anillo of anillos) {
    console.log(`Anillo: ${anillo.identificador ?? anillo.id}`);

    console.log(`  id: ${anillo.id}`);

    if (DRY_RUN) {
      console.log('  [DRY RUN] no se eliminó');

      continue;
    }

    await api(`/api/anillos/${encodeURIComponent(anillo.id)}`, {
      method: 'DELETE',
    });

    console.log('  ✓ eliminado');
  }
}

function mostrarProtegidos({ sensoresProtegidos, idsCarbonesProtegidos, idsAnillosProtegidos }) {
  logSection('Datos protegidos');

  if (sensoresProtegidos.length === 0) {
    console.log('No se encontraron sensores protegidos instalados.');

    return;
  }

  console.log('Sensores protegidos:');

  console.log('\nSensores protegidos solicitados:', [...SENSORES_PROTEGIDOS]);

  console.log(
    '\nSensores protegidos encontrados:',
    sensoresProtegidos.map((sensor) => ({
      id: sensor.id,
      id_hardware: sensor.id_hardware,
      carbon_id_actual: sensor.carbon_id_actual,
    })),
  );

  for (const sensor of sensoresProtegidos) {
    console.log(`- ${getSensorApiId(sensor)}`);

    console.log(`  carbón: ${sensor.carbon_id_actual ?? 'sin asociación'}`);
  }

  console.log('\nCarbones protegidos:');

  console.log([...idsCarbonesProtegidos]);

  console.log('\nAnillos protegidos:');

  console.log([...idsAnillosProtegidos]);
}

async function main() {
  if (!EMPRESA_ID) {
    throw new Error('Debes indicar EMPRESA_ID.');
  }

  if (!BASE_URL || BASE_URL.includes('TU-API')) {
    throw new Error('Debes configurar BASE_URL.');
  }

  console.log(DRY_RUN ? '\n🧪 MODO DRY RUN' : '\n⚠️ MODO BORRADO REAL');

  console.log(`Empresa: ${EMPRESA_ID}`);

  console.log(`Sensores protegidos configurados: ${SENSORES_PROTEGIDOS.size}`);

  const datos = await obtenerDatosALimpiar();

  mostrarProtegidos(datos);

  logSection('Resumen de limpieza');

  console.table({
    motoresEmpresa: datos.motoresEmpresa.length,

    anillosABorrar: datos.anillosEmpresa.length,

    carbonesABorrar: datos.carbonesEmpresa.length,

    sensoresADesasociar: datos.sensoresInstalados.length,

    sensoresProtegidos: datos.sensoresProtegidos.length,

    carbonesProtegidos: datos.idsCarbonesProtegidos.size,

    anillosProtegidos: datos.idsAnillosProtegidos.size,
  });

  if (
    datos.anillosEmpresa.length === 0 &&
    datos.carbonesEmpresa.length === 0 &&
    datos.sensoresInstalados.length === 0
  ) {
    console.log('\nNo hay datos para limpiar.');

    return;
  }

  await retirarSensores(datos.sensoresInstalados);

  await eliminarCarbones(datos.carbonesEmpresa);

  await eliminarAnillos(datos.anillosEmpresa);

  logSection('Finalizado');

  if (DRY_RUN) {
    console.log('No se modificó nada.');

    console.log('Revisa cuidadosamente el resumen y cambia DRY_RUN a false para ejecutar.');
  } else {
    console.log('✓ Limpieza completada.');
  }
}

main().catch((error) => {
  console.error('\n❌ Error durante la limpieza');

  console.error(error);

  process.exit(1);
});
