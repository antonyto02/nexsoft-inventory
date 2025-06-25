import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class RfidGateway {
  @WebSocketServer()
  server: Server;

  emitTagDetected(tag: string) {
    this.server.emit('rfid-tag-detected', { rfid_tag: tag });
  }

  emitProductUpdated(data: any) {
    console.log('🔁 Enviando evento product-updated...');
    this.server.emit('product-updated', data); // <-- este es el evento que tu HTML escucha
  }
}
