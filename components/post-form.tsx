'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  Loader2, 
  Send, 
  Sparkles, 
  FileText, 
  Wand2,
  RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';
import { MediaUpload } from './media-upload';
import { StructuredInputForm, StructuredInput } from './structured-input-form';

type PostMode = 'manual' | 'structured' | 'ai';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  filename: string;
  mimeType: string;
  size: number;
}

interface PostFormProps {
  initialContent?: string;
  initialScheduledFor?: string;
  initialMode?: PostMode;
  initialMedia?: MediaItem[];
  initialStructuredInput?: StructuredInput;
  initialAiPrompt?: string;
  postId?: string;
  editMode?: boolean;
}

const modeConfig = {
  manual: {
    label: 'Manual',
    description: 'Write your post content directly',
    icon: FileText,
  },
  structured: {
    label: 'Structured',
    description: 'Provide details, AI writes the post',
    icon: Sparkles,
  },
  ai: {
    label: 'AI Generate',
    description: 'Describe your topic, AI creates the post',
    icon: Wand2,
  },
};

export function PostForm({
  initialContent = '',
  initialScheduledFor,
  initialMode = 'manual',
  initialMedia = [],
  initialStructuredInput = {},
  initialAiPrompt = '',
  postId,
  editMode = false,
}: PostFormProps) {
  const router = useRouter();
  
  // Mode state
  const [mode, setMode] = useState<PostMode>(initialMode);
  
  // Content state
  const [content, setContent] = useState(initialContent);
  const [generatedContent, setGeneratedContent] = useState('');
  
  // Structured input state
  const [structuredInput, setStructuredInput] = useState<StructuredInput>(initialStructuredInput);
  
  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState(initialAiPrompt);
  
  // AI options
  const [tone, setTone] = useState<'professional' | 'casual' | 'inspirational' | 'educational'>('professional');
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [targetAudience, setTargetAudience] = useState('');
  
  // Media state
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  
  // Scheduling state
  const [scheduledFor, setScheduledFor] = useState(initialScheduledFor || '');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const characterCount = content.length;
  const maxCharacters = 3000;
  const isOverLimit = characterCount > maxCharacters;

  const handleGenerateContent = async () => {
    if (mode === 'structured' && !structuredInput.title) {
      setError('Please provide at least a title');
      return;
    }
    if (mode === 'ai' && !aiPrompt.trim()) {
      setError('Please provide a topic or context');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          mode,
          structuredInput: mode === 'structured' ? structuredInput : undefined,
          aiPrompt: mode === 'ai' ? aiPrompt : undefined,
          tone,
          includeEmojis,
          includeHashtags,
          targetAudience: targetAudience || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate content');
      }

      const data = await response.json();
      setGeneratedContent(data.content);
      setContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (action: 'draft' | 'schedule' | 'publish') => {
    if (!content.trim()) {
      setError('Please enter or generate some content');
      return;
    }

    if (isOverLimit) {
      setError('Content exceeds character limit');
      return;
    }

    if (action === 'schedule' && !scheduledFor) {
      setError('Please select a date and time for scheduling');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const url = editMode && postId ? `/api/posts/${postId}` : '/api/posts';
      const method = editMode ? 'PUT' : 'POST';

      const body: Record<string, unknown> = { 
        mode,
        content,
        generatedContent: mode !== 'manual' ? generatedContent : undefined,
        structuredInput: mode === 'structured' ? structuredInput : undefined,
        aiPrompt: mode === 'ai' ? aiPrompt : undefined,
        media,
      };

      if (action === 'publish') {
        body.publishNow = true;
      } else if (action === 'schedule') {
        body.scheduledFor = new Date(scheduledFor).toISOString();
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save post');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const minDateTime = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          How would you like to create your post?
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(modeConfig) as PostMode[]).map((m) => {
            const config = modeConfig[m];
            const Icon = config.icon;
            const isSelected = mode === m;
            
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                <div className={`rounded-lg p-2 ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                  <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}`} />
                </div>
                <span className={`mt-3 font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {config.label}
                </span>
                <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {config.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Structured Input Form */}
      {mode === 'structured' && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <StructuredInputForm 
            value={structuredInput} 
            onChange={setStructuredInput} 
          />
        </div>
      )}

      {/* AI Prompt Input */}
      {mode === 'ai' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              What would you like to post about?
            </label>
            <textarea
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the topic, your thoughts, or context for the post. The more detail you provide, the better the result.

Example: I just finished a weekend project building a CLI tool that converts Figma designs to React components. It uses the Figma API and generates TypeScript code with Tailwind CSS. I learned a lot about AST manipulation..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>
        </div>
      )}

      {/* AI Options (for structured and AI modes) */}
      {mode !== 'manual' && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            AI Generation Options
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as typeof tone)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="inspirational">Inspirational</option>
                <option value="educational">Educational</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Target Audience (optional)
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., developers, founders"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeEmojis}
                  onChange={(e) => setIncludeEmojis(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Include emojis</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Include hashtags</span>
              </label>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleGenerateContent}
            disabled={isGenerating}
            className="mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : generatedContent ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generatedContent ? 'Regenerate Content' : 'Generate Content'}
          </button>
        </div>
      )}

      {/* Content Editor */}
      <div>
        <label
          htmlFor="content"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {mode === 'manual' ? 'Post Content' : 'Generated Content (you can edit)'}
        </label>
        <div className="relative mt-2">
          <textarea
            id="content"
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={mode === 'manual' 
              ? "What would you like to share on LinkedIn?" 
              : "Click 'Generate Content' above to create your post, then edit as needed..."
            }
            className={`block w-full rounded-lg border bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 ${
              isOverLimit
                ? 'border-red-500 focus:ring-red-500'
                : 'border-zinc-300 focus:ring-blue-500 dark:border-zinc-700'
            }`}
          />
          <div
            className={`absolute bottom-3 right-3 text-sm ${
              isOverLimit
                ? 'text-red-500'
                : characterCount > maxCharacters * 0.9
                  ? 'text-yellow-500'
                  : 'text-zinc-400'
            }`}
          >
            {characterCount}/{maxCharacters}
          </div>
        </div>
      </div>

      {/* Media Upload */}
      <MediaUpload 
        media={media} 
        onMediaChange={setMedia}
      />

      {/* Schedule Input */}
      <div>
        <label
          htmlFor="scheduledFor"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Schedule for (optional)
        </label>
        <div className="relative mt-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Calendar className="h-5 w-5 text-zinc-400" />
          </div>
          <input
            type="datetime-local"
            id="scheduledFor"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            min={minDateTime}
            className="block w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => handleSubmit('draft')}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save as Draft
        </button>

        <button
          type="button"
          onClick={() => handleSubmit('schedule')}
          disabled={isSubmitting || !scheduledFor}
          className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          Schedule Post
        </button>

        <button
          type="button"
          onClick={() => handleSubmit('publish')}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Publish Now
        </button>
      </div>
    </div>
  );
}
