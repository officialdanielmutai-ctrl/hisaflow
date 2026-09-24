'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  ArrowLeft,
  Lock,
  ShieldCheck,
  Bot,
  User,
  Radio,
  Clock,
  AlertTriangle,
  Send,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { adminFetch } from '@/lib/api-client';
import { ConversationSummary, MessageItem, AccountDetailResponse } from '@/lib/types';

export default function OrganizationConversationViewerPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accessReason, setAccessReason] = useState<string>('Support ticket');
  const [selectedConvId, setSelectedConvId] = useState<string>('conv-ai-ingestion');

  useEffect(() => {
    const token = sessionStorage.getItem(`msg_access_${orgId}`);
    const reason = sessionStorage.getItem(`msg_reason_${orgId}`) || 'Support ticket';
    if (token) {
      setAccessToken(token);
      setAccessReason(reason);
    }
  }, [orgId]);

  // Fetch org name
  const { data: orgData } = useSWR<AccountDetailResponse>(
    orgId ? `/admin/accounts/${orgId}` : null,
    (url: string) => adminFetch(url),
  );

  // Fetch conversations list with access token header
  const { data: convsData, error: convsError, mutate: mutateConvs } = useSWR<ConversationSummary[]>(
    orgId && accessToken ? `/admin/messages/${orgId}/conversations` : null,
    (url: string) =>
      adminFetch(url, {
        headers: { 'x-message-access-token': accessToken! },
      }),
  );

  // Fetch active conversation messages
  const { data: messagesData, error: msgError, mutate: mutateMessages } = useSWR<MessageItem[]>(
    orgId && accessToken && selectedConvId
      ? `/admin/messages/${orgId}/conversations/${selectedConvId}`
      : null,
    (url: string) =>
      adminFetch(url, {
        headers: { 'x-message-access-token': accessToken! },
      }),
  );

  const org = orgData?.organization;
  const conversations = convsData || [];
  const messages = messagesData || [];

  // If no access token is in session, show blocked gate
  if (!accessToken) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-base font-bold text-white">Observability Session Required</h1>
        <p className="text-xs text-slate-400">
          Viewing communications requires a verified operational reason token. Please return to the messages hub to
          authorize your session.
        </p>
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Go to Messages Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Persistent Audit Banner */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>OBSERVABILITY MODE (READ-ONLY)</strong> — Viewing communication history for{' '}
            <span className="font-semibold text-white">{org?.name || orgId}</span> • Reason: "{accessReason}" • Access logged
          </span>
        </div>
        <Link
          href="/messages"
          className="text-[11px] underline hover:text-white transition-colors ml-4 shrink-0 font-mono"
        >
          Exit Session
        </Link>
      </div>

      {/* Main 2-Column Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-230px)] min-h-[500px]">
        {/* Left Column: Channels List */}
        <div className="lg:col-span-4 bg-admin-900/80 border border-admin-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-admin-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Channels & Threads
            </h2>
            <button
              onClick={() => {
                mutateConvs();
                mutateMessages();
              }}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-admin-800/60">
            {conversations.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                Loading channels...
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = selectedConvId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-brand-600/15 border-l-2 border-brand-500'
                        : 'hover:bg-admin-850/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span className="truncate">{c.title}</span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                        {c.messageCount} msgs
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-1">{c.lastMessageSnippet}</p>
                    <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat History Viewer */}
        <div className="lg:col-span-8 bg-admin-900/80 border border-admin-800 rounded-xl overflow-hidden flex flex-col">
          {/* Channel Header */}
          <div className="p-3.5 border-b border-admin-800 flex items-center justify-between bg-admin-950/60">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-400" />
              <span className="text-xs font-bold text-white">
                {conversations.find((c) => c.id === selectedConvId)?.title || 'Conversation Feed'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-admin-800 text-slate-400">
              Read-Only Inspection
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="py-24 text-center text-slate-500 text-xs font-mono">
                Loading communication history...
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.senderType === 'USER';
                const isAi = m.senderType === 'AI_SYSTEM';
                const isStaff = m.senderType === 'STAFF';

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {isAi ? (
                        <Bot className="w-3.5 h-3.5 text-brand-400" />
                      ) : isStaff ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="text-[11px] font-medium text-slate-300">{m.senderName}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-xl rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-brand-600 text-white rounded-tr-sm'
                          : isAi
                          ? 'bg-admin-950 border border-brand-500/30 text-slate-200 rounded-tl-sm'
                          : 'bg-admin-850 border border-admin-750 text-slate-200 rounded-tl-sm'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Read-Only Safeguard Banner at Bottom */}
          <div className="p-3 bg-admin-950 border-t border-admin-800 text-center text-[11px] font-mono text-slate-500">
            🔒 Administrative Observability Mode Active. Customer messages cannot be altered or sent from this surface.
          </div>
        </div>
      </div>
    </div>
  );
}
