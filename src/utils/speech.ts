import { api } from '../services/api';

export interface SpeakResult {
  ok: boolean;
  reason?: 'unsupported' | 'missing_voice' | 'error';
  message?: string;
  voiceName?: string;
  source?: 'browser' | 'server_tts';
}

const LOCALE_MAP: Record<string, string[]> = {
  en: ['en-IN', 'en-GB', 'en-US', 'en'],
  bn: ['bn-IN', 'bn-BD', 'bn'],
  hi: ['hi-IN', 'hi'],
  as: ['as-IN', 'as'],
  or: ['or-IN', 'or'],
  pa: ['pa-IN', 'pa-Guru-IN', 'pa'],
  mr: ['mr-IN', 'mr'],
  ta: ['ta-IN', 'ta'],
  te: ['te-IN', 'te'],
  gu: ['gu-IN', 'gu'],
  kn: ['kn-IN', 'kn'],
  ml: ['ml-IN', 'ml'],
};

const ttsAudioCache = new Map<string, string>();
let activeAudio: HTMLAudioElement | null = null;
let sharedAudioCtx: AudioContext | null = null;

export function unlockWebAudioOnGesture(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      if (!sharedAudioCtx) sharedAudioCtx = new AudioCtx();
      if (sharedAudioCtx.state === 'suspended') {
        void sharedAudioCtx.resume().catch(() => {});
      }
    }
  } catch {
    // ignore audio unlock errors
  }
}

export function loadSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        window.speechSynthesis.removeEventListener?.('voiceschanged', finish);
        resolve(window.speechSynthesis.getVoices());
      }
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', finish);
    setTimeout(finish, 500);
  });
}

function pickBestVoice(voices: SpeechSynthesisVoice[], langCode: string): SpeechSynthesisVoice | null {
  const candidates = LOCALE_MAP[langCode] || [langCode];
  const lowerVoices = voices.map((v) => ({ v, lang: v.lang.toLowerCase().replace('_', '-') }));

  for (const target of candidates) {
    const t = target.toLowerCase();
    const match = lowerVoices.find((item) => item.lang === t);
    if (match) return match.v;
  }

  const basePrefix = langCode.toLowerCase();
  const prefixMatch = lowerVoices.find(
    (item) => item.lang === basePrefix || item.lang.startsWith(`${basePrefix}-`),
  );
  if (prefixMatch) return prefixMatch.v;

  return null;
}

export async function checkVoiceAvailability(langCode: string): Promise<boolean> {
  const voices = await loadSpeechVoices();
  if (langCode === 'en') return typeof window !== 'undefined' && 'speechSynthesis' in window;
  return pickBestVoice(voices, langCode) !== null;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
}

async function playViaServerTts(text: string, langCode: string, onEnd?: () => void): Promise<SpeakResult> {
  const cacheKey = `${langCode}:${text}`;
  let dataUri = ttsAudioCache.get(cacheKey);
  if (!dataUri) {
    const res = await api.synthesizeSpeech({ text, language: langCode });
    dataUri = `data:${res.mime_type || 'audio/mpeg'};base64,${res.audio_base64}`;
    ttsAudioCache.set(cacheKey, dataUri);
  }

  const audio = new Audio();
  audio.volume = 1;
  audio.src = dataUri;
  activeAudio = audio;
  audio.onended = () => {
    if (activeAudio === audio) activeAudio = null;
    onEnd?.();
  };
  audio.onerror = () => {
    if (activeAudio === audio) activeAudio = null;
    onEnd?.();
  };
  await audio.play();
  return { ok: true, voiceName: 'AgriNova Universal Voice', source: 'server_tts' };
}

function playViaBrowserSpeech(
  text: string,
  langCode: string,
  matched: SpeechSynthesisVoice | null,
  onEnd?: () => void,
): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let started = false;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore reset errors
    }

    const watchdog = window.setTimeout(() => {
      if (!started) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
        resolve(false);
      }
    }, 950);

    // Small 50ms gap fixes Chromium's silent-utterance bug right after speechSynthesis.cancel()
    window.setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        if (matched) {
          utterance.voice = matched;
          utterance.lang = matched.lang;
        } else {
          utterance.lang = (LOCALE_MAP[langCode] && LOCALE_MAP[langCode][0]) || 'en-IN';
        }
        utterance.volume = 1;
        utterance.rate = 0.96;
        utterance.onstart = () => {
          started = true;
          window.clearTimeout(watchdog);
          resolve(true);
        };
        utterance.onend = () => {
          window.clearTimeout(watchdog);
          onEnd?.();
        };
        utterance.onerror = () => {
          window.clearTimeout(watchdog);
          if (!started) resolve(false);
          else onEnd?.();
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        window.clearTimeout(watchdog);
        resolve(false);
      }
    }, 50);
  });
}

export async function speakInLanguage(
  text: string,
  langCode: string,
  onEnd?: () => void,
): Promise<SpeakResult> {
  unlockWebAudioOnGesture();
  stopSpeaking();

  // Always prefer server-side universal neural/cloud audio first for regional languages (bn, hi, ta, etc.)
  // so every laptop & phone hears consistent native speech regardless of missing OS voice packs.
  if (langCode !== 'en') {
    try {
      return await playViaServerTts(text, langCode, onEnd);
    } catch {
      // Fall back cleanly to browser native voices if offline
    }
  }

  // Try native browser speech (for English or offline fallback), with silent-speech watchdog
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = await loadSpeechVoices();
    const matched = pickBestVoice(voices, langCode);
    if (matched || langCode === 'en') {
      const started = await playViaBrowserSpeech(text, langCode, matched, onEnd);
      if (started) {
        return { ok: true, voiceName: matched?.name || 'Browser Voice', source: 'browser' };
      }
    }
  }

  // Universal fallback if English browser TTS also stalled or was muted on that PC
  try {
    return await playViaServerTts(text, langCode, onEnd);
  } catch (err) {
    onEnd?.();
    return {
      ok: false,
      reason: 'missing_voice',
      message:
        err instanceof Error
          ? `${err.message} (Check device speaker volume or browser sound permission.)`
          : 'Could not play voice audio. Check your browser speaker permission.',
    };
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  const hasWebSpeech = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  const mediaDevices =
    typeof navigator !== 'undefined' ? (navigator.mediaDevices as MediaDevices | undefined) : undefined;
  const hasRecorder = Boolean(
    mediaDevices && typeof mediaDevices.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined',
  );
  return hasWebSpeech || hasRecorder;
}

export function startVoiceInput(
  langCode: string,
  onTranscript: (text: string) => void,
  onError?: (msg: string) => void,
  onDone?: () => void,
): (() => void) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    webkitSpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
  };

  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (Rec) {
    const recognition = new Rec();
    recognition.lang = (LOCALE_MAP[langCode] && LOCALE_MAP[langCode][0]) || 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = () => {
      onError?.('Could not capture voice. Please type or try again.');
      onDone?.();
    };
    recognition.onend = () => {
      onDone?.();
    };

    recognition.start();
    return () => recognition.stop();
  }

  // Fallback for browsers without Web SpeechRecognition: MediaRecorder -> server /api/transcribe
  if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let stopped = false;

    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream = s;
        recorder = new MediaRecorder(s);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = async () => {
          stream?.getTracks().forEach((tr) => tr.stop());
          const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
          try {
            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const dataUrl = String(reader.result || '');
                const base64 = dataUrl.split(',')[1] || '';
                if (!base64) throw new Error('Empty recording');
                const res = await api.transcribeAudio({
                  audio_base64: base64,
                  mime_type: blob.type || 'audio/webm',
                  language: langCode,
                });
                if (res.transcript) onTranscript(res.transcript);
              } catch (err) {
                onError?.(err instanceof Error ? err.message : 'Transcription failed.');
              } finally {
                onDone?.();
              }
            };
            reader.readAsDataURL(blob);
          } catch {
            onDone?.();
          }
        };
        recorder.start();
        setTimeout(() => {
          if (recorder && recorder.state === 'recording') recorder.stop();
        }, 4500);
      })
      .catch(() => {
        onError?.('Microphone permission denied or unavailable.');
        onDone?.();
      });

    return () => {
      stopped = true;
      if (recorder && recorder.state === 'recording') recorder.stop();
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }

  onError?.('Voice typing is not supported in this browser.');
  onDone?.();
  return null;
}
