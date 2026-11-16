// Textos do programa em português (padrão), inglês e espanhol.
(function (root) {
  'use strict';
  const T = {
    pt: {
      overlay: { standings: 'Classificação', relative: 'Relative', radar: 'Radar', flags: 'Bandeiras e punições', incidents: 'Incidentes', pitlimiter: 'Limitador do pit', sectors: 'Setores', fuel: 'Combustível', tires: 'Pneus', session: 'Sessão', delta: 'Delta', panel: 'Painel avançado', laplog: 'Log de voltas', fps: 'FPS' },
      pit: { limiter: 'LIMITADOR', turnOn: 'LIGUE O LIMITADOR' },
      sec: { best: 'Melhor', current: 'Atual' },
      warnInc: 'INCIDENTE', warnSub: { lapInvalid: 'Essa volta não vai contar', offTrackNow: 'Volte pra pista com cuidado' },
      warn: { lapInvalid: 'VOLTA INVÁLIDA', offTrackNow: 'FORA DA PISTA', offTrack: 'Saída de pista', lostControl: 'Perda de controle', contact: 'Contato', incident: 'Incidente' }, lapShort: 'V',
      fuel: { title: 'COMBUSTÍVEL', perLap: 'POR VOLTA', laps: 'DÁ PRA', toFinish: 'PRO FIM' },
      flag: {
        green: ['PISTA LIVRE', 'Bandeira verde'], yellow: ['ACIDENTE À FRENTE', 'Bandeira amarela'],
        yellowWaving: ['PERIGO, REDUZA', 'Amarela agitada'], caution: ['NEUTRALIZAÇÃO', 'Safety car na pista'],
        cautionWaving: ['NEUTRALIZAÇÃO', 'Safety car acionado agora'], blue: ['DEIXE PASSAR', 'Bandeira azul'],
        white: ['ÚLTIMA VOLTA', 'Bandeira branca'], checkered: ['FIM DA SESSÃO', 'Bandeira quadriculada'],
        red: ['SESSÃO PARADA', 'Bandeira vermelha'], debris: ['DETRITOS NA PISTA', 'Bandeira de detritos'],
      },
      penalty: {
        black: ['PUNIÇÃO', 'Entre no box para cumprir'], repair: ['CARRO DANIFICADO', 'Entre no box para reparar'],
        furled: ['ADVERTÊNCIA', 'Cuidado com a pilotagem'], disqualify: ['DESCLASSIFICADO', 'Você foi desclassificado'],
      },
      incidents: 'Incidentes', noLimit: 'sem limite',
      reasonLbl: 'Provável:', reason: { pitSpeeding: 'velocidade no pit', jumpStart: 'largada queimada', incidentLimit: 'limite de incidentes', cutting: 'cortou a pista' },
      sessionType: { practice: 'Treino', qualify: 'Classificação', race: 'Corrida', warmup: 'Aquecimento', timetrial: 'Contra o relógio', testing: 'Teste' },
      lap: 'Volta', laps: 'Voltas', remaining: 'restante',
      delta: { title: 'DELTA', sessionOptimal: 'Melhor otimizada da sessão', sessionBest: 'Melhor volta da sessão', predicted: 'Volta prevista', personalBest: 'Recorde pessoal' },
      panel: { pitLimiter: 'LIMITADOR DO PIT', kmh: 'KM/H', rpm: 'RPM', best: 'Melhor', track: 'Pista', air: 'Ar' },
      laplog: { title: 'LOG DE VOLTAS', sessionBest: 'MELHOR DA SESSÃO', lap: 'VOLTA', time: 'TEMPO', toBest: '+/- MELHOR', temp: 'PISTA' },
      cols: { best: 'Melhor', last: 'Última', s: 'S' },
      edit: 'Arraste pra mover · cantos: tamanho · laterais: linhas/colunas · setas: ajuste fino',
      waiting: 'Aguardando o iRacing…', row: 'linha', rowsWord: 'linhas',
    },
    en: {
      overlay: { standings: 'Standings', relative: 'Relative', radar: 'Radar', flags: 'Flags & penalties', incidents: 'Incidents', pitlimiter: 'Pit limiter', sectors: 'Sectors', fuel: 'Fuel', tires: 'Tires', session: 'Session', delta: 'Delta', panel: 'Advanced panel', laplog: 'Lap log', fps: 'FPS' },
      pit: { limiter: 'PIT LIMITER', turnOn: 'TURN ON LIMITER' },
      sec: { best: 'Best', current: 'Current' },
      warnInc: 'INCIDENT', warnSub: { lapInvalid: 'This lap will not count', offTrackNow: 'Rejoin the track carefully' },
      warn: { lapInvalid: 'LAP INVALID', offTrackNow: 'OFF TRACK', offTrack: 'Off track', lostControl: 'Loss of control', contact: 'Contact', incident: 'Incident' }, lapShort: 'L',
      fuel: { title: 'FUEL', perLap: 'PER LAP', laps: 'LAPS LEFT', toFinish: 'TO FINISH' },
      flag: {
        green: ['RESUME RACING', 'Green flag'], yellow: ['ACCIDENT AHEAD', 'Yellow flag'],
        yellowWaving: ['DANGER, SLOW DOWN', 'Waving yellow'], caution: ['FULL COURSE CAUTION', 'Safety car on track'],
        cautionWaving: ['FULL COURSE CAUTION', 'Safety car just called'], blue: ['LET FASTER CAR BY', 'Blue flag'],
        white: ['ONE MORE LAP', 'White flag'], checkered: ['SESSION IS OVER', 'Checkered flag'],
        red: ['SESSION STOPPED', 'Red flag'], debris: ['DEBRIS ON TRACK', 'Debris flag'],
      },
      penalty: {
        black: ['PENALTY', 'Pit to serve your penalty'], repair: ['CAR DAMAGED', 'Pit for repairs'],
        furled: ['WARNING', 'Watch your driving'], disqualify: ['DISQUALIFIED', 'You have been disqualified'],
      },
      incidents: 'Incidents', noLimit: 'no limit',
      reasonLbl: 'Likely:', reason: { pitSpeeding: 'pit lane speeding', jumpStart: 'jump start', incidentLimit: 'incident limit', cutting: 'track cutting' },
      sessionType: { practice: 'Practice', qualify: 'Qualify', race: 'Race', warmup: 'Warmup', timetrial: 'Time trial', testing: 'Testing' },
      lap: 'Lap', laps: 'Laps', remaining: 'remaining',
      delta: { title: 'DELTA', sessionOptimal: 'Session optimal', sessionBest: 'Session best', predicted: 'Predicted lap', personalBest: 'Personal best' },
      panel: { pitLimiter: 'PIT LIMITER', kmh: 'KPH', rpm: 'RPM', best: 'Best', track: 'Track', air: 'Air' },
      laplog: { title: 'LAPTIME LOG', sessionBest: 'SESSION BEST', lap: 'LAP', time: 'TIME', toBest: '+/- TO BEST', temp: 'TRACK' },
      cols: { best: 'Best', last: 'Last', s: 'S' },
      edit: 'Drag to move · corners: size · sides: rows/columns · arrows: fine tune',
      waiting: 'Waiting for iRacing…', row: 'row', rowsWord: 'rows',
    },
    es: {
      overlay: { standings: 'Clasificación', relative: 'Relativo', radar: 'Radar', flags: 'Banderas y sanciones', incidents: 'Incidentes', pitlimiter: 'Limitador de boxes', sectors: 'Sectores', fuel: 'Combustible', tires: 'Neumáticos', session: 'Sesión', delta: 'Delta', panel: 'Panel avanzado', laplog: 'Registro de vueltas', fps: 'FPS' },
      pit: { limiter: 'LIMITADOR', turnOn: 'ACTIVA EL LIMITADOR' },
      sec: { best: 'Mejor', current: 'Actual' },
      warnInc: 'INCIDENTE', warnSub: { lapInvalid: 'Esta vuelta no va a contar', offTrackNow: 'Vuelve a la pista con cuidado' },
      warn: { lapInvalid: 'VUELTA INVÁLIDA', offTrackNow: 'FUERA DE PISTA', offTrack: 'Salida de pista', lostControl: 'Pérdida de control', contact: 'Contacto', incident: 'Incidente' }, lapShort: 'V',
      fuel: { title: 'COMBUSTIBLE', perLap: 'POR VUELTA', laps: 'ALCANZA', toFinish: 'AL FINAL' },
      flag: {
        green: ['PISTA LIBRE', 'Bandera verde'], yellow: ['ACCIDENTE ADELANTE', 'Bandera amarilla'],
        yellowWaving: ['PELIGRO, REDUCE', 'Amarilla agitada'], caution: ['NEUTRALIZACIÓN', 'Safety car en pista'],
        cautionWaving: ['NEUTRALIZACIÓN', 'Safety car recién activado'], blue: ['DEJA PASAR', 'Bandera azul'],
        white: ['ÚLTIMA VUELTA', 'Bandera blanca'], checkered: ['FIN DE LA SESIÓN', 'Bandera a cuadros'],
        red: ['SESIÓN DETENIDA', 'Bandera roja'], debris: ['RESTOS EN PISTA', 'Bandera de restos'],
      },
      penalty: {
        black: ['SANCIÓN', 'Entra a boxes para cumplir'], repair: ['COCHE DAÑADO', 'Entra a boxes para reparar'],
        furled: ['ADVERTENCIA', 'Cuidado con tu conducción'], disqualify: ['DESCALIFICADO', 'Has sido descalificado'],
      },
      incidents: 'Incidentes', noLimit: 'sin límite',
      reasonLbl: 'Probable:', reason: { pitSpeeding: 'velocidad en boxes', jumpStart: 'salida anticipada', incidentLimit: 'límite de incidentes', cutting: 'recorte de pista' },
      sessionType: { practice: 'Práctica', qualify: 'Clasificación', race: 'Carrera', warmup: 'Calentamiento', timetrial: 'Contrarreloj', testing: 'Prueba' },
      lap: 'Vuelta', laps: 'Vueltas', remaining: 'restante',
      delta: { title: 'DELTA', sessionOptimal: 'Óptima de la sesión', sessionBest: 'Mejor vuelta de la sesión', predicted: 'Vuelta prevista', personalBest: 'Récord personal' },
      panel: { pitLimiter: 'LIMITADOR DE BOXES', kmh: 'KM/H', rpm: 'RPM', best: 'Mejor', track: 'Pista', air: 'Aire' },
      laplog: { title: 'REGISTRO DE VUELTAS', sessionBest: 'MEJOR DE LA SESIÓN', lap: 'VUELTA', time: 'TIEMPO', toBest: '+/- MEJOR', temp: 'PISTA' },
      cols: { best: 'Mejor', last: 'Última', s: 'S' },
      edit: 'Arrastra para mover · esquinas: tamaño · lados: filas/columnas · flechas: ajuste fino',
      waiting: 'Esperando iRacing…', row: 'fila', rowsWord: 'filas',
    },
  };

  function sessionTypeKey(type) {
    const s = String(type || '').toLowerCase();
    if (s.includes('race')) return 'race';
    if (s.includes('qual')) return 'qualify';
    if (s.includes('warm')) return 'warmup';
    if (s.includes('time trial')) return 'timetrial';
    if (s.includes('test')) return 'testing';
    return 'practice';
  }

  root.I18N = { T, get: (lang) => T[lang] || T.pt, sessionTypeKey };
}(typeof self !== 'undefined' ? self : this));
