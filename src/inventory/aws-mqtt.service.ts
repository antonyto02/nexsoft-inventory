import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as mqtt from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { StockEntry } from './entities/stock-entry.entity';

dotenv.config(); // Solo útil en local

@Injectable()
export class AwsMqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  constructor(
    @InjectRepository(StockEntry)
    private readonly stockEntryRepository: Repository<StockEntry>,
  ) {}

  onModuleInit() {
    this.connectToMqttBroker();
  }

  private connectToMqttBroker() {
    const isProduction = process.env.NODE_ENV === 'production';
    const certsPath = path.resolve(__dirname, '../../certs');

    const key = isProduction
      ? Buffer.from(process.env.KEY_MONITORING!, 'utf-8')
      : fs.readFileSync(`${certsPath}/monitoring-private.pem.key`);

    const cert = isProduction
      ? Buffer.from(process.env.CERT_MONITORING!, 'utf-8')
      : fs.readFileSync(`${certsPath}/monitoring-cert.pem.crt`);

    const ca = isProduction
      ? Buffer.from(process.env.CA_CERT!, 'utf-8')
      : fs.readFileSync(`${certsPath}/AmazonRootCA1.pem`);

    this.client = mqtt.connect({
      host: 'a32p2sd11gkckn-ats.iot.us-east-2.amazonaws.com',
      port: 8883,
      protocol: 'mqtts',
      key,
      cert,
      ca,
      clean: true,
      clientId: `nexsoft-inventory-backend-${Math.random().toString(16).slice(2)}`, // único para evitar reconexión
    });

    this.client.on('connect', () => {
      console.log('[MQTT] ✅ Conectado a AWS IoT');
      this.client.subscribe('nexsoft/inventory/#', (err) => {
        if (err) {
          console.error('[MQTT] ❌ Error al suscribirse:', err);
        } else {
          console.log('[MQTT] 📡 Suscrito a nexsoft/inventory/#');
        }
      });
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT] 🔁 Intentando reconectar...');
    });

    this.client.on('close', () => {
      console.warn('[MQTT] 🔌 Conexión cerrada por AWS');
    });

    this.client.on('error', (error) => {
      console.error('[MQTT] 🚨 Error:', error);
    });

    this.client.on('message', async (topic, message) => {
      const data = message.toString();
      console.log(`[MQTT] 📩 Mensaje recibido en "${topic}": "${data}"`);

      if (topic === 'nexsoft/inventory/rfid') {
        try {
          const parsed = JSON.parse(data);
          const tag = parsed?.rfid_tag;
          if (typeof tag === 'string') {
            const existing = await this.stockEntryRepository.findOne({
              where: { rfid_tag: tag },
            });
            if (existing) {
              await this.stockEntryRepository.delete({ id: existing.id });
              console.log(`[RFID] Etiqueta eliminada: ${tag}`);
            }
          }
        } catch (err) {
          console.error('[MQTT] Error procesando mensaje RFID:', err);
        }
      }
    });
  }
}
