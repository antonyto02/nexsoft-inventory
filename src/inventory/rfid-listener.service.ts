import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { EntryModeService } from './rfid/entry-mode.service';
import { RfidGateway } from './rfid.gateway';

dotenv.config();

@Injectable()
export class RfidListenerService implements OnModuleInit {
  private client: mqtt.MqttClient;

  constructor(
    private readonly entryModeService: EntryModeService,
    private readonly gateway: RfidGateway,
  ) {}

  onModuleInit() {
    this.connect();
  }

  private connect() {
    const isProduction = process.env.NODE_ENV === 'production';
    const certsPath = path.resolve(__dirname, '../certs');

    const key = isProduction
      ? Buffer.from(process.env.KEY_MONITORING || '', 'utf-8')
      : fs.readFileSync(`${certsPath}/monitoring-private.pem.key`);

    const cert = isProduction
      ? Buffer.from(process.env.CERT_MONITORING || '', 'utf-8')
      : fs.readFileSync(`${certsPath}/monitoring-cert.pem.crt`);

    const ca = isProduction
      ? Buffer.from(process.env.CA_CERT || '', 'utf-8')
      : fs.readFileSync(`${certsPath}/AmazonRootCA1.pem`);

    this.client = mqtt.connect({
      host: 'a32p2sd11gkckn-ats.iot.us-east-2.amazonaws.com',
      port: 8883,
      protocol: 'mqtts',
      key,
      cert,
      ca,
      clean: true,
      clientId: `nexsoft-rfid-listener-${Math.random().toString(16).slice(2)}`,
    });

    this.client.on('connect', () => {
      this.client.subscribe('nexsoft/inventory/rfid', (err) => {
        if (err) {
          console.error('[RFID LISTENER] Error al suscribirse:', err);
        } else {
          console.log('[RFID LISTENER] Suscrito a nexsoft/inventory/rfid');
        }
      });
    });

    this.client.on('message', (topic, payload) => {
      if (topic !== 'nexsoft/inventory/rfid') return;

      try {
        const data = JSON.parse(payload.toString());
        const tag = data.rfid_tag;
        if (this.entryModeService.getEntryMode()) {
          this.gateway.sendToFrontend(tag);
        } else {
          // modo salida
          return;
        }
      } catch (err) {
        console.error('[RFID LISTENER] Error procesando mensaje', err);
      }
    });
  }
}
