import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as mqtt from 'mqtt';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { StockEntry } from './entities/stock-entry.entity';
import { Product } from './entities/product.entity';
import { Movement } from './entities/movement.entity';
import { MovementType } from './entities/movement-type.entity';
import { RfidGateway } from './gateways/rfid.gateway';

dotenv.config();

@Injectable()
export class AwsMqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  constructor(
    @InjectRepository(StockEntry)
    private readonly stockEntryRepository: Repository<StockEntry>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Movement)
    private readonly movementRepository: Repository<Movement>,
    @InjectRepository(MovementType)
    private readonly movementTypeRepository: Repository<MovementType>,
    private readonly rfidGateway: RfidGateway,
  ) {}

  onModuleInit() {
    this.connectToMqttBroker();
  }

  private connectToMqttBroker() {
    const mode = process.env.MQTT_MODE || 'local';

    if (mode === 'local') {
      console.log('[MQTT] 🔌 Conectando a Mosquitto local...');

      this.client = mqtt.connect({
        host: process.env.MQTT_LOCAL_HOST || 'localhost',
        port: Number(process.env.MQTT_LOCAL_PORT || 1883),
        protocol: process.env.MQTT_LOCAL_PROTOCOL as 'mqtt' || 'mqtt',
        clientId: process.env.MQTT_LOCAL_CLIENT_ID || 'nexsoft-inventory-local',
        reconnectPeriod: 1000,
      });
    } else if (mode === 'prod') {
      console.log('[MQTT] 🔐 Conectando a AWS IoT Core...');

      const certsPath = path.resolve(__dirname, '../../certs');

      const key = process.env.KEY_INVENTORY
        ? Buffer.from(process.env.KEY_INVENTORY, 'utf-8')
        : fs.readFileSync(`${certsPath}/inventory-private.pem.key`);

      const cert = process.env.CERT_INVENTORY
        ? Buffer.from(process.env.CERT_INVENTORY, 'utf-8')
        : fs.readFileSync(`${certsPath}/inventory-cert.pem.crt`);

      const ca = process.env.CA_CERT
        ? Buffer.from(process.env.CA_CERT, 'utf-8')
        : fs.readFileSync(`${certsPath}/AmazonRootCA1.pem`);

      this.client = mqtt.connect({
        host: process.env.MQTT_AWS_HOST,
        port: Number(process.env.MQTT_AWS_PORT || 8883),
        protocol: process.env.MQTT_AWS_PROTOCOL as 'mqtts',
        key,
        cert,
        ca,
        clean: true,
        clientId: process.env.MQTT_AWS_CLIENT_ID || `nexsoft-inventory-backend-${Math.random().toString(16).slice(2)}`,
        rejectUnauthorized: true,
      });
    } else {
      throw new Error(`[MQTT] ❌ Modo desconocido: ${mode}`);
    }

    this.client.on('connect', () => {
      console.log('[MQTT] ✅ Conectado');
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
      console.warn('[MQTT] 🔌 Conexión cerrada');
    });

    this.client.on('error', (error) => {
      console.error('[MQTT] 🚨 Error:', error);
    });

    this.client.on('message', async (topic, message) => {
      const data = message.toString();
      console.log(`[MQTT] 📩 ${topic}: ${data}`);
      try {
        const parsed = JSON.parse(data);
        if (topic === 'nexsoft/inventory/rfid') {
          await this.processRfid(parsed);
        } else if (topic === 'nexsoft/inventory/camera') {
          await this.processCamera(parsed);
        }
      } catch (err) {
        console.error('[MQTT] ❌ Error procesando mensaje:', err);
      }
    });
  }

  private async processRfid(parsed: any) {
    const tag = parsed?.rfid_tag?.trim();
    if (!tag) return;

    const existing = await this.stockEntryRepository.findOne({
      where: { rfid_tag: tag },
      relations: ['product'],
    });

    if (existing) {
      const product = existing.product;
      const prevQuantity = Number(product.stock);
      const finalQuantity = prevQuantity - 1;
      const movementType = await this.movementTypeRepository.findOne({ where: { id: 2 } });
      if (!movementType) return;

      const movement = this.movementRepository.create({
        product,
        type: movementType,
        quantity: 1,
        previous_quantity: prevQuantity,
        final_quantity: finalQuantity,
        comment: 'Salida',
        movement_date: new Date(),
      });
      await this.movementRepository.save(movement);

      product.stock = finalQuantity;
      await this.productRepository.save(product);

      await this.stockEntryRepository.delete({ id: existing.id });
      console.log(`[RFID] Procesado y eliminado: ${tag}`);
    } else {
      this.rfidGateway.emitTagDetected(tag);
    }
  }

  private async processCamera(parsed: any) {
    const bottles = parsed?.botellas;
    if (typeof bottles !== 'number') return;

    const product = await this.productRepository.findOne({ where: { id: 1 } });
    if (!product || Number(product.stock) === bottles) return;

    const prevQuantity = Number(product.stock);
    const finalQuantity = bottles;
    const typeId = finalQuantity > prevQuantity ? 1 : 2;
    const movementType = await this.movementTypeRepository.findOne({ where: { id: typeId } });
    if (!movementType) return;

    const movement = this.movementRepository.create({
      product,
      type: movementType,
      quantity: Math.abs(finalQuantity - prevQuantity),
      previous_quantity: prevQuantity,
      final_quantity: finalQuantity,
      movement_date: new Date(),
    });
    await this.movementRepository.save(movement);

    product.stock = finalQuantity;
    await this.productRepository.save(product);

    console.log(`[CAMERA] Stock actualizado de ${prevQuantity} a ${finalQuantity}`);
  }
}