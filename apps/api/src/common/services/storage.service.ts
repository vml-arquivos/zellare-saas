import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface StoredFile {
  url: string;
  path: string;
}

/**
 * Abstração de storage de arquivos. Usa disco local por padrão (funciona
 * sem nenhuma configuração extra) e sobe pra S3 automaticamente se
 * AWS_S3_BUCKET estiver configurado — sem precisar trocar código em quem
 * consome este serviço, só variável de ambiente (mesmo padrão já usado
 * pelo IaAssistivaService pra trocar de provedor de IA).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly localUploadsDir = path.join(process.cwd(), 'uploads', 'institution-content');

  constructor() {
    if (!process.env.AWS_S3_BUCKET) {
      if (!fs.existsSync(this.localUploadsDir)) {
        fs.mkdirSync(this.localUploadsDir, { recursive: true });
      }
      this.logger.warn(
        'StorageService: AWS_S3_BUCKET não configurado — usando disco local. ' +
        'Configure AWS_S3_BUCKET/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY em produção ' +
        'para persistência que sobrevive a redeploys.',
      );
    }
  }

  async save(buffer: Buffer, originalName: string, mantenedoraId: string): Promise<StoredFile> {
    if (process.env.AWS_S3_BUCKET) {
      return this.saveToS3(buffer, originalName, mantenedoraId);
    }
    return this.saveToLocalDisk(buffer, originalName, mantenedoraId);
  }

  private saveToLocalDisk(buffer: Buffer, originalName: string, mantenedoraId: string): StoredFile {
    const safeExt = path.extname(originalName).slice(0, 10);
    const fileName = `${mantenedoraId}/${randomUUID()}${safeExt}`;
    const fullPath = path.join(this.localUploadsDir, fileName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return { url: `/uploads/institution-content/${fileName}`, path: fullPath };
  }

  private async saveToS3(
    buffer: Buffer,
    originalName: string,
    mantenedoraId: string,
  ): Promise<StoredFile> {
    // Import dinâmico: @aws-sdk só é necessário quando S3 está de fato configurado,
    // não obriga a instalar a dependência em quem nunca vai usar S3.
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    const safeExt = path.extname(originalName).slice(0, 10);
    const key = `institution-content/${mantenedoraId}/${randomUUID()}${safeExt}`;

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
      }),
    );

    return {
      url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
      path: key,
    };
  }
}
