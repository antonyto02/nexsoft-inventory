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
import { getMexicoCityISO, formatMexicoCity } from '../utils/time';

dotenv.config();

@Injectable()
export class AwsMqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  private weightState: Record<
    'weight1' | 'weight2',
    {
      lastWeight: number | null;
      stableWeight: number | null;
      weightStableCount: number;
      waiting: boolean;
    }
  > = {
    weight1: { lastWeight: null, stableWeight: null, weightStableCount: 0, waiting: false },
    weight2: { lastWeight: null, stableWeight: null, weightStableCount: 0, waiting: false },
  };

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

  publish(topic: string, payload: any) {
    if (this.client && this.client.connected) {
      this.client.publish(topic, JSON.stringify(payload));
    } else {
      console.warn('[MQTT] No conectado, mensaje no enviado');
    }
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
        } else if (topic === 'nexsoft/inventory/weight1') {
          await this.processWeight(parsed, 'weight1');
        } else if (topic === 'nexsoft/inventory/weight2') {
          await this.processWeight(parsed, 'weight2');
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
        movement_date: getMexicoCityISO(),
      });
      await this.movementRepository.save(movement);

      product.stock = finalQuantity;
      await this.productRepository.save(product);

      await this.stockEntryRepository.delete({ id: existing.id });
      console.log(`[RFID] Procesado y eliminado: ${tag}`);

      const remaining = await this.stockEntryRepository.find({
        where: { product: { id: product.id } },
        order: { expiration_date: 'ASC' },
      });
      const nextEntry = remaining.find((e) => !!e.expiration_date);
      const expirationDate = nextEntry?.expiration_date
        ? new Date(nextEntry.expiration_date as unknown as string)
            .toISOString()
            .split('T')[0]
        : undefined;
      const payload = {
        cardData: {
          id: product.id,
          stock_actual: Number(product.stock),
          ...(expirationDate && { expiration_date: expirationDate }),
        },
        detailData: {
          id: product.id,
          stock_actual: Number(product.stock),
          last_updated: product.updated_at,
        },
        movementData: {
          id: movement.id,
          ...formatMexicoCity(movement.movement_date),
          type: movement.type.name,
          stock_before: Number(movement.previous_quantity),
          quantity: Number(movement.quantity),
          stock_after: Number(movement.final_quantity),
          comment: movement.comment,
        },
      };

      console.log('✅ Emitiendo evento WebSocket', JSON.stringify(payload, null, 2));

      this.rfidGateway.emitProductUpdated(payload);


      this.rfidGateway.emitProductUpdated({
        cardData: {
          id: product.id,
          stock_actual: Number(product.stock),
          ...(expirationDate && { expiration_date: expirationDate }),
        },
        detailData: {
          id: product.id,
          stock_actual: Number(product.stock),
          last_updated: product.updated_at,
        },
        movementData: {
          id: movement.id,
          ...formatMexicoCity(movement.movement_date),
          type: movement.type.name,
          stock_before: Number(movement.previous_quantity),
          quantity: Number(movement.quantity),
          stock_after: Number(movement.final_quantity),
          comment: movement.comment,
        },
      });
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
      movement_date: getMexicoCityISO(),
    });
    await this.movementRepository.save(movement);

    product.stock = finalQuantity;
    await this.productRepository.save(product);

    console.log(`[CAMERA] Stock actualizado de ${prevQuantity} a ${finalQuantity}`);

    const remaining = await this.stockEntryRepository.find({
      where: { product: { id: product.id } },
      order: { expiration_date: 'ASC' },
    });
    const nextEntry = remaining.find((e) => !!e.expiration_date);
    const expirationDate = nextEntry?.expiration_date
      ? new Date(nextEntry.expiration_date as unknown as string)
          .toISOString()
          .split('T')[0]
      : undefined;

    const payload = {
      cardData: {
        id: product.id,
        stock_actual: Number(product.stock),
        ...(expirationDate && { expiration_date: expirationDate }),
      },
      detailData: {
        id: product.id,
        stock_actual: Number(product.stock),
        last_updated: product.updated_at,
      },
      movementData: {
        id: movement.id,
        ...formatMexicoCity(movement.movement_date),
        type: movement.type.name,
        stock_before: Number(movement.previous_quantity),
        quantity: Number(movement.quantity),
        stock_after: Number(movement.final_quantity),
        comment: movement.comment,
      },
    };

    console.log('✅ Emitiendo evento WebSocket', JSON.stringify(payload, null, 2));
    this.rfidGateway.emitProductUpdated(payload);
  }

  private async processWeight(parsed: any, sensor: 'weight1' | 'weight2') {
    console.log(`[${sensor.toUpperCase()}] Datos recibidos:`, parsed);

    const state = this.weightState[sensor];
    const value = Number(parsed?.value);
    if (isNaN(value)) return;

    if (state.lastWeight === null) {
      state.lastWeight = value;
      state.stableWeight = value;
      return;
    }

    const diff = Math.abs(value - state.lastWeight);

    if (!state.waiting) {
      if (diff > 10) {
        state.waiting = true;
        state.weightStableCount = 0;
      }
    } else {
      if (diff <= 10) {
        state.weightStableCount++;
        if (state.weightStableCount >= 5) {
          if (state.stableWeight !== null && state.stableWeight !== value) {
            const prevQuantity = state.stableWeight;
            const finalQuantity = value;
            const productId = sensor === 'weight1' ? 1000 : 1001;
            const product = await this.productRepository.findOne({ where: { id: productId } });
            const typeId = finalQuantity > prevQuantity ? 1 : 2;
            const movementType = await this.movementTypeRepository.findOne({ where: { id: typeId } });
            if (product && movementType) {
              const movement = this.movementRepository.create({
                product,
                type: movementType,
                quantity: Number(Math.abs(finalQuantity - prevQuantity).toFixed(2)),
                previous_quantity: prevQuantity,
                final_quantity: finalQuantity,
                movement_date: getMexicoCityISO(),
              });
              await this.movementRepository.save(movement);

              product.stock = finalQuantity;
              await this.productRepository.save(product);

              const remaining = await this.stockEntryRepository.find({
                where: { product: { id: product.id } },
                order: { expiration_date: 'ASC' },
              });
              const nextEntry = remaining.find((e) => !!e.expiration_date);
              const expirationDate = nextEntry?.expiration_date
                ? new Date(nextEntry.expiration_date as unknown as string)
                    .toISOString()
                    .split('T')[0]
                : undefined;

              const payload = {
                cardData: {
                  id: product.id,
                  stock_actual: Number(product.stock),
                  ...(expirationDate && { expiration_date: expirationDate }),
                },
                detailData: {
                  id: product.id,
                  stock_actual: Number(product.stock),
                  last_updated: product.updated_at,
                },
                movementData: {
                  id: movement.id,
                  ...formatMexicoCity(movement.movement_date),
                  type: movement.type.name,
                  stock_before: Number(movement.previous_quantity),
                  quantity: Number(movement.quantity),
                  stock_after: Number(movement.final_quantity),
                  comment: movement.comment,
                },
              };

              console.log('✅ Emitiendo evento WebSocket', JSON.stringify(payload, null, 2));
              this.rfidGateway.emitProductUpdated(payload);
            }
          }

          state.stableWeight = value;
          state.waiting = false;
          state.weightStableCount = 0;
        }
      } else {
        state.weightStableCount = 0;
      }
    }

    state.lastWeight = value;
  }
}
