import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  const options = new DocumentBuilder()
    .setTitle('Attendance API Collection')
    .setDescription('APIs of Attendacne Service')
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'Authorization', in: 'header' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);
  app.enableCors();
  await app.listen(6000, () => {
    console.log(`Server attendance on port 6000`);
  });
}
bootstrap();

