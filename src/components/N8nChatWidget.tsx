import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  X,
  RotateCcw,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react';
import type { LanguageMode } from '../data/mobilePresets';

export const N8N_WEBHOOK_URL =
  'https://santhu86.app.n8n.cloud/webhook/762952b0-0ba9-4796-9449-8a7ea09be064/chat';
const N8N_INSTANCE_ID =
  'a6b51a2b842773c5ec6045567f3dc6e3bef474ba45b130b317479c5cd8471620';

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

interface N8nChatWidgetProps {
  languageMode: LanguageMode;
  deviceContext?: string;
  isFullTab?: boolean;
  isOpenFloating?: boolean;
  onToggleFloating?: (open: boolean) => void;
  onSwitchToTab?: () => void;
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init-1',
    sender: 'bot',
    text: 'Hi there! 👋',
    timestamp: 'Just now',
  },
  {
    id: 'init-2',
    sender: 'bot',
    text: 'My name is Nathan. How can I assist you today? Ask me any mobile repair question in English, Telugu (తెలుగు), or Tanglish.',
    timestamp: 'Just now',
  },
];

const QUICK_PROMPTS = [
  'Pop-up ads keep appearing on my phone screen',
  'Battery draining fast & phone heating up',
  'Phone storage full and hanging / lagging',
  '5G / Mobile data network not working properly',
];

function extractClientN8nReply(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed || trimmed.includes('Error in workflow') || trimmed.startsWith('<!DOCTYPE')) {
      return null;
    }
    return trimmed;
  }
  if (Array.isArray(payload) && payload.length > 0) {
    return extractClientN8nReply(payload[0]);
  }
  if (typeof payload === 'object') {
    const candidate =
      payload.output ||
      payload.text ||
      payload.response ||
      payload.reply ||
      (payload.message !== 'Error in workflow' ? payload.message : null);
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export const N8nChatPanel: React.FC<N8nChatWidgetProps> = ({
  languageMode,
  deviceContext = '',
  isFullTab = false,
  isOpenFloating = false,
  onToggleFloating,
  onSwitchToTab,
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [embedMode, setEmbedMode] = useState<'integrated' | 'native-n8n'>('integrated');
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('fixbench_n8n_session_id');
      if (saved) return saved;
      const created = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('fixbench_n8n_session_id', created);
      return created;
    } catch {
      return `sess-${Date.now()}`;
    }
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const nativeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      handleSendMessage(initialPrompt.trim());
      onClearInitialPrompt?.();
    }
  }, [initialPrompt]);

  // Load official @n8n/chat bundle when user switches to 'native-n8n' mode
  useEffect(() => {
    if (embedMode !== 'native-n8n' || !nativeContainerRef.current) return;

    const styleId = 'n8n-chat-stylesheet';
    if (!document.getElementById(styleId)) {
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
      document.head.appendChild(link);
    }

    let cancelled = false;
    const mountId = isFullTab ? 'n8n-chat-full-target' : 'n8n-chat-floating-target';
    nativeContainerRef.current.id = mountId;
    nativeContainerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
      const targetEl = document.getElementById('${mountId}');
      if (targetEl) {
        createChat({
          target: '#${mountId}',
          mode: 'fullscreen',
          webhookUrl: '${N8N_WEBHOOK_URL}',
          showWelcomeScreen: false,
          loadPreviousSession: false,
          webhookConfig: {
            headers: {
              'X-Instance-Id': '${N8N_INSTANCE_ID}'
            }
          },
          initialMessages: [
            'Hi there! 👋',
            'My name is Nathan. How can I assist you today?'
          ],
          enableStreaming: false
        });
      }
    `;
    if (!cancelled) {
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [embedMode, isFullTab]);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputValue).trim();
    if (!textToSend || isSending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) {
      setInputValue('');
    }
    setIsSending(true);

    try {
      let botReply: string | null = null;

      // Step 1: Attempt direct browser POST to the n8n webhook (exact @n8n/chat format)
      try {
        const directRes = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Instance-Id': N8N_INSTANCE_ID,
          },
          body: JSON.stringify({
            action: 'sendMessage',
            sessionId,
            chatInput: textToSend,
          }),
        });

        if (directRes.ok) {
          const ct = directRes.headers.get('content-type') || '';
          const directData = ct.includes('application/json')
            ? await directRes.json()
            : await directRes.text();
          botReply = extractClientN8nReply(directData);
        }
      } catch {
        // Proceed to server-side n8n proxy & assistant route
      }

      // Step 2: If direct webhook returned 500 or CORS/network error, call server-side /api/n8n-chat
      if (!botReply) {
        const apiRes = await fetch('/api/n8n-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatInput: textToSend,
            sessionId,
            deviceContext,
            languageMode,
            history: messages.slice(-6),
          }),
        });

        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data?.output) {
            botReply = data.output;
          }
        }
      }

      // Step 3: Local fallback if offline
      if (!botReply) {
        botReply =
          `Here is how to check "${textToSend}" on your phone${
            deviceContext ? ` (${deviceContext})` : ''
          }:\n` +
          `1. Open Settings → Apps → See all apps and check recently installed or unfamiliar apps.\n` +
          `2. Clear cache for the affected app or system service under Storage & Cache.\n` +
          `3. Restart your phone and test again. You can also run a full step-by-step search in the main FixBench workbench.`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetChat = () => {
    const newSession = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSessionId(newSession);
    try {
      sessionStorage.setItem('fixbench_n8n_session_id', newSession);
    } catch {
      // ignore
    }
    setMessages(INITIAL_MESSAGES);
    setInputValue('');
  };

  return (
    <div
      className={`flex flex-col bg-white border border-slate-200 overflow-hidden ${
        isFullTab
          ? 'rounded-xl h-[680px]'
          : 'rounded-2xl shadow-xl w-[360px] sm:w-[410px] h-[540px]'
      }`}
    >
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
            <h2 className="text-sm font-semibold truncate">
              Nathan — n8n Live Chatbot
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            Connected to santhu86.app.n8n.cloud webhook
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Segmented mode switch: Smart n8n vs Raw @n8n/chat embed */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setEmbedMode('integrated')}
              className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                embedMode === 'integrated'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="n8n Webhook + Smart Recovery"
            >
              Smart Chat
            </button>
            <button
              type="button"
              onClick={() => setEmbedMode('native-n8n')}
              className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                embedMode === 'native-n8n'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Official @n8n/chat bundle"
            >
              n8n Embed
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetChat}
            title="Reset conversation"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {!isFullTab && onSwitchToTab && (
            <button
              type="button"
              onClick={onSwitchToTab}
              title="Open in full tab"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {!isFullTab && onToggleFloating && (
            <button
              type="button"
              onClick={() => onToggleFloating(false)}
              title="Minimize chat"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              {isOpenFloating ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Subbar showing active device context or direct webhook link */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-600 shrink-0">
        <span className="truncate">
          {deviceContext
            ? `Device context: ${deviceContext}`
            : 'Ask about any phone brand, model, or settings problem'}
        </span>
        <a
          href={N8N_WEBHOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium shrink-0"
        >
          <span>n8n Hosted URL</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Body: Either Integrated n8n Chat or Native @n8n/chat Container */}
      {embedMode === 'native-n8n' ? (
        <div className="flex-1 relative bg-slate-50 overflow-hidden">
          <div ref={nativeContainerRef} className="w-full h-full" />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.sender === 'user' ? 'You' : 'Nathan'} · {msg.timestamp}
                </span>
              </div>
            ))}

            {isSending && (
              <div className="flex items-start">
                <div className="bg-white border border-slate-200 text-slate-600 rounded-xl px-3.5 py-2.5 text-xs">
                  Nathan is typing...
                </div>
              </div>
            )}

            {/* Quick starter buttons when conversation just started */}
            {messages.length <= 2 && !isSending && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">
                  Quick questions you can ask:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your mobile problem or question..."
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </>
      )}
    </div>
  );
};
