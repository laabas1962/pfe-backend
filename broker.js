const { Aedes } = require('aedes');
const net = require('net');
const http = require('http');
const websocket = require('websocket-stream');

const MQTT_PORT = 1883;
const WS_PORT = 8888;

async function startBroker() {
  const aedes = await Aedes.createBroker();
  // 1. MQTT Server (Standard)
  const server = net.createServer(aedes.handle);
  server.listen(MQTT_PORT, function () {
    console.log(`✅ Aedes MQTT Broker is running on port ${MQTT_PORT}`);
  });

  // 2. WebSocket Server (for Web/Mobile app)
  const httpServer = http.createServer();
  websocket.createServer({ server: httpServer }, aedes.handle);

  httpServer.listen(WS_PORT, function () {
    console.log(`🌐 Aedes WebSocket is running on port ${WS_PORT}`);
  });

  // Broker events for debugging
  aedes.on('client', (client) => {
    console.log(`🔗 MQTT Client Connected: ${client ? client.id : 'unknown'}`);
  });

  aedes.on('clientDisconnect', (client) => {
    console.log(`❌ MQTT Client Disconnected: ${client ? client.id : 'unknown'}`);
  });

  aedes.on('publish', (packet, client) => {
    if (client) {
      console.log(`📤 Message from ${client.id}: ${packet.topic} -> ${packet.payload.toString()}`);
    }
  });

  aedes.on('subscribe', (subscriptions, client) => {
    if (client) {
      console.log(`📡 Client ${client.id} subscribed to: ${subscriptions.map(s => s.topic).join(', ')}`);
    }
  });
}

module.exports = { startBroker };
