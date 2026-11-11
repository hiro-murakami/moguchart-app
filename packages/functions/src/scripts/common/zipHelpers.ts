import AdmZip, { type IZipEntry } from 'adm-zip'

export const MAX_ZIP_COMPRESSED_BYTES = 50 * 1024 * 1024 // 50MB
export const MAX_ZIP_ENTRIES = 500
export const MAX_ZIP_SINGLE_ENTRY_BYTES = 50 * 1024 * 1024 // 50MB
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 150 * 1024 * 1024 // 150MB

export interface ZipSecurityLimits {
  maxCompressedBytes?: number
  maxEntries?: number
  maxSingleEntryBytes?: number
  maxTotalUncompressedBytes?: number
}

const isSafeZipEntryName = (entryName: string): boolean => {
  if (!entryName || entryName.length > 512) return false
  if (
    entryName.startsWith('/') ||
    entryName.startsWith('\\') ||
    entryName.includes('..') ||
    entryName.includes('\0') ||
    /^[A-Za-z]:/.test(entryName)
  ) {
    return false
  }
  return true
}

/**
 * ZIP バッファを安全にパースし、エントリ数・パス・宣言サイズ上限を事前検証する（ZIP Bomb / Zip Slip 対策）
 */
export const openValidatedZip = (
  zipBuffer: Buffer,
  limits?: ZipSecurityLimits,
): { zip: AdmZip; readEntryBuffer: (entry: IZipEntry, maxEntryBytes?: number) => Buffer } => {
  const maxCompressedBytes = limits?.maxCompressedBytes ?? MAX_ZIP_COMPRESSED_BYTES
  const maxEntries = limits?.maxEntries ?? MAX_ZIP_ENTRIES
  const maxSingleEntryBytes = limits?.maxSingleEntryBytes ?? MAX_ZIP_SINGLE_ENTRY_BYTES
  const maxTotalUncompressedBytes =
    limits?.maxTotalUncompressedBytes ?? MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES

  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.byteLength === 0) {
    throw new Error('Invalid zip archive')
  }
  if (zipBuffer.byteLength > maxCompressedBytes) {
    throw new Error('Zip archive exceeds maximum allowed size')
  }

  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()
  if (entries.length > maxEntries) {
    throw new Error('Zip archive contains too many entries')
  }

  let declaredTotalBytes = 0
  for (const entry of entries) {
    if (!isSafeZipEntryName(entry.entryName)) {
      throw new Error('Unsafe entry path in zip archive')
    }
    const headerSize = Number(entry.header?.size ?? 0)
    const compressedSize = Number(entry.header?.compressedSize ?? 0)
    if (!Number.isFinite(headerSize) || headerSize < 0 || headerSize > maxSingleEntryBytes) {
      throw new Error('Zip entry exceeds maximum allowed size')
    }
    if (!entry.isDirectory && compressedSize > 0 && headerSize === 0) {
      // 非空の圧縮ストリームに対しサイズ0を偽装するヘッダを拒否
      throw new Error('Malformed zip entry header')
    }
    declaredTotalBytes += headerSize
    if (declaredTotalBytes > maxTotalUncompressedBytes) {
      throw new Error('Zip archive total uncompressed size exceeds limit')
    }
  }

  let actualExtractedBytes = 0
  const readEntryBuffer = (entry: IZipEntry, maxEntryBytes = maxSingleEntryBytes): Buffer => {
    const headerSize = Number(entry.header?.size ?? 0)
    if (headerSize > maxEntryBytes) {
      throw new Error('Zip entry exceeds maximum allowed size')
    }
    if (actualExtractedBytes + headerSize > maxTotalUncompressedBytes) {
      throw new Error('Zip archive total uncompressed size exceeds limit')
    }
    const data = entry.getData()
    if (data.byteLength > maxEntryBytes) {
      throw new Error('Zip entry exceeds maximum allowed size')
    }
    actualExtractedBytes += data.byteLength
    if (actualExtractedBytes > maxTotalUncompressedBytes) {
      throw new Error('Zip archive total uncompressed size exceeds limit')
    }
    return data
  }

  return { zip, readEntryBuffer }
}
