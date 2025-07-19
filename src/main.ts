import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [
      'http://localhost:5173', 
      'http://127.0.0.1:5173',
      'https://nexusutd.online',
      'https://10.84.229.36:5173',
    ],
    credentials: true, // permite enviar cookies o tokens en headers
  })

  await app.listen(process.env.PORT ?? 3000)
  
}
bootstrap()
