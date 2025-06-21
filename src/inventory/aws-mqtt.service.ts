import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';

@Injectable()
export class AwsMqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  onModuleInit() {
    this.connectToMqttBroker();
  }

  private connectToMqttBroker() {
    // 🔐 Leer certificados desde variables de entorno
    const key = Buffer.from(process.env.KEY_MONITORING!, 'utf-8');
    const cert = Buffer.from(process.env.CERT_MONITORING!, 'utf-8');
    const ca = Buffer.from(process.env.CA_CERT!, 'utf-8');

    this.client = mqtt.connect({
      host: 'a32p2sd11gkckn-ats.iot.us-east-2.amazonaws.com',
      port: 8883,
      protocol: 'mqtts',
      key,
      cert,
      ca,
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
