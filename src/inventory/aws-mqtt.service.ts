import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AwsMqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  onModuleInit() {
    this.connectToMqttBroker();
  }

  private connectToMqttBroker() {
    const certsPath = path.resolve(__dirname, '../../certs');



    this.client = mqtt.connect({
      host: 'a32p2sd11gkckn-ats.iot.us-east-2.amazonaws.com',
      port: 8883,
      protocol: 'mqtts',
      key: fs.readFileSync(`${certsPath}/monitoring-private.pem.key`),
      cert: fs.readFileSync(`${certsPath}/monitoring-cert.pem.crt`),
      ca: fs.readFileSync(`${certsPath}/AmazonRootCA1.pem`),
      clientId: 'nexsoft-inventory-backend',
    });

    this.client.on('connect', () => {
      console.log('[MQTT] Conectado a AWS IoT ✅');
      this.client.subscribe('nexsoft/inventory/#', (err) => {
        if (err) {
          console.error('[MQTT] Error al suscribirse:', err);
        } else {
          console.log('[MQTT] Suscrito a nexsoft/inventory/#');
        }
      });
    });

    this.client.on('message', async (topic, message) => {
      const data = message.toString();
      console.log(`[MQTT] Mensaje recibido en ${topic}:`, data);

      // 👉 Aquí Codex agregará la lógica de guardado en base de datos
    });

    this.client.on('error', (error) => {
      console.error('[MQTT] Error:', error);
    });
  }
}
