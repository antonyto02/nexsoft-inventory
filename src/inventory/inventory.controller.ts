import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  BadRequestException,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import { RfidService } from './rfid/rfid.service';
import { ProductsService } from './products/products.service';
import { MovementsService } from './movements/movements.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly rfidService: RfidService,
    private readonly productsService: ProductsService,
    private readonly movementsService: MovementsService,
  ) {}

  @Get('home')
  getHome(@Req() req: Request) {
    const companyId = (req as any).user?.companyId;
    console.log('company_id del usuario:', companyId);
    if (!companyId) {
      throw new UnauthorizedException('Falta company_id en el token');
    }
    return this.inventoryService.getHomeSummary(companyId);
  }

  @Patch('rfid-mode')
  setRfidMode(@Body('entry_mode') entryMode?: boolean) {
    if (entryMode === undefined) {
      throw new BadRequestException("El campo 'entry_mode' es obligatorio");
    }
    this.rfidService.setEntryMode(entryMode);
    return {
      message: entryMode ? 'Modo entrada activado' : 'Modo entrada desactivado',
    };
  }

  @Get('rfid-mode')
  getRfidMode() {
    return {
      entry_mode: this.rfidService.getEntryMode(),
    };
  }

  @Post('voice-to-action')
  async voiceToAction(@Body() body: { productId: number; text: string }) {
    console.log('voice-to-action body:', body);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('OpenAI API key not configured');
    }

    const prompt =
      'Eres un asistente de inventario que interpreta frases habladas por el usuario y las convierte en acciones del sistema. Tu objetivo es transformar cada frase en un JSON válido para registrar un movimiento o editar un producto.\n\nResponde **únicamente** con un objeto JSON, sin explicaciones ni texto adicional. Si no puedes interpretar la frase, responde con un JSON vacío: {}.\n\n---\n\n🔹 Si el usuario quiere **editar un producto**, responde con:\n\n{\n  "accion": "editar",\n  "productId": <ID del producto>,\n  "patch": {\n    "name": "Nuevo nombre",\n    "brand": "Nueva marca",\n    "description": "Texto nuevo",\n    "stock_minimum": 10,\n    "stock_maximum": 50,\n    "category": "nombre o id"\n  }\n}\n\n- Solo incluye los campos mencionados por el usuario.\n- **No incluyas `image_url`**.\n- Si no se menciona ningún campo editable, responde {}.\n\n---\n\n🔹 Si el usuario quiere **registrar un movimiento**, responde con:\n\n{\n  "accion": "movimiento",\n  "productId": <ID del producto>,\n  "movement": {\n    "type": 1,\n    "quantity": 5,\n    "note": "por emergencia"\n  }\n}\n\n📌 **Los tres campos de `movement` son obligatorios**.\nSi no puedes inferir claramente todos (tipo, cantidad y nota), responde {}.\n\n---\n\n🔸 Regla general:\n- Si la frase **no tiene sentido** para un sistema de inventario (ej. “tengo hambre”, “la carne estaba rica”), responde con {}.\n\nEl campo `productId` será proporcionado por el backend. No lo cambies ni lo infieras. Usa exactamente el mismo valor que te proporcionen.';

    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: body.text },
        ],
        temperature: 0,
      }),
    });

    const aiJson = await openAiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    console.log('Respuesta GPT:', content);
    let parsed: any = {};
    try {
      parsed = content ? JSON.parse(content) : {};
      console.log('JSON generado por GPT:', parsed);
    } catch (err) {
      console.error('Error al parsear JSON:', err);
      parsed = {};
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
      return { message: 'No se pudo interpretar la acción de la voz' };
    }

    if (parsed.accion === 'editar' && parsed.productId && parsed.patch) {
      await this.productsService.update(String(parsed.productId), parsed.patch);
      return { message: 'Producto actualizado correctamente' };
    }

    if (parsed.accion === 'movimiento' && parsed.productId && parsed.movement) {
      await this.movementsService.createManual(
        String(parsed.productId),
        parsed.movement,
      );
      return { message: 'Movimiento registrado correctamente' };
    }

    return { message: 'No se pudo interpretar la acción de la voz' };
  }
}
