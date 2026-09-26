const { randomUUID } = require('crypto');
const bedrock = require('bedrock-protocol');
const { setTimeout: sleep } = require('timers/promises');

// Данные сервера: IP и Порты
const IP = 'vinemine.net';
const PORTS = [19141, 19142, 19143, 19144, 19145, 19146, 19147];

// Ники ботов
const botNames = ['testName1', 'testName2', 'testName3'];

// Время перезапуска ботов по МСК
const MSK_OFFSET_HOURS = 3;
const DISCONNECT_AT = { hour: 3, minute: 00 };
const RECONNECT_AT  = { hour: 4, minute: 20 };


// Список активных ботов: { name, port, client }
const activeBots = [];

function generateClientData() {
  const models = [
    'Xiaomi 13T Pro', 'Samsung Galaxy A54', 'Google Pixel 7',
    'Xiaomi Redmi Note 12', 'OnePlus 11', 'Samsung Galaxy S23'
  ];
	return models[Math.floor(Math.random() * models.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Рассчет времени перезапуска ботов
function msUntilNextMsk(hour, minute) {
  const nowUtc = Date.now();
  const mskNow = nowUtc + MSK_OFFSET_HOURS * 60 * 60 * 1000;
  const d = new Date(mskNow);
  const targetMsk = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    hour, minute, 0, 0
  );
  let diff = targetMsk - mskNow;
  if (diff <= 0) diff += 24 * 60 * 60 * 1000;
  return diff;
}

function scheduleDaily(hour, minute, task, label = '') {
  function loop() {
    const delay = msUntilNextMsk(hour, minute);
    const nextTime = new Date(Date.now() + delay);
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    console.log(
      `[Планировщик] ${label} -> ${hh}:${mm} МСК (через ${Math.round(delay / 1000)} сек, ` +
      `~${nextTime.toISOString()} UTC)`
    );
    setTimeout(() => {
      Promise.resolve()
        .then(task)
        .catch((e) => console.error(`[Планировщик] Ошибка в задаче "${label}":`, e));
      loop();
    }, delay);
  }
  loop();
}

// Подключение ботов
function connectBot(name, port) {
  return new Promise((resolve, reject) => {
    console.log(`Попытка запустить бота [${name}] на порт [${port}]`);

    const client = bedrock.createClient({
      host: IP,
      port: port,
      username: name,
      offline: true,
      version: '1.21.2',
    });

    let spawned = false;

    const timer = setTimeout(() => {
      if (!spawned) {
        try { client.disconnect('Timeout'); } catch (_) {}
        reject(new Error('Таймаут подключения'));
      }
    }, 20000);

    client.on('preLogin', (packet) => {
      if (!packet.data) return;
      try {
	   	 const clientData = JSON.parse(packet.data);
	     clientData.DeviceOS = 1;
	     clientData.DeviceModel = generateClientData();
	     clientData.DeviceId = randomUUID();
	     clientData.ClientRandomId = Math.floor(Math.random() * 9007199254740991) * (Math.random() < 0.5 ? -1 : 1);
	     clientData.SelfSignedId = randomUUID();
	   	 clientData.PlatformOnlineId = '';
		 clientData.PlatformOfflineId = '';
    	 clientData.LanguageCode = 'ru_RU';
    	 clientData.CurrentInputMode = 2;
    	 clientData.DefaultInputMode = 2;
    	 packet.data = JSON.stringify(clientData);
    	 console.log('[preLogin] clientData обновлён:', clientData.DeviceModel);
  	 } catch (e) {
    	 console.error('Ошибка при изменении clientData:', e);
  	}
    });

    client.on('connect', () => {
      console.log(`[${name}] Сокет подключён`);
    });

    client.on('spawn', () => {
      spawned = true;
      clearTimeout(timer);
      console.log(`[V] Бот [${name}] подключился к порту ${port}`);
      resolve(client);
    });

    client.on('error', (err) => {
      if (!spawned) {
        clearTimeout(timer);
        console.error(`!!!\t\tБот [${name}] (${port}) ошибка:`, err.message);
        reject(err);
      } else {
        console.error(`!!!\t\tот [${name}] ошибка после подключения:`, err.message);
      }
    });

    client.on('close', () => {
      if (!spawned) {
        clearTimeout(timer);
        reject(new Error('Соединение закрыто до spawn'));
      }
    });

    client.on('disconnect', (reason) => {
      console.log(`[${name}] Отключился:`, reason);
    });
  });
}

// Цикл подключения с рандомными временными интервалами между заходами ботов
async function connectAll() {
  for (const port of PORTS) {
    for (const name of botNames) {
      try {
        const client = await connectBot(name, port);
        activeBots.push({ name, port, client });
        await sleep(10000 + Math.random() * 3000);
      } catch (err) {
        console.warn(`Пропускаем [${name}] на ${port}: ${err.message}`);
        await sleep(1500);
      }
    }
  }
  console.log(`Все боты запущены. Активных: ${activeBots.length}`);
}

function disconnectAll(reason = 'Ежедневный перерыв') {
  console.log(`=== Плановое отключение всех ботов (${reason}) ===`);
  const snapshot = activeBots.splice(0, activeBots.length);
  for (const { name, client } of snapshot) {
    try {
      client.disconnect(reason);
      console.log(`[${name}] отключён`);
    } catch (e) {
      console.error(`Ошибка отключения [${name}]:`, e.message);
    }
  }
}

async function reconnectAll() {
  console.log('=== Плановое подключение ботов (03:30 МСК) ===');
  await connectAll();
}

// Запуск
async function main() {
  await connectAll();

  scheduleDaily(
    DISCONNECT_AT.hour,
    DISCONNECT_AT.minute,
    () => disconnectAll('Ежедневный перерыв 03:00 МСК'),
    'Отключение всех ботов'
  );

  scheduleDaily(
    RECONNECT_AT.hour,
    RECONNECT_AT.minute,
    () => reconnectAll(),
    'Подключение всех ботов'
  );
}

main().catch(console.error);
