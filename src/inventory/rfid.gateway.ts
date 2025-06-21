import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class RfidGateway {
  @WebSocketServer()
  server: Server;

  sendToFrontend(tag: string) {
    this.server.emit('rfid-scan', { rfid_tag: tag });
  }
}
