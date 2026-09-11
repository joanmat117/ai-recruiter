
export interface S3ObjectMetadata {
  etag: string,
  size: number,
  key: string,
  lastModified: Date,
  type: string,
  versionId?: string
}

export interface S3PresignedGETConfig {
  expirySeconds: number
}

export interface S3PresignedPOSTConfig {
  expirySeconds: number,
  conditions?: any[]
}

export interface IFileStorage {
  uploadFile: (name: string, file: Uint8Array<ArrayBuffer>) => Promise<void>,
  downloadFile: (name: string) => Promise<ArrayBuffer>,
  deleteFile: (name: string) => Promise<void>,
  getStream: (name: string) => Promise<ReadableStream<Uint8Array<ArrayBuffer>> | null>,
  fileExists: (name: string) => Promise<boolean>,
  getMetadata: (name: string) => Promise<S3ObjectMetadata>,
  getPresignedGET: (name: string, config: S3PresignedGETConfig) => Promise<{ url: string }>,
  getPresignedPOST: (name: string, config: S3PresignedPOSTConfig) => Promise<{ url: string, fields: Record<string, string> }>
}

export const FILE_STORAGE = Symbol("IFileStorage")
