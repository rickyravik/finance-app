import {
  randomBytes,
  pbkdf2Sync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { backupPayloadSchema, type BackupPayload } from "../domain/model";

const ALGORITHM = "aes-256-gcm";
const HASH = "sha256";
const ITERATIONS = 100_000;
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;
const MIN_PASSPHRASE_LEN = 8;

interface BackupEnvelope {
  version: 1;
  algorithm: typeof ALGORITHM;
  salt: string;
  iv: string;
  tag: string;
  data: string;
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (passphrase.length < MIN_PASSPHRASE_LEN) {
    throw new Error("Passphrase must be at least 8 characters");
  }
  return pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LEN, HASH);
}

export function encryptBackup(
  payload: BackupPayload,
  passphrase: string,
): string {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plainText = JSON.stringify(backupPayloadSchema.parse(payload));
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const envelope: BackupEnvelope = {
    version: 1,
    algorithm: ALGORITHM,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
  };
  return JSON.stringify(envelope);
}

export function decryptBackup(
  envelopeJson: string,
  passphrase: string,
): BackupPayload {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    throw new Error("Invalid backup envelope format");
  }
  if (!envelope || envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
    throw new Error("Unsupported backup format or version");
  }
  const salt = Buffer.from(envelope.salt, "hex");
  const iv = Buffer.from(envelope.iv, "hex");
  const tag = Buffer.from(envelope.tag, "hex");
  const data = Buffer.from(envelope.data, "hex");
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  try {
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return backupPayloadSchema.parse(JSON.parse(decrypted.toString("utf8")));
  } catch {
    throw new Error("Invalid backup passphrase or corrupted file");
  }
}
