'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Wand2, 
  Image as ImageIcon, 
  Download, 
  Copy, 
  Trash2, 
  Loader2, 
  Sparkles, 
  Clock, 
  ExternalLink, 
  Check, 
  AlertCircle, 
  Info,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface GenerationItem {
  id: string;
  prompt: string;
  imageUrl: string;
  revisedPrompt?: string;
  size: string;
  quality: string;
  style: string;
  timestamp: number;
}

const PRESETS = [
  {
    name: '🦄 Fantasy',
    prompt: 'a magical fantasy forest, path winding through glowing blue trees, whimsical, cinematic light, 8k resolution'
  },
  {
    name: '📸 Photorealistic',
    prompt: 'a close up portrait of an elderly explorer with deep wrinkles, soft natural side lighting, detailed skin texture, award winning photography'
  },
  {
    name: '🤖 Cyberpunk',
    prompt: 'cyberpunk street scene, rainy night, neon signs reflecting in puddles, a mysterious figure in a trench coat, high contrast'
  },
  {
    name: '🎨 Anime',
    prompt: 'vibrant anime style illustration of a futuristic city with flying cars, neon signs, cherry blossom trees, detailed sky, masterpiece'
  },
  {
    name: '📐 3D Render',
    prompt: '3D render of a cute round robot character, smooth matte plastic, pastel colors, soft studio lighting, cute expression'
  },
  {
    name: '🌌 Surrealism',
    prompt: 'a clock melting over a tree branch in a desert under a purple cosmic sky, surrealism painting style, dreamlike'
  }
];

const LOADING_STEPS = [
  'Whispering to the AI...',
  'Visualizing your concept...',
  'Sketching outlines...',
  'Painting vibrant colors...',
  'Adding highlights & shadows...',
  'Upscaling details to high definition...',
  'Applying final artistic polish...'
];

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('standard');
  const [style, setStyle] = useState('vivid');
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentRevisedPrompt, setCurrentRevisedPrompt] = useState<string | null>(null);
  
  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('image_gen_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history to localStorage
  const saveHistory = (newHistory: GenerationItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('image_gen_history', JSON.stringify(newHistory));
  };

  // Cycle loading steps
  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      loadingIntervalRef.current = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 3000);
    } else {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    }
    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
    };
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setCurrentImage(null);
    setCurrentRevisedPrompt(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size,
          quality,
          style,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image.');
      }

      setCurrentImage(data.imageUrl);
      setCurrentRevisedPrompt(data.revisedPrompt || null);

      // Add to history
      const newItem: GenerationItem = {
        id: Date.now().toString(),
        prompt: prompt.trim(),
        imageUrl: data.imageUrl,
        revisedPrompt: data.revisedPrompt || undefined,
        size,
        quality,
        style,
        timestamp: Date.now(),
      };

      saveHistory([newItem, ...history]);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!currentImage) return;
    try {
      await navigator.clipboard.writeText(currentImage);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyPrompt = async () => {
    if (!currentRevisedPrompt) return;
    try {
      await navigator.clipboard.writeText(currentRevisedPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const selectHistoryItem = (item: GenerationItem) => {
    setPrompt(item.prompt);
    setSize(item.size);
    setQuality(item.quality);
    setStyle(item.style);
    setCurrentImage(item.imageUrl);
    setCurrentRevisedPrompt(item.revisedPrompt || null);
    setError(null);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((item) => item.id !== id);
    saveHistory(updated);
    
    // Clear display if we deleted the current active image
    const deletedItem = history.find((item) => item.id === id);
    if (deletedItem && currentImage === deletedItem.imageUrl) {
      setCurrentImage(null);
      setCurrentRevisedPrompt(null);
    }
  };

  const clearAllHistory = () => {
    if (confirm('Are you sure you want to clear all history?')) {
      saveHistory([]);
      setCurrentImage(null);
      setCurrentRevisedPrompt(null);
    }
  };

  // Helper to generate proxy download url
  const getDownloadUrl = (url: string) => {
    if (url.startsWith('data:')) {
      return url;
    }
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              ImagiCraft AI
            </h1>
            <p className="text-xs text-zinc-500 font-medium">Text-to-Image Generator with DALL-E 3</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            DALL-E 3 Engine Connected
          </span>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-w-[1800px] w-full mx-auto">
        
        {/* Left Side: Settings Panel */}
        <aside className="w-full lg:w-[380px] lg:border-r border-zinc-900 bg-zinc-950 p-6 flex flex-col gap-6 overflow-y-auto lg:max-h-[calc(100vh-73px)] shrink-0">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <span>Quick Presets</span>
              <span className="text-[10px] lowercase text-zinc-600 normal-case">(click to load)</span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setPrompt(preset.prompt)}
                  className="p-2.5 text-left text-xs bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-all text-zinc-300 hover:text-zinc-100 line-clamp-1 truncate"
                  title={preset.prompt}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-900 my-1"></div>

          {/* Configuration Form */}
          <div className="flex flex-col gap-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <span>Image Settings</span>
            </h2>

            {/* Size / Aspect Ratio */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-300 flex justify-between">
                <span>Aspect Ratio</span>
                <span className="text-zinc-500 font-normal">{size}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '1024x1024', label: '1:1 Square', desc: 'Social posts' },
                  { value: '1024x1792', label: '9:16 Portrait', desc: 'Mobile/Story' },
                  { value: '1792x1024', label: '16:9 Landscape', desc: 'Desktop/Web' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSize(opt.value)}
                    className={`p-2 flex flex-col items-center justify-center border rounded-lg transition-all text-center gap-1 ${
                      size === opt.value
                        ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-medium">{opt.label.split(' ')[0]}</span>
                    <span className="text-[9px] text-zinc-500">{opt.label.split(' ')[1]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-300 flex justify-between">
                <span>Rendering Style</span>
                <span className="text-zinc-500 font-normal">{style}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'vivid', label: 'Vivid', desc: 'Dramatic & artistic' },
                  { value: 'natural', label: 'Natural', desc: 'Realistic & organic' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStyle(opt.value)}
                    className={`p-2.5 flex flex-col text-left border rounded-lg transition-all ${
                      style === opt.value
                        ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-300 flex justify-between">
                <span>Quality Profile</span>
                <span className="text-zinc-500 font-normal">{quality}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'standard', label: 'Standard', desc: 'Fast generation' },
                  { value: 'hd', label: 'HD Detail', desc: 'Enhanced clarity' }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuality(opt.value)}
                    className={`p-2.5 flex flex-col text-left border rounded-lg transition-all ${
                      quality === opt.value
                        ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 mt-auto pt-4">
            <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800/80 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                DALL-E 3 automatically enhances your prompt before rendering to improve visual quality. The modified version is shown as the <strong className="text-indigo-400 font-semibold">Revised Prompt</strong> next to the output.
              </div>
            </div>
          </div>
        </aside>

        {/* Right Side: Main Workspace Area */}
        <main className="flex-1 p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto lg:max-h-[calc(100vh-73px)]">
          {/* Prompt Entry Form */}
          <form onSubmit={handleSubmit} className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to create in vivid detail..."
                className="w-full bg-zinc-950 text-zinc-100 placeholder-zinc-600 rounded-xl border border-zinc-850 hover:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all p-4 pr-10 resize-none h-24 text-sm outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e);
                  }
                }}
              />
              {prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt('')}
                  className="absolute right-3 top-3 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Clear
                </button>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <span className="text-xs text-zinc-500 font-medium px-1">
                Tip: Press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-400">Ctrl + Enter</kbd> to generate
              </span>
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-850 disabled:text-zinc-600 text-white font-semibold rounded-xl text-sm py-3 px-6 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-indigo-650/20 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-100" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 text-zinc-100" />
                    <span>Craft Image</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Interactive Output Section */}
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            
            {/* Image Preview & Output Container */}
            <div className="xl:col-span-2 flex flex-col gap-4">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider px-1">Artboard</h2>
              
              <div className="aspect-square w-full bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center relative min-h-[350px] shadow-2xl group">
                
                {/* Empty State */}
                {!loading && !currentImage && !error && (
                  <div className="text-center p-8 max-w-sm flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-500">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-300">Your masterpiece awaits</p>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Select a preset or type a detailed description to bring your imagination to life.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {loading && (
                  <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4 p-8 text-center animate-pulse">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                    <div className="flex flex-col gap-1 max-w-xs">
                      <p className="text-sm font-semibold text-zinc-200">
                        {LOADING_STEPS[loadingStep]}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        DALL-E 3 takes around 8-15 seconds to build high-quality imagery.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="p-8 max-w-md text-center flex flex-col items-center gap-3">
                    <AlertCircle className="h-10 w-10 text-rose-500" />
                    <p className="font-semibold text-rose-500 text-sm">Failed to generate image</p>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-rose-950/20 border border-rose-900/40 p-3.5 rounded-xl max-h-40 overflow-y-auto">
                      {error}
                    </p>
                    <button
                      onClick={handleSubmit}
                      className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3 w-3" /> Retry Generation
                    </button>
                  </div>
                )}

                {/* Generated Image Display */}
                {!loading && currentImage && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentImage}
                      alt={prompt}
                      className="w-full h-full object-contain"
                    />

                    {/* Desktop Hover Overlay Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-6">
                      <div className="text-xs text-zinc-300 font-medium truncate max-w-[60%] bg-zinc-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-zinc-800">
                        Size: {size} | Style: {style}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyUrl}
                          className="p-2.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 rounded-lg border border-zinc-800 transition-all cursor-pointer"
                          title="Copy Image URL"
                        >
                          {copiedUrl ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <a
                          href={getDownloadUrl(currentImage)}
                          download="generated-image.png"
                          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center justify-center"
                          title="Download Image"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile and visible Actions (shown always when image exists) */}
              {!loading && currentImage && (
                <div className="flex flex-wrap gap-3 items-center justify-between sm:hidden bg-zinc-900/40 border border-zinc-900 p-3.5 rounded-xl">
                  <span className="text-xs text-zinc-400">Options: {size} • {style}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyUrl}
                      className="px-3 py-1.5 bg-zinc-800 text-zinc-200 text-xs rounded-lg flex items-center gap-1.5"
                    >
                      {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>Copy link</span>
                    </button>
                    <a
                      href={getDownloadUrl(currentImage)}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg flex items-center gap-1.5"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Revised Prompt Panel & Generation details */}
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider px-1">Details & Enhancements</h2>
              
              <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 flex flex-col gap-4 min-h-[350px]">
                
                {/* Revised prompt section */}
                {currentRevisedPrompt ? (
                  <div className="flex flex-col gap-2.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> DALL-E Revised Prompt
                      </span>
                      <button
                        onClick={handleCopyPrompt}
                        className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-900 transition-colors"
                        title="Copy Revised Prompt"
                      >
                        {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="flex-1 bg-zinc-950 border border-zinc-850 p-4 rounded-xl text-xs text-zinc-300 leading-relaxed font-mono max-h-[220px] overflow-y-auto">
                      {currentRevisedPrompt}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-xl">
                    <Sparkles className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-xs font-semibold">No enhancements yet</p>
                    <p className="text-[10px] mt-1 leading-normal max-w-[150px]">
                      Generate an image to view how DALL-E upgraded your prompt.
                    </p>
                  </div>
                )}

                {/* Prompt used */}
                {currentImage && (
                  <div className="border-t border-zinc-900 pt-4 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Your Prompt</span>
                    <p className="text-xs text-zinc-400 line-clamp-3 bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                      {prompt}
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* History Panel */}
          <div className="border-t border-zinc-900 pt-6 mt-2 flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-500" />
                <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Recent Generations</h2>
                <span className="bg-zinc-900 px-2 py-0.5 rounded-full text-[10px] text-zinc-500 font-bold border border-zinc-850">
                  {history.length}
                </span>
              </div>
              {history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="text-xs text-zinc-500 hover:text-rose-400 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="bg-zinc-900/10 border border-zinc-900/60 rounded-xl p-8 text-center text-zinc-600">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold">History is clean</p>
                <p className="text-[10px] mt-0.5">Images you craft will be saved here in local storage.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => selectHistoryItem(item)}
                    className={`group bg-zinc-900 border rounded-xl overflow-hidden cursor-pointer transition-all aspect-square relative flex flex-col ${
                      currentImage === item.imageUrl
                        ? 'border-indigo-500 ring-1 ring-indigo-500'
                        : 'border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.prompt}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Thumbnail Action Overlay */}
                    <div className="absolute inset-0 bg-zinc-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                      <button
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="p-1.5 bg-zinc-900 hover:bg-rose-950 hover:text-rose-400 text-zinc-400 rounded-md border border-zinc-800 self-end transition-colors"
                        title="Remove from history"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <div className="text-[9px] text-zinc-300 line-clamp-2 leading-relaxed bg-zinc-900/60 p-1 rounded">
                        {item.prompt}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
