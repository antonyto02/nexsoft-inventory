import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AwsS3Service {
  private s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  async generateSignedUrl(type: string, ext: string) {
    if (!type || !ext) {
      throw new BadRequestException('Missing query parameters: type and ext are required');
    }

    const timestamp = Date.now();
    const filename = `temp_upload_url_${timestamp}.${ext}`;
    const key = `logos/${filename}`; // O puedes usar `${type}/${filename}` si quieres más carpetas

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: `image/${ext}`,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 }); // 5 min

    const finalUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return {
      upload_url: uploadUrl,
      final_url: finalUrl,
    };
  }
}
