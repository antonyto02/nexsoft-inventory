import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true, namespace: '/inventory' })
export class InventoryGateway {
  @WebSocketServer()
  server: Server;

  emitInventoryUpdate(payload: any) {
    this.server.emit('inventory:update', payload);
  }
}
