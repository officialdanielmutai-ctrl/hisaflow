import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { AgentMessage } from '../agent/agent.types';

/**
 * Conversation memory retention. Memory is deliberately short-lived: as chats
 * pile on, old threads are deleted so the assistant stays relevant and the
 * store does not grow without bound. Tunable constants, not user input.
 */
export const CHAT_RETENTION_DAYS = 30;
export const MAX_CONVERSATIONS_PER_USER = 20;
export const HISTORY_MESSAGES = 20;

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface StoredMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

/**
 * Durable-but-pruned memory for the assistant conversation. Tenant and user
 * scope are enforced here in code (no Organization relation), so a caller can
 * never read another org's or another user's thread.
 */
@Injectable()
export class AssistantMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Start a new thread for this user; the first user message seeds the title. */
  async start(
    organizationId: string,
    userId: string,
    title?: string,
  ): Promise<ConversationSummary> {
    const cleanTitle = title?.trim().slice(0, 80) || null;
    const conversation = await this.prisma.db.assistantConversation.create({
      data: { organizationId, userId, title: cleanTitle },
    });
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
    };
  }

  /** Look up a thread only if it belongs to this org and user. */
  async getScoped(
    organizationId: string,
    userId: string,
    conversationId: string,
  ): Promise<ConversationSummary | null> {
    const conversation = await this.prisma.db.assistantConversation.findFirst({
      where: { id: conversationId, organizationId, userId },
    });
    if (!conversation) return null;
    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
    };
  }

  /** Most recent threads for the user, newest first. */
  async list(
    organizationId: string,
    userId: string,
    limit = 10,
  ): Promise<ConversationSummary[]> {
    const conversations = await this.prisma.db.assistantConversation.findMany({
      where: { organizationId, userId },
      orderBy: { lastMessageAt: 'desc' },
      take: Math.min(Math.max(1, limit), 50),
    });
    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
    }));
  }

  /**
   * Replay the last `limit` messages as model context, oldest first. Only the
   * user/assistant text turns are stored, so this is exactly what the model
   * said and heard — never tool payloads or internal identifiers.
   */
  async history(
    conversationId: string,
    organizationId: string,
    limit = HISTORY_MESSAGES,
  ): Promise<AgentMessage[]> {
    const messages = await this.prisma.db.assistantMessage.findMany({
      where: { conversationId, organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 50),
      select: { role: true, content: true },
    });
    return messages.reverse().map((message) =>
      message.role === 'assistant'
        ? { role: 'assistant' as const, content: message.content, toolCalls: [] }
        : { role: 'user' as const, content: message.content },
    );
  }

  /** Persist one turn and touch the thread's activity timestamp. */
  async append(
    conversationId: string,
    organizationId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;
    await this.prisma.db.$transaction([
      this.prisma.db.assistantMessage.create({
        data: { conversationId, organizationId, userId, role, content: trimmed },
      }),
      this.prisma.db.assistantConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);
  }

  /** Full message list for a scoped thread, oldest first. */
  async getMessages(
    organizationId: string,
    userId: string,
    conversationId: string,
    limit = 100,
  ): Promise<StoredMessage[]> {
    const conversation = await this.getScoped(
      organizationId,
      userId,
      conversationId,
    );
    if (!conversation) return [];
    const messages = await this.prisma.db.assistantMessage.findMany({
      where: { conversationId, organizationId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(1, limit), 200),
    });
    return messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }

  /**
   * Retention: delete threads older than the window, then keep only the
   * newest `MAX_CONVERSATIONS_PER_USER` per user. Cascades to messages.
   */
  async prune(organizationId: string, userId: string): Promise<void> {
    const cutoff = new Date(
      Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.prisma.db.assistantConversation.deleteMany({
      where: { organizationId, userId, lastMessageAt: { lt: cutoff } },
    });

    const stale = await this.prisma.db.assistantConversation.findMany({
      where: { organizationId, userId },
      orderBy: { lastMessageAt: 'desc' },
      skip: MAX_CONVERSATIONS_PER_USER,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.db.assistantConversation.deleteMany({
        where: { id: { in: stale.map((conversation) => conversation.id) } },
      });
    }
  }
}
