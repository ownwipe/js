//const bedrock = require('bedrock-protocol');
const bedrock = require('bedrock-protocol');
const { setTimeout: sleep } = require('timers/promises');

const IP = 'vinepe.net';

const PORTS = [19141, 19142, 19143, 19144, 19145, 19146, 19147];
const botNames = ['test', 'test'];

async function createBot(name, port){
	const client = bedrock.createClient({host: IP, port: port, username: name, offline: true, version: '1.21.2'});
	console.log(`Попытка запустить бота [${name}] на порт [${port}]`);
	client.on('preLogin', (packet) => {
   	 if (!packet.data) return;
   	 try {
   	     const clientData = JSON.parse(packet.data);
   	     clientData.DeviceOS = 1;
   	         clientData.GameVersion = '1.21.2';
   	     clientData.DeviceModel = 'Poco S89';
   	     packet.data = JSON.stringify(clientData);
   	     console.log('[preLogin] Данные устройства изменены:', clientData.DeviceOS, clientData.DeviceModel);
   	 } catch (e) {
   	     console.error('Ошибка при изменении данных устройства:', e);
   	 }
	});

	client.on('start_game', (packet) => {
	    console.log(packet);
	    runtimeEntityId = packet.runtime_entity_id;
	    //console.log(`Runtime Entity ID: ${runtimeEntityId}`);

	    if(packet.player_position){
	        X = packet.player_position.x;
	        Y = packet.player_position.y - 1;
	        Z = packet.player_position.z;
	        //console.log(`Начальная позиция текущего Entity из start_game : ${packet.player_position.x}  ${packet.player_position.y}  ${packet.player_position.z}`);
	        //console.log(`${X} ${Y} ${Z}`);
	    };
	});

	client.on('connect', (packet) => {console.log('Сокет подключён');});
	client.on('join', (packet) => {
	    console.log(`Бот [${name}] подключился.`);
	});
	client.on('disconnect', (reason) => {
		console.log(`[${name}] Откличился: `, reason);
	});
	await sleep(5000);
};
for(const port of PORTS) {
	for(const name of botNames){
		await createBot(name, port);
	};
};

console.log('Started');
