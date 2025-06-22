import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class RfidGateway {
  @WebSocketServer()
  server: Server;

  emitTagDetected(tag: string) {
    this.server.emit('rfid-tag-detected', { rfid_tag: tag });
  }
}
