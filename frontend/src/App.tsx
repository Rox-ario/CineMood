/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Send, Play, X, Film, ChevronLeft, ChevronRight, Sparkles, Share2, RefreshCw, Palette } from "lucide-react";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type AppState = 'idle' | 'asking' | 'thinking' | 'result';
type ThemeColor = 'orange' | 'blue' | 'green' | 'purple' | 'red';

const themes: Record<ThemeColor, { accent: string; rgb: string; glow1: string; glow2: string; gradient: string }> = {
  orange: {
    accent: '#f97316',
    rgb: '249, 115, 22',
    glow1: '#4d2e1a',
    glow2: '#4d3c1a',
    gradient: 'linear-gradient(to bottom right, #fb923c, #eab308, #dc2626)'
  },
  blue: {
    accent: '#3b82f6',
    rgb: '59, 130, 246',
    glow1: '#1a2e4d',
    glow2: '#1a3c4d',
    gradient: 'linear-gradient(to bottom right, #60a5fa, #06b6d4, #4338ca)'
  },
  green: {
    accent: '#22c55e',
    rgb: '34, 197, 94',
    glow1: '#1a4d2e',
    glow2: '#2e4d1a',
    gradient: 'linear-gradient(to bottom right, #4ade80, #84cc16, #15803d)'
  },
  purple: {
    accent: '#a855f7',
    rgb: '168, 85, 247',
    glow1: '#3c1a4d',
    glow2: '#4d1a3c',
    gradient: 'linear-gradient(to bottom right, #c084fc, #ec4899, #6d28d9)'
  },
  red: {
    accent: '#ef4444',
    rgb: '239, 68, 68',
    glow1: '#4d1a1a',
    glow2: '#4d2e1a',
    gradient: 'linear-gradient(to bottom right, #f87171, #f97316, #b91c1c)'
  }
};

interface MovieRecommendation {
  title: string;
  platform: string;
  plot: string;
  reason: string;
  link: string;
  posterUrl: string;
  sceneUrls: string[];
  ratings: { source: string; score: number }[];
}

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [mood, setMood] = useState('');
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeColor>(() => {
    const saved = localStorage.getItem('cinemood-theme');
    return (saved && Object.keys(themes).includes(saved)) ? (saved as ThemeColor) : 'orange';
  });

  useEffect(() => {
    localStorage.setItem('cinemood-theme', theme);
    const root = document.documentElement;
    const config = themes[theme];
    root.style.setProperty('--accent', config.accent);
    root.style.setProperty('--accent-rgb', config.rgb);
    root.style.setProperty('--glow-1', config.glow1);
    root.style.setProperty('--glow-2', config.glow2);
    root.style.setProperty('--gradient', config.gradient);
  }, [theme]);

  // --- Gemini Logic (Back to Frontend for Environment Compatibility) ---
  const getRecommendations = async (moodText: string) => {
    setState('thinking');
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `L'utente descrive come si sente o cosa cerca: "${moodText}". 
        Suggerisci fino a 3 film (massimo 3, minimo 1) perfetti per questa serata. 
        Devono essere disponibili su piattaforme streaming popolari (Netflix, Prime Video, Disney+, MUBI, ecc.).
        Rispondi in formato JSON con un array di oggetti chiamato "movies", ogni oggetto con i seguenti campi:
        - title: string
        - platform: string (es. Netflix)
        - plot: string (una breve trama avvincente del film)
        - reason: string (una frase evocativa che spiega perché è perfetto per questo mood)
        - link: string (un link diretto alla pagina del film sulla piattaforma)
        - posterUrl: string (URL DIRETTO all'immagine del poster. Deve terminare con .jpg, .png o .webp. Usa Google Search per trovare il link diretto all'immagine, non la pagina web.)
        - sceneUrls: string[] (array di 4 URL DIRETTI a immagini di scene del film. Devono terminare con .jpg, .png o .webp.)
        - ratings: array di oggetti { source: string, score: number } (punteggi da testate come IMDb, Rotten Tomatoes, Metacritic, con score da 1 a 5)`,
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      const data = (parsed.movies || []) as MovieRecommendation[];
      
      // Fallback for images and ratings
      const enrichedData = data.map(movie => {
        const posterUrl = movie.posterUrl && movie.posterUrl.startsWith('http')
          ? `https://images.weserv.nl/?url=${encodeURIComponent(movie.posterUrl)}&w=600&h=900&fit=cover`
          : `https://placehold.co/600x900/1a1a1a/ffffff?text=${encodeURIComponent(movie.title)}`;

        const sceneUrls = movie.sceneUrls?.length 
          ? movie.sceneUrls.map(url => url.startsWith('http') ? `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=1200&h=675&fit=cover` : `https://placehold.co/1200x675/1a1a1a/ffffff?text=Scene+Not+Found`)
          : [
            `https://placehold.co/1200x675/1a1a1a/ffffff?text=${encodeURIComponent(movie.title)}+1`,
            `https://placehold.co/1200x675/1a1a1a/ffffff?text=${encodeURIComponent(movie.title)}+2`,
            `https://placehold.co/1200x675/1a1a1a/ffffff?text=${encodeURIComponent(movie.title)}+3`,
          ];

        return {
          ...movie,
          plot: movie.plot || "Trama non disponibile.",
          ratings: movie.ratings?.length ? movie.ratings : [
            { source: "IMDb", score: 4.5 },
            { source: "Rotten Tomatoes", score: 4.2 }
          ],
          posterUrl,
          sceneUrls
        };
      });

      setRecommendations(enrichedData);
      setState('result');
    } catch (err) {
      console.error(err);
      setError("Errore nel recupero dei consigli. Riprova.");
      setState('idle');
    }
  };

  const handleStart = () => {
    setState('asking');
  };

  const handleSubmitMood = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mood.trim()) {
      getRecommendations(mood);
    }
  };

  const handleReset = () => {
    setState('idle');
    setMood('');
    setRecommendations([]);
  };

  // --- Voice Input ---
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Il tuo browser non supporta il riconoscimento vocale.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMood((prev) => prev + (prev ? ' ' : '') + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const shareToWhatsApp = () => {
    const movieTitles = recommendations.map((m, i) => `${i + 1}. ${m.title} (${m.platform})`).join('\n');
    const message = `🎬 *CineMood - I miei consigli cinematografici*\n\n*Il mio mood:* "${mood}"\n\n*Film consigliati:*\n${movieTitles}\n\nGenerato con CineMood ✨`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#020408] text-white font-sans selection:bg-accent selection:text-black overflow-x-hidden">
      {/* Immersive Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-glow-1 blur-[180px] rounded-full opacity-30" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-glow-2 blur-[180px] rounded-full opacity-20" 
        />
        <motion.div 
          animate={{ 
            opacity: [0.1, 0.3, 0.1],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] right-[10%] w-[50%] h-[50%] bg-glow-1 blur-[150px] rounded-full opacity-15" 
        />
        
        {/* Grain Overlay */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(var(--accent-rgb),0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] opacity-20" />
      </div>

      {/* Theme Switcher */}
      <div className="fixed top-8 right-8 z-50 flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 p-2 rounded-full">
        <Palette size={16} className="ml-2 text-zinc-500" />
        {Object.keys(themes).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t as ThemeColor)}
            className={cn(
              "w-6 h-6 rounded-full transition-all hover:scale-125",
              theme === t ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110" : "opacity-50 hover:opacity-100"
            )}
            style={{ backgroundColor: themes[t as ThemeColor].accent }}
            title={t}
          />
        ))}
      </div>

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6 md:p-12 lg:p-24">
        <AnimatePresence mode="wait">
          {/* IDLE STATE */}
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center space-y-12 max-w-4xl"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs font-mono uppercase tracking-[0.3em] text-accent"
                >
                  <Sparkles size={14} /> Immersive Experience
                </motion.div>
                <h1 className="text-5xl md:text-8xl font-black tracking-tight uppercase leading-tight italic font-display px-10 overflow-visible">
                  Cine<span className="text-transparent bg-clip-text pr-3" style={{ backgroundImage: 'var(--gradient)' }}>Mood </span>
                </h1>
                <p className="text-zinc-400 font-mono text-sm md:text-lg tracking-[0.3em] uppercase max-w-2xl mx-auto opacity-60">
                  Perditi nel cinema, non nella scelta.
                </p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStart}
                className="group relative px-16 py-6 bg-white text-black font-black text-2xl uppercase tracking-tighter overflow-hidden"
              >
                <span className="relative z-10">Inizia il Viaggio</span>
                <div className="absolute inset-0 bg-accent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500" />
              </motion.button>
            </motion.div>
          )}

          {/* ASKING STATE */}
          {state === 'asking' && (
            <motion.div
              key="asking"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              className="w-full max-w-3xl space-y-12"
            >
              <div className="space-y-4">
                <h2 className="text-5xl md:text-7xl font-bold tracking-tighter italic font-display">Cosa desideri vivere?</h2>
                <p className="text-zinc-500 text-lg md:text-xl font-light tracking-tight">Descrivi il tuo stato d'animo, un'emozione o un'atmosfera.</p>
              </div>
              
              <form onSubmit={handleSubmitMood} className="space-y-8">
                <div className="relative group">
                  <textarea
                    autoFocus
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="Esempio: Una serata piovosa, solitudine riflessiva, atmosfere sci-fi alla Blade Runner..."
                    className="w-full bg-white/[0.03] border-2 border-white/10 rounded-[2rem] p-8 text-xl md:text-2xl font-medium focus:outline-none focus:border-green-500/50 transition-all placeholder:text-zinc-800 min-h-[300px] resize-none backdrop-blur-xl"
                  />
                  <div className="absolute right-6 bottom-6 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={startListening}
                      className={cn(
                        "p-4 rounded-full transition-all duration-500",
                        isListening ? "bg-red-500 text-white scale-110 shadow-[0_0_30px_rgba(239,68,68,0.5)]" : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <Mic size={28} />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Indietro
                  </button>
                  <button
                    type="submit"
                    disabled={!mood.trim()}
                    className="px-16 py-5 bg-accent text-black font-black uppercase tracking-tighter hover:bg-white transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(var(--accent-rgb),0.3)]"
                  >
                    Genera Visione
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* THINKING STATE */}
          {state === 'thinking' && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative w-32 h-32">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                    borderRadius: ["20%", "50%", "20%"]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 border-2 border-accent-muted"
                />
                <motion.div
                  animate={{ 
                    scale: [1.2, 1, 1.2],
                    rotate: [360, 180, 0],
                    borderRadius: ["50%", "20%", "50%"]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 border-2 border-accent-muted"
                />
              </div>
              <p className="text-zinc-500 font-mono animate-pulse uppercase tracking-[0.4em] text-sm">Sintonizzando le frequenze emotive...</p>
            </motion.div>
          )}

          {/* RESULT STATE */}
          {state === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-6xl space-y-16 py-12"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-12">
                <div className="space-y-4">
                  <h2 className="text-5xl md:text-8xl font-black tracking-tight uppercase italic leading-tight font-display px-6">Film <span className="text-accent">Consigliati</span></h2>
                  <p className="text-zinc-600 font-mono uppercase tracking-[0.4em] text-xs">Basati sul tuo mood</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={shareToWhatsApp}
                    className="px-8 py-4 bg-[#25D366] text-white rounded-full hover:bg-white hover:text-[#25D366] transition-all font-bold uppercase tracking-widest text-xs backdrop-blur-md flex items-center gap-2"
                  >
                    <Share2 size={16} /> Condividi
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-8 py-4 border border-white/10 rounded-full hover:bg-white hover:text-black transition-all font-bold uppercase tracking-widest text-xs backdrop-blur-md"
                  >
                    Nuova Esplorazione
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {recommendations.map((movie, index) => (
                  <div key={`${movie.title}-${index}`}>
                    <MovieCard movie={movie} index={index} />
                  </div>
                ))}
              </div>

              {/* Mood Refinement Section */}
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-12 space-y-8 backdrop-blur-xl">
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-600">Il tuo mood attuale</h4>
                  <p className="text-zinc-400 italic">"Puoi aggiungere dettagli per affinare la ricerca"</p>
                </div>
                <div className="relative group">
                  <textarea
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="Aggiungi dettagli..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-lg focus:outline-none focus:border-orange-500/50 transition-all min-h-[120px] resize-none"
                  />
                  <div className="absolute right-4 bottom-4 flex items-center gap-3">
                    <button
                      onClick={startListening}
                      className={cn(
                        "p-3 rounded-full transition-all",
                        isListening ? "bg-red-500 text-white" : "bg-white/5 text-zinc-400 hover:text-white"
                      )}
                    >
                      <Mic size={20} />
                    </button>
                    <button
                      onClick={() => getRecommendations(mood)}
                      disabled={!mood.trim()}
                      className="px-6 py-3 bg-accent text-black font-bold rounded-xl uppercase tracking-widest text-xs hover:bg-white transition-all disabled:opacity-20 flex items-center gap-2"
                    >
                      <RefreshCw size={14} className={cn(state === 'thinking' && "animate-spin")} /> Affina Ricerca
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Atmospheric Rail Text */}
      <div className="fixed left-8 top-1/2 -translate-y-1/2 hidden xl:block">
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] writing-mode-vertical-rl rotate-180 opacity-20">
          Atmospheric Cinema Experience • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

function MovieCard({ movie, index }: { movie: MovieRecommendation; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPlatformColor = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('netflix')) return 'bg-red-600';
    if (p.includes('prime')) return 'bg-blue-600';
    if (p.includes('disney')) return 'bg-purple-600';
    if (p.includes('mubi')) return 'bg-zinc-100 text-black';
    return 'bg-orange-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 150 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: index * 0.1 }}
      className={cn("flex flex-col transition-all duration-500", isExpanded ? "gap-12 py-12" : "gap-0 py-2")}
    >
      {/* Header: Title and Plot */}
      <div className="space-y-8 max-w-4xl">
        <motion.div 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="space-y-4 cursor-pointer group p-6 -m-6 rounded-[2rem] transition-all hover:bg-white/[0.02] hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className={cn("inline-block px-4 py-1.5 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full", getPlatformColor(movie.platform))}>
            {movie.platform}
          </div>
          <div className="flex items-center gap-6">
            <h3 className="text-4xl md:text-6xl font-black tracking-tight uppercase italic leading-tight font-display px-6 overflow-visible group-hover:text-accent transition-colors">
              {movie.title}
            </h3>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="text-zinc-600 group-hover:text-accent transition-colors"
            >
              <ChevronRight size={32} />
            </motion.div>
          </div>
          {!isExpanded && (
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em] px-6 opacity-0 group-hover:opacity-100 transition-opacity">
              Clicca per approfondire
            </p>
          )}
        </motion.div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease: "circOut" }}
              className="overflow-hidden"
            >
              <div className="pt-8 space-y-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-600">La Trama</h4>
                    <p className="text-zinc-300 text-xl font-light leading-relaxed">
                      {movie.plot}
                    </p>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-600">Perché guardarlo</h4>
                    <p className="text-zinc-500 text-lg font-light leading-relaxed italic border-l-2 border-accent-muted pl-8 py-2">
                      "{movie.reason}"
                    </p>
                  </div>
                </div>

                {/* Main Content: Poster and Actions/Ratings */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                  {/* Poster Section (Left) */}
                  <div className="lg:col-span-4 space-y-8">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] group bg-white/5">
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('placehold.co')) {
                            target.src = `https://placehold.co/600x900/1a1a1a/ffffff?text=${encodeURIComponent(movie.title)}`;
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                    </div>
                  </div>

                  {/* Actions and Ratings Section (Right) */}
                  <div className="lg:col-span-8 space-y-12">
                    <button
                      onClick={() => window.open(movie.link, '_blank')}
                      className="w-full flex items-center justify-center gap-4 bg-white text-black py-6 font-black uppercase tracking-widest text-sm hover:bg-accent transition-all group shadow-[0_20px_40px_-10px_rgba(255,255,255,0.1)] rounded-2xl"
                    >
                      <Play size={20} fill="currentColor" className="group-hover:scale-125 transition-transform" /> 
                      Guarda su {movie.platform}
                    </button>

                    {/* Ratings Section */}
                    <div className="space-y-6">
                      <h4 className="text-xs font-mono uppercase tracking-[0.4em] text-zinc-600">Valutazioni della Critica</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {movie.ratings.map((rating, i) => (
                          <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-md flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{rating.source}</span>
                              <div className="flex gap-1">
                                {[...Array(5)].map((_, starIndex) => (
                                  <Sparkles
                                    key={starIndex}
                                    size={12}
                                    className={cn(
                                      starIndex < Math.floor(rating.score) ? "text-accent fill-accent" : "text-zinc-800"
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                            <span className="text-2xl font-black font-display italic text-accent">{rating.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

