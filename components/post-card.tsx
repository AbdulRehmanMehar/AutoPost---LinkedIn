'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  Loader2,
  MoreVertical,
  Send,
  Trash2,
  XCircle,
  FileText,
  Sparkles,
  Wand2,
  Image,
  Video,
} from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  filename: string;
}

interface Post {
  _id: string;
  mode?: 'manual' | 'structured' | 'ai';
  content: string;
  media?: MediaItem[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledFor?: string;
  publishedAt?: string;
  createdAt: string;
  error?: string;
}

interface PostCardProps {
  post: Post;
}

const statusConfig = {
  draft: {
    label: 'Draft',
    icon: Edit,
    className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  scheduled: {
    label: 'Scheduled',
    icon: Clock,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  published: {
    label: 'Published',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  },
};

const modeConfig = {
  manual: { icon: FileText, label: 'Manual' },
  structured: { icon: Sparkles, label: 'Structured' },
  ai: { icon: Wand2, label: 'AI Generated' },
};

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const status = statusConfig[post.status];
  const StatusIcon = status.icon;
  const mode = modeConfig[post.mode || 'manual'];
  const ModeIcon = mode.icon;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/posts/${post._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const handlePublishNow = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/posts/${post._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishNow: true }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Error publishing post:', error);
    } finally {
      setIsPublishing(false);
      setShowMenu(false);
    }
  };

  const truncatedContent =
    post.content.length > 200 ? post.content.slice(0, 200) + '...' : post.content;

  const imageCount = post.media?.filter(m => m.type === 'image').length || 0;
  const videoCount = post.media?.filter(m => m.type === 'video').length || 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              <ModeIcon className="h-3 w-3" />
              {mode.label}
            </span>
            {(imageCount > 0 || videoCount > 0) && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                {imageCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Image className="h-3 w-3" />
                    {imageCount}
                  </span>
                )}
                {videoCount > 0 && (
                  <span className="flex items-center gap-0.5 ml-1">
                    <Video className="h-3 w-3" />
                    {videoCount}
                  </span>
                )}
              </span>
            )}
            {post.scheduledFor && post.status === 'scheduled' && (
              <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(post.scheduledFor), 'MMM d, yyyy h:mm a')}
              </span>
            )}
            {post.publishedAt && post.status === 'published' && (
              <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <CheckCircle className="h-3.5 w-3.5" />
                Published {format(new Date(post.publishedAt), 'MMM d, yyyy h:mm a')}
              </span>
            )}
          </div>

          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {truncatedContent}
          </p>

          {/* Media preview */}
          {post.media && post.media.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {post.media.slice(0, 4).map((item, index) => (
                <div key={item.id} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {item.type === 'image' ? (
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.url} className="h-full w-full object-cover" />
                  )}
                  {index === 3 && post.media && post.media.length > 4 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
                      +{post.media.length - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {post.error && (
            <p className="text-xs text-red-500 dark:text-red-400">Error: {post.error}</p>
          )}

          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Created {format(new Date(post.createdAt), 'MMM d, yyyy h:mm a')}
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <MoreVertical className="h-4 w-4 text-zinc-500" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {(post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed') && (
                  <>
                    <button
                      onClick={() => router.push(`/dashboard/edit/${post._id}`)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={handlePublishNow}
                      disabled={isPublishing}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {isPublishing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Publish Now
                    </button>
                  </>
                )}
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
