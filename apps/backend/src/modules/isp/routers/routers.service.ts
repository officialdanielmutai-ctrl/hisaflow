import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CreateRouterDto } from './dto/create-router.dto';
import { UpdateRouterDto } from './dto/update-router.dto';
import { RouterStatus } from '@prisma/client';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256-bit

function getEncryptionKey(): Buffer {
  const raw = process.env.ROUTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ROUTER_ENCRYPTION_KEY env var is not set');
  }
  // Accept a 64-char hex key or a plain string padded/hashed to 32 bytes
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  // Derive a 32-byte key via SHA-256 if the key isn't already hex-encoded
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptPassword(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // fresh IV per operation
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  // Store as "ivHex:ciphertextHex" — IV is never secret, but must be unique
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptPassword(stored: string): string {
  const key = getEncryptionKey();
  const [ivHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !ciphertextHex) {
    throw new Error('Malformed encrypted password — expected iv:ciphertext format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs?: number;
  routerIdentity?: string;
  error?: string;
}

@Injectable()
export class RoutersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async create(organizationId: string, dto: CreateRouterDto) {
    const apiPasswordEnc = encryptPassword(dto.apiPassword);
    return this.prisma.db.router.create({
      data: {
        organizationId,
        label: dto.label,
        host: dto.host,
        port: dto.port ?? 8729,
        apiUsername: dto.apiUsername,
        apiPasswordEnc,
      },
      select: this.safeSelect(),
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.db.router.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: this.safeSelect(),
    });
  }

  async findOne(organizationId: string, id: string) {
    const router = await this.prisma.db.router.findFirst({
      where: { id, organizationId },
      select: this.safeSelect(),
    });
    if (!router) throw new NotFoundException(`Router ${id} not found`);
    return router;
  }

  async update(organizationId: string, id: string, dto: UpdateRouterDto) {
    await this.findOne(organizationId, id);
    const data: any = { ...dto };
    if (dto.apiPassword) {
      data.apiPasswordEnc = encryptPassword(dto.apiPassword);
      delete data.apiPassword;
    }
    return this.prisma.db.router.update({
      where: { id },
      data,
      select: this.safeSelect(),
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.db.router.delete({ where: { id } });
  }

  // ── Connection Test ─────────────────────────────────────────────────────────

  async testConnection(organizationId: string, id: string): Promise<TestConnectionResult> {
    const router = await this.prisma.db.router.findFirst({
      where: { id, organizationId },
    });
    if (!router) throw new NotFoundException(`Router ${id} not found`);

    const start = Date.now();
    try {
      const password = decryptPassword(router.apiPasswordEnc);
      const result = await this.connectAndRun(router.host, router.port, router.apiUsername, password);

      const latencyMs = Date.now() - start;
      await this.prisma.db.router.update({
        where: { id },
        data: {
          connectionStatus: RouterStatus.CONNECTED,
          lastTestedAt: new Date(),
          lastError: null,
        },
      });

      return { success: true, latencyMs, routerIdentity: result };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errorMsg = err?.message ?? 'Unknown error';
      await this.prisma.db.router.update({
        where: { id },
        data: {
          connectionStatus: RouterStatus.ERROR,
          lastTestedAt: new Date(),
          lastError: errorMsg,
        },
      });
      return { success: false, latencyMs, error: errorMsg };
    }
  }

  /**
   * Opens an API-SSL connection, runs /system/identity/print, closes, returns identity name.
   * Times out after 5 seconds.
   */
  async connectAndRun(
    host: string,
    port: number,
    username: string,
    password: string,
  ): Promise<string> {
    const RouterOSClient = require('routeros-client').RouterOSClient;

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out after 5 seconds'));
      }, 5000);

      const client = new RouterOSClient({
        host,
        port,
        user: username,
        password,
        tls: { rejectUnauthorized: false }, // self-signed certs are common on MikroTik
      });

      client.connect()
        .then(async (conn: any) => {
          try {
            const res = await conn.menu('/system/identity').get();
            clearTimeout(timeout);
            client.disconnect();
            resolve(res[0]?.name ?? 'Unknown');
          } catch (e) {
            clearTimeout(timeout);
            client.disconnect();
            reject(e);
          }
        })
        .catch((e: any) => {
          clearTimeout(timeout);
          reject(e);
        });
    });
  }

  /**
   * Returns a router record with decrypted password.
   * Only used internally by RouterActionService — never sent over HTTP.
   */
  async findWithCredentials(organizationId: string, id: string) {
    const router = await this.prisma.db.router.findFirst({
      where: { id, organizationId },
    });
    if (!router) throw new NotFoundException(`Router ${id} not found`);
    return {
      ...router,
      apiPassword: decryptPassword(router.apiPasswordEnc),
    };
  }

  // Never expose the encrypted password field in HTTP responses
  private safeSelect() {
    return {
      id: true,
      organizationId: true,
      label: true,
      host: true,
      port: true,
      apiUsername: true,
      connectionStatus: true,
      lastTestedAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { subscribers: true } },
    } as const;
  }
}
