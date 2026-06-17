import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AppModule } from '../src/app.module';

async function generateOpenApiSpec() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('2K Cargo API')
    .setDescription(
      'REST API wrapper over the 2K Cargo cargo-tracking website.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'opaque UUID' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = path.resolve(process.cwd(), 'openapi.yaml');

  fs.writeFileSync(outputPath, yaml.dump(document, { lineWidth: -1 }));
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outputPath}`);

  await app.close();
}

void generateOpenApiSpec();
