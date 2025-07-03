import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface ProductUpdatePayload {
  cardData: {
    id: number;
    stock_actual: number;
    expiration_date?: string;
  };
  detailData: {
    id: number;
    stock_actual: number;
    last_updated: Date;
  };
  movementData: {
    id: number;
    date: string;
    time: string;
    type: string;
    stock_before: number;
    quantity: number;
    stock_after: number;
    comment: string;
  };
}

@WebSocketGateway({ cors: true })
export class RfidGateway {
  @WebSocketServer()
  server: Server;

  emitTagDetected(tag: string) {
    this.server.emit('rfid-tag-detected', { rfid_tag: tag });
  }

  emitProductUpdated(data: ProductUpdatePayload) {
    console.log('🔁 Enviando evento product-updated...');
    this.server.emit('product-updated', data); // <-- este es el evento que tu HTML escucha
  }
}
