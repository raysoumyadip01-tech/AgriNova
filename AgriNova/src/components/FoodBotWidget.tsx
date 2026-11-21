import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Bot, Mic, RotateCcw, Search, Send, Sparkles, Volume2 } from 'lucide-react';
import type { FarmerLanguage, UserRole } from '../types/auth';
import type { SupportTicket } from '../types/supplyChain';
import { FARMER_TRANSLATIONS } from '../i18n/farmerTranslations';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  isSpeechRecognitionSupported,
  speakInLanguage,
  startVoiceInput,
  unlockWebAudioOnGesture,
} from '../utils/speech';

interface FoodBotWidgetProps {
  role: UserRole;
  farmerLang?: FarmerLanguage;
}

interface ChatMsg {
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
}

const HELP_GUIDES = [
  {
    id: 'g1',
    title: 'How to register crops & photos (Farmers)',
    tags: 'farmer crop add photo weight voice',
    answer:
      'Open Farmer Home -> Add Crops. Pick a preset crop (Tomato, Mango, Rice, Potato, Onion, Banana, Wheat), enter weight in kg, optionally upload a photo or use Voice Typing, then tap Save Crop.',
  },
  {
    id: 'g2',
    title: 'How AI Spoilage Prediction scores batch risk',
    tags: 'ai spoilage prediction risk temperature humidity delay',
    answer:
      'Our transparent rule-based baseline compares live temperature, humidity, storage duration, and transit delay against per-crop safe windows (e.g., Tomato 10-15°C) to produce a 0-100 risk score and preventive actions.',
  },
  {
    id: 'g3',
    title: 'How Bengali & regional Voice Help works on any computer',
    tags: 'voice bengali tts audio help language transporter farmer',
    answer:
      'AgriNova automatically synthesizes clear Bengali and regional Indian voice audio on the server whenever local OS voices are missing, so every device can hear spoken guidance.',
  },
  {
    id: 'g4',
    title: 'How to track shipments, GPS & QR traceability',
    tags: 'shipment gps map qr scanner report pdf png jpg',
    answer:
      'Open Shipments & Live Map to update statuses and advance simulated GPS. Open QR & Reports to scan with a camera or enter a shipment code (like SFC-2026-101) to download PNG, JPG, or PDF reports.',
  },
  {
    id: 'g5',
    title: 'How Food Redistribution & NGO rescue works',
    tags: 'ngo redistribution surplus waste expired discount',
    answer:
      'Any High or Critical risk batch can be routed from Products or Food Redistribution to a demo NGO pickup or a 40% discounted local surplus listing before spoilage occurs.',
  },
];

export function FoodBotWidget({ role, farmerLang = 'en' }: FoodBotWidgetProps) {
  const { showToast } = useToast();
  const isMultilingualRole = role === 'farmer' || role === 'transporter';
  const effectiveLang: FarmerLanguage = isMultilingualRole ? farmerLang : 'en';
  const langStrings = FARMER_TRANSLATIONS[effectiveLang] || FARMER_TRANSLATIONS.en;

  const greeting =
    isMultilingualRole && effectiveLang !== 'en'
      ? `${langStrings.greetingPrefix}! ${langStrings.voiceSampleText}`
      : `Hello! I am AgriNova Assistant (${role} mode). Ask follow-up questions about spoilage risk, dispatch hubs, live truck tracking, or QR traceability.`;

  const [messages, setMessages] = useState<ChatMsg[]>([{ role: 'model', text: greeting }]);
  const [selectedModel, setSelectedModel] = useState<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'>(
    'gemini-4-hydrogen',
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [faqQuery, setFaqQuery] = useState('');

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');
  const [sendingTicket, setSendingTicket] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loadTickets = async () => {
    try {
      setTickets(await api.listTickets());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  useEffect(() => {
    setMessages([{ role: 'model', text: greeting }]);
    setChatError(null);
  }, [greeting]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  const sendQuery = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;

    setChatError(null);
    const historyToSend = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: 'user', text: clean }]);
    setInput('');
    setSending(true);

    try {
      const res = await api.geminiChat({
        message: clean,
        history: historyToSend,
        model: selectedModel,
        language: effectiveLang,
      });
      setMessages((prev) => [...prev, { role: 'model', text: res.reply, modelUsed: res.model }]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unable to reach Gemini assistant.';
      setChatError(detail);
      showToast(detail, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleResetChat = () => {
    setMessages([{ role: 'model', text: greeting }]);
    setChatError(null);
  };

  const speakMessage = async (text: string) => {
    unlockWebAudioOnGesture();
    const res = await speakInLanguage(text, effectiveLang);
    if (!res.ok) {
      showToast(
        res.message || (res.reason === 'missing_voice' ? langStrings.voiceMissing : langStrings.voiceUnsupported),
        'warning',
      );
    }
  };

  const handleVoiceAsk = () => {
    setListening(true);
    startVoiceInput(
      effectiveLang,
      (transcript) => void sendQuery(transcript),
      (err) => showToast(err, 'warning'),
      () => setListening(false),
    );
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTicket(true);
    try {
      const tkt = await api.createTicket({ subject: ticketSubject, message: ticketBody });
      showToast(`Support ticket ${tkt.id} submitted.`, 'success');
      setTicketSubject('');
      setTicketBody('');
      await loadTickets();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not submit ticket.', 'error');
    } finally {
      setSendingTicket(false);
    }
  };

  const quickPrompts =
    effectiveLang === 'bn'
      ? ['কীভাবে ফসল যোগ করব?', 'ফসল বিক্রি কীভাবে করব?', 'আমার টাকা কোথায় দেখব?']
      : effectiveLang === 'hi'
        ? ['फसल कैसे जोड़ें?', 'फसल कैसे बेचें?', 'मेरे पैसे कैसे देखें?']
        : [
            'How does spoilage risk scoring work?',
            'Which cold hub should I pick for tomatoes?',
            'How do I route urgent harvest to an NGO?',
          ];

  const filteredGuides = HELP_GUIDES.filter((g) => {
    const q = faqQuery.trim().toLowerCase();
    if (!q) return true;
    return g.title.toLowerCase().includes(q) || g.answer.toLowerCase().includes(q) || g.tags.includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-[#1E293B]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#16A34A]" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                AgriNova Multi-Turn Assistant
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="gemini-model-select">
                Assistant speed mode
              </label>
              <select
                id="gemini-model-select"
                value={selectedModel}
                onChange={(e) =>
                  setSelectedModel(e.target.value as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite')
                }
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-200"
              >
                <option value="gemini-4-hydrogen">Standard · General Advice</option>
                <option value="gemini-3.1-flash-lite">Fast · Quick Answers</option>
              </select>
              <button
                type="button"
                onClick={handleResetChat}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-[#16A34A] dark:border-slate-700 dark:text-slate-200"
              >
                <RotateCcw className="h-3 w-3" />
                <span>New Chat</span>
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#14532D] text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-100'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'model' && (
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void speakMessage(m.text)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#16A34A] hover:underline"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>Listen</span>
                    </button>
                    {m.modelUsed && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        {m.modelUsed}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-start">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-400">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          {chatError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {chatError}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {quickPrompts.map((p) => (
              <button
                key={p}
                type="button"
                disabled={sending}
                onClick={() => void sendQuery(p)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-[#16A34A] disabled:opacity-50 dark:border-slate-700 dark:bg-[#0F172A] dark:text-slate-300"
              >
                {p}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuery(input);
            }}
            className="mt-4 flex gap-2"
          >
            <input
              type="text"
              value={input}
              disabled={sending}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a follow-up question..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#16A34A] focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-[#0F172A] dark:text-white"
            />
            {isSpeechRecognitionSupported() && (
              <button
                type="button"
                disabled={sending}
                onClick={handleVoiceAsk}
                aria-label="Speak question"
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  listening
                    ? 'border-[#16A34A] bg-[#16A34A]/15 text-[#16A34A]'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16A34A] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{sending ? 'Sending...' : 'Send'}</span>
            </button>
          </form>
        </div>

        <div className="space-y-4 lg:col-span-5">
          <form
            onSubmit={handleSubmitTicket}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]"
          >
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Raise Support Ticket
            </h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Subject (e.g., Cold van delay)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
              <textarea
                required
                rows={3}
                value={ticketBody}
                onChange={(e) => setTicketBody(e.target.value)}
                placeholder="Describe your issue..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0F172A]"
              />
              <button
                type="submit"
                disabled={sendingTicket}
                className="w-full rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D]"
              >
                {sendingTicket ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>

          {tickets.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
              <h4 className="font-display text-sm font-bold">Recent Support Tickets</h4>
              <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-700">
                {tickets.slice(0, 4).map((tkt) => (
                  <div key={tkt.id} className="py-2 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span>{tkt.subject}</span>
                      <span className="font-mono text-[#16A34A]">{tkt.status}</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">{tkt.id}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Searchable Help Guides & FAQ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#1E293B]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#16A34A]" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Searchable Help Guides &amp; FAQ
            </h3>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={faqQuery}
              onChange={(e) => setFaqQuery(e.target.value)}
              placeholder="Search help guides..."
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-9 text-xs dark:border-slate-700 dark:bg-[#0F172A]"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredGuides.map((g) => (
            <div key={g.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">{g.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{g.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
