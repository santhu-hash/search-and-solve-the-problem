/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Check,
  Copy,
  RotateCcw,
  HelpCircle,
  AlertTriangle,
  Bookmark,
  Trash2,
  Send,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import {
  buildTailoredReportFromSearch,
  type DiagnosticReport,
  type LanguageMode,
} from './data/mobilePresets';

type ActiveTab = 'search' | 'saved';

interface UploadedScreenshot {
  fileName: string;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
}

/**
 * Resizes and compresses a phone screenshot on an HTML5 Canvas so even 8MB+
 * mobile screenshots transmit rapidly to the diagnostic server.
 */
function compressScreenshotFile(file: File): Promise<UploadedScreenshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 1440;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const base64Raw = dataUrl.split(',')[1] || '';
          resolve({
            fileName: file.name || 'screenshot.png',
            previewUrl: dataUrl,
            base64Data: base64Raw,
            mimeType: file.type || 'image/png',
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64Data = compressedDataUrl.split(',')[1] || '';
        resolve({
          fileName: file.name || 'screenshot.jpg',
          previewUrl: compressedDataUrl,
          base64Data,
          mimeType: 'image/jpeg',
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');
  const [languageMode, setLanguageMode] = useState<LanguageMode>('bilingual');

  // Open free-text search inputs — no fixed options or dropdowns
  const [brandInput, setBrandInput] = useState<string>('');
  const [modelInput, setModelInput] = useState<string>('');
  const [configInput, setConfigInput] = useState<string>('');
  const [problemQuery, setProblemQuery] = useState<string>('');

  // Screenshot upload state
  const [screenshot, setScreenshot] = useState<UploadedScreenshot | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Diagnostic report state (null until the user searches)
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Step completion & per-step question state
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [copiedPathIndex, setCopiedPathIndex] = useState<number | null>(null);

  // Per-step follow-up assistant state
  const [openStepHelpIndex, setOpenStepHelpIndex] = useState<number | null>(null);
  const [stepQuestionInput, setStepQuestionInput] = useState<string>('');
  const [stepHelpAnswers, setStepHelpAnswers] = useState<Record<number, string>>({});
  const [isStepHelpLoading, setIsStepHelpLoading] = useState<boolean>(false);

  // Saved reports in localStorage
  const [savedReports, setSavedReports] = useState<DiagnosticReport[]>(() => {
    try {
      const raw = localStorage.getItem('fixbench_user_reports_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [justSaved, setJustSaved] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('fixbench_user_reports_v2', JSON.stringify(savedReports));
    } catch {
      // ignore storage errors
    }
  }, [savedReports]);

  const handleProcessFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please upload a valid image screenshot (PNG, JPG, or WEBP).');
      return;
    }
    try {
      setFormError('');
      const processed = await compressScreenshotFile(file);
      setScreenshot(processed);
    } catch {
      setFormError('Could not process the screenshot image. Please try another file.');
    }
  };

  const handlePasteScreenshot = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          await handleProcessFile(file);
          break;
        }
      }
    }
  };

  const handleSearchDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();

    const combinedText = [brandInput, modelInput, configInput, problemQuery]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');

    if (!combinedText && !screenshot) {
      setFormError(
        'Please describe your mobile problem or upload a screenshot of the problem (మీ మొబైల్ ప్రాబ్లం టైప్ చేయండి లేదా స్క్రీన్‌షాట్ అప్‌లోడ్ చేయండి).'
      );
      return;
    }

    setFormError('');
    setActiveTab('search');
    setIsSearching(true);
    setCompletedSteps({});
    setOpenStepHelpIndex(null);

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: brandInput.trim(),
          model: modelInput.trim(),
          configurations: configInput.trim(),
          problemQuery:
            problemQuery.trim() ||
            combinedText ||
            'Identify the problem shown in the uploaded mobile screenshot',
          screenshotBase64: screenshot?.base64Data || '',
          screenshotMimeType: screenshot?.mimeType || 'image/jpeg',
          languageMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data?.report && Array.isArray(data.report.steps)) {
        setReport({
          ...data.report,
          id: `rep-${Date.now()}`,
          createdAt: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          screenshotPreviewUrl: screenshot?.previewUrl,
          brandInput: brandInput.trim(),
          modelInput: modelInput.trim(),
          configInput: configInput.trim(),
          querySnapshot: problemQuery.trim() || combinedText,
        });
      } else {
        throw new Error('Invalid report structure');
      }
    } catch {
      const fallbackReport = buildTailoredReportFromSearch(
        brandInput.trim(),
        modelInput.trim(),
        configInput.trim(),
        problemQuery.trim() || combinedText,
        !!screenshot
      );
      setReport({
        ...fallbackReport,
        id: `rep-${Date.now()}`,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        screenshotPreviewUrl: screenshot?.previewUrl,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetAll = () => {
    setBrandInput('');
    setModelInput('');
    setConfigInput('');
    setProblemQuery('');
    setScreenshot(null);
    setReport(null);
    setFormError('');
    setCompletedSteps({});
    setOpenStepHelpIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleStepComplete = (stepNum: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNum]: !prev[stepNum],
    }));
  };

  const handleCopyPath = (stepNum: number, pathText: string) => {
    navigator.clipboard?.writeText(pathText);
    setCopiedPathIndex(stepNum);
    setTimeout(() => setCopiedPathIndex(null), 1800);
  };

  const handleAskStepHelp = async (
    stepNumber: number,
    stepTitle: string,
    settingsPath: string
  ) => {
    if (!stepQuestionInput.trim()) return;
    setIsStepHelpLoading(true);
    const deviceLabel =
      report?.detectedDeviceLabel ||
      [brandInput, modelInput, configInput].filter(Boolean).join(' ') ||
      'Mobile Device';

    try {
      const res = await fetch('/api/step-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceLabel,
          stepTitle,
          settingsPath,
          userQuestion: stepQuestionInput,
          languageMode,
        }),
      });
      const data = await res.json();
      if (data?.answer) {
        setStepHelpAnswers((prev) => ({ ...prev, [stepNumber]: data.answer }));
      } else {
        throw new Error('No answer');
      }
    } catch {
      setStepHelpAnswers((prev) => ({
        ...prev,
        [stepNumber]: `Open the Settings app on your ${deviceLabel} and type "${
          settingsPath.split('→').pop()?.trim() || 'Apps'
        }" in the top Settings search bar to jump directly to this option.`,
      }));
    } finally {
      setIsStepHelpLoading(false);
      setStepQuestionInput('');
    }
  };

  const handleSaveCurrentReport = () => {
    if (!report) return;
    const entry: DiagnosticReport = {
      ...report,
      id: report.id || `rep-${Date.now()}`,
      createdAt:
        report.createdAt ||
        new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
    };
    setSavedReports((prev) => [
      entry,
      ...prev.filter((r) => r.issueTitle !== entry.issueTitle),
    ]);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const completedStepsCount = Object.values(completedSteps).filter(Boolean).length;
  const totalStepsCount = report?.steps.length || 1;
  const completionPercentage = Math.round(
    (completedStepsCount / totalStepsCount) * 100
  );

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col"
      onPaste={handlePasteScreenshot}
    >
      {/* Top Bar Contract: Strictly 1 row, 3 zones (Brand Wordmark — Nav Links — Primary Actions) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('search');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          FixBench
        </a>

        {/* Zone 2: Clean text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
              activeTab === 'search'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                : 'hover:text-slate-900'
            }`}
          >
            Search Mobile Problem
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors tabular-nums cursor-pointer ${
              activeTab === 'saved'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                : 'hover:text-slate-900'
            }`}
          >
            Saved Searches ({savedReports.length})
          </button>
        </nav>

        {/* Zone 3: Language selector + New Search */}
        <div className="flex items-center gap-3">
          <select
            aria-label="Explanation Language Mode"
            value={languageMode}
            onChange={(e) => setLanguageMode(e.target.value as LanguageMode)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 whitespace-nowrap shrink-0"
          >
            <option value="bilingual">English + Telugu</option>
            <option value="tanglish">Tanglish (Telugu in English)</option>
            <option value="telugu">తెలుగు (Telugu)</option>
            <option value="english">English</option>
          </select>

          <button
            type="button"
            onClick={handleResetAll}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            New Search
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1080px] w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'search' && (
          <div className="space-y-8">
            {/* OPEN USER SEARCH & SCREENSHOT UPLOAD WORKBENCH */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
              <div className="max-w-2xl mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Mobile Problem Search & Screenshot Diagnosis
                </h1>
                <p className="text-sm text-slate-600 mt-1.5">
                  Type your mobile brand, model, configurations, and problem — or upload a screenshot of your phone screen to easily identify and fix the issue step by step.
                </p>
              </div>

              <form onSubmit={handleSearchDiagnosis} className="space-y-5">
                {/* Row 1: User types their Mobile Brand, Model, and Configurations */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="user-brand-input"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      1. Mobile Brand (మొబైల్ బ్రాండ్)
                    </label>
                    <input
                      id="user-brand-input"
                      type="text"
                      value={brandInput}
                      onChange={(e) => setBrandInput(e.target.value)}
                      placeholder="Type your mobile brand..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="user-model-input"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      2. Mobile Model (మోడల్)
                    </label>
                    <input
                      id="user-model-input"
                      type="text"
                      value={modelInput}
                      onChange={(e) => setModelInput(e.target.value)}
                      placeholder="Type your mobile model..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="user-config-input"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      3. Configurations (RAM / Storage / OS)
                    </label>
                    <input
                      id="user-config-input"
                      type="text"
                      value={configInput}
                      onChange={(e) => setConfigInput(e.target.value)}
                      placeholder="Type RAM, Storage, Android/iOS version..."
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {/* Row 2: Screenshot Upload Zone (Upload / Drag & Drop / Paste) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    4. Upload Problem Screenshot (స్క్రీన్‌షాట్ అప్‌లోడ్ చేయండి — Easy Problem Identification)
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProcessFile(e.target.files?.[0])}
                    className="hidden"
                  />

                  {!screenshot ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(true);
                      }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        handleProcessFile(e.dataTransfer.files?.[0]);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer transition-colors ${
                        isDraggingOver
                          ? 'border-blue-600 bg-blue-50/50'
                          : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-slate-900">
                            Click to upload a mobile screenshot, drag & drop, or paste (Ctrl+V)
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Upload error pop-ups, virus alerts, battery/storage screens, or settings screenshots (PNG, JPG, WEBP)
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Choose Screenshot
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 bg-slate-50 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={screenshot.previewUrl}
                          alt="Uploaded mobile screenshot preview"
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                        />
                        <div>
                          <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Screenshot Attached for Diagnosis</span>
                          </div>
                          <div className="text-xs font-mono text-slate-700 truncate max-w-xs mt-0.5">
                            {screenshot.fileName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Press "Search" below to analyze this screenshot and get step-by-step instructions.
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Change Image
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshot(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-slate-200 hover:bg-red-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 3: Main Problem Search Bar */}
                <div>
                  <label
                    htmlFor="user-problem-search"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    5. Describe Your Mobile Problem (మీ మొబైల్ ప్రాబ్లం ఇక్కడ టైప్ చేయండి — Optional if screenshot is uploaded)
                  </label>
                  <div className="relative">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
                    <input
                      id="user-problem-search"
                      type="text"
                      value={problemQuery}
                      onChange={(e) => setProblemQuery(e.target.value)}
                      placeholder="Type any mobile problem or virus issue here (or leave blank to diagnose from your screenshot)..."
                      className="w-full pl-12 pr-40 py-3 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="absolute right-2 top-2 bottom-2 px-5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isSearching ? 'Analyzing...' : 'Search Problem'}
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="text-xs font-medium text-red-600">{formError}</p>
                )}
              </form>
            </section>

            {/* Loading Skeleton while Searching */}
            {isSearching && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/4" />
                <div className="h-7 bg-slate-200 rounded w-2/3" />
                <div className="h-16 bg-slate-100 rounded w-full" />
                <div className="space-y-3 pt-4">
                  <div className="h-24 bg-slate-100 rounded w-full" />
                  <div className="h-24 bg-slate-100 rounded w-full" />
                  <div className="h-24 bg-slate-100 rounded w-full" />
                </div>
              </div>
            )}

            {/* Empty State before user searches */}
            {!isSearching && !report && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Ready to Identify Your Mobile Problem
                </h2>
                <p className="text-sm text-slate-500 max-w-xl mx-auto">
                  Enter your mobile brand, model, and configurations, upload a screenshot of the issue, or type your problem in the search bar above to get clear step-by-step instructions.
                </p>
              </div>
            )}

            {/* Step-by-Step Diagnostic Result */}
            {!isSearching && report && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-7">
                {/* Report Header */}
                <div className="border-b border-slate-200 pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {report.detectedDeviceLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-blue-700">
                        {report.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Est. Time: {report.estimatedMinutes} mins
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Data Risk: {report.dataLossRisk}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveCurrentReport}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{justSaved ? 'Saved' : 'Save Guide'}</span>
                    </button>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {report.issueTitle}
                  </h2>
                </div>

                {/* Screenshot Visual Identification Box (Shown when user uploaded a screenshot) */}
                {(report.screenshotFinding || report.screenshotPreviewUrl) && (
                  <div className="pb-6 border-b border-slate-200 flex flex-col sm:flex-row items-start gap-5">
                    {report.screenshotPreviewUrl && (
                      <img
                        src={report.screenshotPreviewUrl}
                        alt="Analyzed mobile screenshot"
                        referrerPolicy="no-referrer"
                        className="w-28 sm:w-36 max-h-56 object-contain rounded-lg border border-slate-200 bg-slate-50 shrink-0"
                      />
                    )}
                    <div className="space-y-2 flex-1">
                      <div className="text-xs font-semibold text-blue-700">
                        Screenshot Visual Identification (స్క్రీన్‌షాట్ విశ్లేషణ)
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed">
                        {report.screenshotFinding ||
                          'Analyzed your uploaded mobile screenshot to identify the active error state and matched the step-by-step fix below.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Section 1: What Is This Problem? */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-900">
                    01. What Is This Problem? (అసలు ఈ ప్రాబ్లం ఏమిటి?)
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {report.whatIsTheProblem}
                  </p>

                  {report.teluguOrTanglishSummary && (
                    <div className="pl-4 border-l-2 border-blue-600 py-1">
                      <div className="text-xs font-semibold text-slate-900 mb-1">
                        Simple Explanation (తెలుగు / Tanglish):
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {report.teluguOrTanglishSummary}
                      </p>
                    </div>
                  )}

                  {report.rootCauses && report.rootCauses.length > 0 && (
                    <div className="pt-2">
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">
                        Why This Happens:
                      </div>
                      <ul className="space-y-1 text-sm text-slate-700 list-disc pl-5">
                        {report.rootCauses.map((cause, idx) => (
                          <li key={idx}>{cause}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Section 2: Configuration Impact */}
                {report.configurationImpact &&
                  report.configurationImpact.length > 0 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h3 className="text-base font-semibold text-slate-900 mb-3">
                        02. Device & Configuration Analysis
                      </h3>
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                              <th className="py-2.5 px-4 w-1/3">
                                Device / Configuration
                              </th>
                              <th className="py-2.5 px-4">
                                How It Relates to Your Problem
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {report.configurationImpact.map((item, idx) => (
                              <tr key={idx}>
                                <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900 tabular-nums align-top">
                                  {item.specLabel}
                                </td>
                                <td className="py-3 px-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                                  {item.impactAnalysis}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Section 3: Step-by-Step Repair Instructions */}
                <div className="pt-6 border-t border-slate-200 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        03. Step-by-Step Solution (స్టెప్-బై-స్టెప్ పరిష్కారం)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Follow each step in order to fix your mobile problem.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                      <span className="text-slate-700 font-semibold">
                        {completedStepsCount} / {totalStepsCount} Steps Completed (
                        {completionPercentage}%)
                      </span>
                      {completedStepsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setCompletedSteps({})}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-transform duration-150 origin-left"
                      style={{
                        transform: `scaleX(${completionPercentage / 100})`,
                      }}
                    />
                  </div>

                  {/* Steps List */}
                  <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                    {report.steps.map((step) => {
                      const isDone = !!completedSteps[step.stepNumber];
                      const isHelpOpen = openStepHelpIndex === step.stepNumber;
                      const formattedNum = String(step.stepNumber).padStart(
                        2,
                        '0'
                      );

                      return (
                        <div
                          key={step.stepNumber}
                          className={`py-5 transition-colors ${
                            isDone ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-mono font-semibold text-blue-700 tabular-nums">
                                  Step {formattedNum}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{step.phase}</span>
                                {step.dialerCodeOrShortcut && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono text-slate-800">
                                      Shortcut: {step.dialerCodeOrShortcut}
                                    </span>
                                  </>
                                )}
                              </div>

                              <h4
                                className={`text-base font-semibold ${
                                  isDone
                                    ? 'line-through text-slate-500'
                                    : 'text-slate-900'
                                }`}
                              >
                                {formattedNum}. {step.title}
                              </h4>

                              {/* Exact Phone Menu Path */}
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 px-3 py-2 rounded-lg text-xs">
                                <div className="font-mono text-slate-800 break-all">
                                  <span className="text-slate-500 select-none">
                                    Menu Path:{' '}
                                  </span>
                                  {step.settingsPath}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyPath(
                                      step.stepNumber,
                                      step.settingsPath
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {copiedPathIndex === step.stepNumber ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="text-emerald-700">
                                        Copied
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy Path</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <p className="text-sm text-slate-800 leading-relaxed pt-1">
                                {step.instruction}
                              </p>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                                <div className="text-slate-600">
                                  <span className="font-semibold text-slate-800">
                                    Why this works:{' '}
                                  </span>
                                  {step.whyItWorks}
                                </div>
                                <div className="text-slate-600">
                                  <span className="font-semibold text-emerald-700">
                                    Expected result:{' '}
                                  </span>
                                  {step.expectedOutcome}
                                </div>
                              </div>

                              {/* Inline follow-up question for this step */}
                              <div className="pt-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenStepHelpIndex(
                                      isHelpOpen ? null : step.stepNumber
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                                >
                                  <HelpCircle className="w-3.5 h-3.5" />
                                  <span>
                                    {isHelpOpen
                                      ? 'Hide step question box'
                                      : 'Have a question about this step? Ask here'}
                                  </span>
                                </button>
                              </div>

                              {isHelpOpen && (
                                <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={stepQuestionInput}
                                      onChange={(e) =>
                                        setStepQuestionInput(e.target.value)
                                      }
                                      placeholder="Type your question about this step..."
                                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    />
                                    <button
                                      type="button"
                                      disabled={isStepHelpLoading}
                                      onClick={() =>
                                        handleAskStepHelp(
                                          step.stepNumber,
                                          step.title,
                                          step.settingsPath
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>
                                        {isStepHelpLoading
                                          ? 'Asking...'
                                          : 'Ask'}
                                      </span>
                                    </button>
                                  </div>

                                  {stepHelpAnswers[step.stepNumber] && (
                                    <div className="text-xs text-slate-800 bg-blue-50/60 border-l-2 border-blue-600 pl-3 py-2 leading-relaxed">
                                      <span className="font-semibold text-slate-900">
                                        Answer:{' '}
                                      </span>
                                      {stepHelpAnswers[step.stepNumber]}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                toggleStepComplete(step.stepNumber)
                              }
                              className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                                isDone
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isDone ? 'Done' : 'Mark Done'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4: Precautions & Service Center Advice */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Mistakes to Avoid (ఇవి చేయకండి)</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4 leading-relaxed">
                      {report.whatNotToDo.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">
                      When to Visit a Service Center
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {report.whenToVisitServiceCenter}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Saved Searches */}
        {activeTab === 'saved' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Saved Mobile Troubleshooting Guides
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your saved step-by-step repair searches
                </p>
              </div>
              {savedReports.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSavedReports([])}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {savedReports.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm text-slate-600">
                  No saved guides yet. Search your mobile problem or upload a screenshot first and click "Save Guide".
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  Go to Search
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {savedReports.map((saved, idx) => (
                  <div
                    key={saved.id || idx}
                    className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {saved.detectedDeviceLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{saved.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {saved.steps.length} Steps
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {saved.issueTitle}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBrandInput(saved.brandInput || '');
                        setModelInput(saved.modelInput || '');
                        setConfigInput(saved.configInput || '');
                        setProblemQuery(saved.querySnapshot || '');
                        setReport(saved);
                        setCompletedSteps({});
                        setActiveTab('search');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Open Guide
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-[1080px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            FixBench — Mobile Problem Search & Screenshot Diagnosis
          </span>
          <span>Supports English, తెలుగు (Telugu), and Tanglish</span>
        </div>
      </footer>
    </div>
  );
}
