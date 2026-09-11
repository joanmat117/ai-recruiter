import { ConfigService } from "@nestjs/config";
import { IFileStorage, S3ObjectMetadata, S3PresignedGETConfig, S3PresignedPOSTConfig } from "../interfaces/file-storage.interface";
import { S3Client } from "@bradenmacdonald/s3-lite-client"
import { Injectable } from "@nestjs/common";

@Injectable()
export class S3FileStorageAdapter implements IFileStorage {

  private readonly client: S3Client

  constructor(
    private readonly configService: ConfigService
  ) {
    this.client = new S3Client({
      endPoint: this.configService.getOrThrow("S3_ENDPOINT"),
      region: "auto",
      accessKey: this.configService.getOrThrow("S3_ACCESS_KEY"),
      secretKey: this.configService.getOrThrow("S3_SECRET_KEY"),
      bucket: "ai-recruiter"
    })
  }

  async uploadFile(name: string, file: Uint8Array<ArrayBuffer>) {
    await this.client.putObject(name, file)
  }

  async deleteFile(name: string) {
    await this.client.deleteObject(name)
  }

  async downloadFile(name: string) {
    const res = await this.client.getObject(name)
    return res.arrayBuffer()
  }

  async fileExists(name: string): Promise<boolean> {

    const exists = await this.client.exists(name)

    return exists
  }

  async getMetadata(name: string): Promise<S3ObjectMetadata> {
    const { etag, key, lastModified, size, type, versionId } = await this.client.statObject(name)

    return {
      etag,
      key,
      lastModified,
      size, type, versionId: versionId || undefined
    }
  }

  async getStream(name: string): Promise<ReadableStream<Uint8Array<ArrayBuffer>> | null> {

    const res = await this.client.getObject(name)

    return res.body
  }

  async getPresignedGET(name: string, config: S3PresignedGETConfig): Promise<{ url: string; }> {
    const res = await this.client.presignedGetObject(name, {
      expirySeconds: config.expirySeconds
    })

    return {
      url: res
    }
  }

  async getPresignedPOST(name: string, config: S3PresignedPOSTConfig): Promise<{ url: string; fields: any; }> {
    const { url, fields } = await this.client.presignedPostObject(name, {
      expirySeconds: config.expirySeconds,
      conditions: config.conditions
    })

    return {
      url,
      fields
    }
  }
}
