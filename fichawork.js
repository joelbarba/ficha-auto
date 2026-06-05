var https = require('https');

var CONFIG = {
  refreshToken: '',
  cognitoClientId: '2ek0ok90bl4oiu1i5qno54286a',
  cognitoRegion: 'eu-central-1',
  calendarId: '69a5839576697dce41cbf7c7',
  graphqlEndpoint: 'https://9mtze3hb29.execute-api.eu-central-1.amazonaws.com/graphql',
};


function httpPost(url, headers, body) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(url);
    var data = JSON.stringify(body);

    var req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: Object.assign({}, headers, {
          'Content-Length': Buffer.byteLength(data),
        }),
      },
      function (res) {
        var raw = '';
        res.on('data', function (chunk) {
          raw += chunk;
        });
        res.on('end', function () {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            resolve(raw);
          }
        });
      }
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function login() {
  const loginBody = {
    "operationName": "Login",
    "variables": { 
      "email": process.env.USER,
      "password": process.env.PASS,
      "forever": false
    },
    "query": `mutation Login($email: String!, $password: String!, $forever: Boolean) {
      login(email: $email, password: $password, forever: $forever) {
        accessToken
        refreshToken
        token
        mfa
        firstPasswordPending
        session
        __typename
      }
    }`
  };
  return httpPost(CONFIG.graphqlEndpoint,
    {
      'content-type': 'application/json',
      'referer': 'https://app.ficha.work/'
    },
    loginBody
  ).then(function(res) {
    console.log(res);
    const token = res.data.login.token;
    console.log('LOGIN OK. token = ', token.slice(0,20) + '...');
    CONFIG.refreshToken = res.data.login.refreshIdToken;
    return token;
  }).catch(err => {
    console.log('LOGIN ERROR', err);
  });
}


function refreshIdToken() {
  console.log('[1/4] Renovando token de sesion...');

  return httpPost(
    'https://cognito-idp.' + CONFIG.cognitoRegion + '.amazonaws.com/',
    {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CONFIG.cognitoClientId,
      AuthParameters: {
        REFRESH_TOKEN: CONFIG.refreshToken,
      },
    }
  ).then(function (result) {
    var token = result.AuthenticationResult && result.AuthenticationResult.IdToken;

    if (!token) {
      throw new Error('No se pudo renovar el token: ' + JSON.stringify(result));
    }

    console.log('    OK Token renovado correctamente');
    return token;
  });
}


function esDiaFestivo(token, hoy) {
  var mes = hoy.getMonth();   // 0 = enero, 11 = diciembre
  var dia = hoy.getDate();
  var anio = hoy.getFullYear();

  console.log('[2/4] Comprobando si hoy es festivo...');

  var query = 'query MyCalendars { myCalendars { _id year months { month days { day isFestive } } } }';

  return httpPost(
    CONFIG.graphqlEndpoint,
    {
      'accept': '*/*',
      'content-type': 'application/json',
      'token': token,
    },
    {
      operationName: 'MyCalendars',
      variables: {},
      query: query,
    }
  ).then(function (result) {
    if (result.errors) {
      throw new Error('Error al consultar calendario: ' + JSON.stringify(result.errors));
    }

    var calendars = result.data && result.data.myCalendars;

    if (!calendars || calendars.length === 0) {
      console.log('    Aviso: no se encontro calendario. Se asume dia laborable.');
      return false;
    }

    // Buscar el calendario del año actual
    var calendario = calendars.find(function (c) { return c.year === anio; }) || calendars[0];

    // Buscar el mes actual dentro del calendario
    var mesActual = calendario.months && calendario.months.find(function (m) { return m.month === mes; });

    if (!mesActual) {
      console.log('    Aviso: mes no encontrado en el calendario.');
      return false;
    }

    // Buscar si el día de hoy está marcado como festivo
    var diaActual = mesActual.days && mesActual.days.find(function (d) { return d.day === dia; });
    var esFestivo = diaActual ? diaActual.isFestive : false;

    if (esFestivo) {
      console.log('    Hoy es festivo segun el calendario laboral. No se ficha.');
    } else {
      console.log('    OK No es festivo.');
    }

    return esFestivo;
  });
}


function esDiaVacaciones(token, hoy) {
  var mes = hoy.getMonth();
  var dia = hoy.getDate();
  var anio = hoy.getFullYear();

  console.log('[3/4] Comprobando si hoy es vacaciones...');

  var query = [
    'query MyVacationDays($calendarId: String!, $month: Int!, $year: Int!) {',
    '  myVacationDays(calendarId: $calendarId, month: $month, year: $year) {',
    '    _id day month year accountId __typename',
    '  }',
    '}',
  ].join('\n');

  return httpPost(
    CONFIG.graphqlEndpoint,
    {
      'accept': '*/*',
      'content-type': 'application/json',
      'token': token,
    },
    {
      operationName: 'MyVacationDays',
      variables: {
        calendarId: CONFIG.calendarId,
        month: mes,
        year: anio,
      },
      query: query,
    }
  ).then(function (result) {
    if (result.errors) {
      throw new Error('Error al consultar vacaciones: ' + JSON.stringify(result.errors));
    }

    var diasVacaciones = result.data && result.data.myVacationDays;

    if (!diasVacaciones || diasVacaciones.length === 0) {
      console.log('    OK No hay vacaciones registradas este mes.');
      return false;
    }

    // Comprobar si el día de hoy está en la lista de vacaciones
    var esVacaciones = diasVacaciones.some(function (d) { return d.day === dia; });

    if (esVacaciones) {
      console.log('    Hoy es dia de vacaciones. No se ficha.');
    } else {
      console.log('    OK No es dia de vacaciones.');
    }

    return esVacaciones;
  });
}


function realizarFichaje(token) {
  console.log('[4/4] Realizando fichaje...');

  var fragmentSegment = [
    'fragment SegmentFields on SegmentType {',
    '  _id',
    '  accountId',
    '  assignedManagerId',
    '  organizationId',
    '  chipClockIn  { chipId chipAlias organizationId __typename }',
    '  chipClockOut { chipId chipAlias organizationId __typename }',
    '  coordinatesClockIn  { lat lon __typename }',
    '  coordinatesClockOut { lat lon __typename }',
    '  start startAt end endAt',
    '  newStart newEnd newStartAt newEndAt',
    '  finalStart finalEnd finalStartAt finalEndAt',
    '  issues {',
    '    _id createdById handledById segmentId',
    '    start startAt end endAt message status __typename',
    '  }',
    '  status',
    '  offlineEntryId',
    '  __typename',
    '}',
  ].join('\n');

  var mutation = [
    fragmentSegment,
    'mutation ClockToggle(',
    '  $chip: ChipInputType',
    '  $clockBySchedule: Boolean',
    '  $coordinates: CoordinatesInputType',
    '  $recordedAt: Float',
    '  $offlineEntryId: String',
    ') {',
    '  clockToggle(',
    '    chip: $chip',
    '    clockBySchedule: $clockBySchedule',
    '    coordinates: $coordinates',
    '    recordedAt: $recordedAt',
    '    offlineEntryId: $offlineEntryId',
    '  ) {',
    '    ...SegmentFields',
    '  }',
    '}',
  ].join('\n');

  return httpPost(
    CONFIG.graphqlEndpoint,
    {
      'accept': '*/*',
      'content-type': 'application/json',
      'token': token,
    },
    {
      operationName: 'ClockToggle',
      variables: {
        recordedAt: Date.now(),
      },
      query: mutation,
    }
  ).then(function (result) {
    if (result.errors) {
      throw new Error('Error al fichar: ' + JSON.stringify(result.errors));
    }

    return result.data && result.data.clockToggle;
  });
}


async function main() {
  var hoy = new Date();
  var diaSemana = hoy.getDay(); // 0 = domingo, 6 = sabado

  console.log('\n========================================');
  console.log('   Ficha.Work - Fichaje Automatico');
  console.log('========================================');
  console.log('Fecha y hora: ' + hoy.toISOString());

  // Seguridad extra: no fichar en fin de semana
  if (diaSemana === 0 || diaSemana === 6) {
    console.log('Weekend, get away');
    return process.exit(1);
  }

  try {
    const token = await login();

    const festivo = await esDiaFestivo(token, hoy);
    if (festivo) { 
      console.log('Day off, get away'); 
      return process.exit(1);
    }
    const vacaciones = await esDiaVacaciones(token, hoy);
    if (vacaciones) {
      console.log('Day off, get away'); 
      return process.exit(1);
    }

    const segment = await realizarFichaje(token);
    var tipo = (segment && segment.status === 'open') ? 'ENTRADA' : 'SALIDA';
    var hora = (segment && segment.startAt)
      ? new Date(Number(segment.startAt)).toLocaleTimeString('es-ES')
      : 'hora no disponible';

    console.log('\n----------------------------------------');
    console.log('   ' + tipo + ' fichada correctamente');
    console.log('----------------------------------------');
    console.log('ID segmento : ' + (segment && segment._id));
    console.log('Hora inicio : ' + hora);
    console.log('Estado      : ' + (segment && segment.status));


  } catch (err) {
    console.error('ERROR', err);
  }
}

main();
