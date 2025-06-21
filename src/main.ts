import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [
      'http://localhost:5173', 
      'http://127.0.0.1:5173',
      'https://nexusutd.online',
      'https://app.nexusutd.online',
    ],
    credentials: true, // permite enviar cookies o tokens en headers
  })

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
