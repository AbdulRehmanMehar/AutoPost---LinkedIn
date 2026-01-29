'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Plus,
  User,
  Building2,
  Clock,
  CheckCircle,
  Edit3,
  FileText,
  TrendingUp,
  Eye,
  ThumbsUp,
  MessageSquare,
  Share2,
  Sparkles,
  Calendar,
  RefreshCw,
  MoreVertical,
  Linkedin,
  Facebook,
  Twitter,
} from 'lucide-react';

interface PlatformConnection {
  platform: 'linkedin' | 'facebook' | 'twitter';
  platformId?: string;
  platformUsername?: string;
  isActive: boolean;
  connectedAt?: string;
}

interface Page {
  _id: string;
  type: 'personal' | 'organization' | 'manual';
  linkedinId?: string;
  organizationId?: string;
  name: string;
  avatar?: string;
  vanityName?: string;
  isManual?: boolean;
  connections?: PlatformConnection[];
  contentStrategy: {
    persona: string;
    topics: string[];
    tone: string;
    targetAudience: string;
    postingFrequency: number;
    preferredAngles: string[];
  };
  schedule: {
    timezone: string;
    preferredDays: number[];
    preferredTimes: string[];
    autoGenerate: boolean;
    autoApprove: boolean;
  };
  stats: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
    avgEngagementRate: number;
  };
  isActive: boolean;
  createdAt: string;
}

interface Post {
  _id: string;
  content: string;
  status: 'pending' | 'scheduled' | 'published' | 'failed';
  confidenceScore?: number;
  scheduledFor?: string;
  publishedAt?: string;
  metrics?: {
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PageDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const pageId = params.id as string;

  const [page, setPage] = useState<Page | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [generating, setGenerating] = useState(false);
  const [postCounts, setPostCounts] = useState({
    pending: 0,
    scheduled: 0,
    published: 0,
    failed: 0,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && pageId) {
      fetchPage();
      fetchPosts();
    }
  }, [session, pageId, statusFilter]);

  const fetchPage = async () => {
    try {
      const response = await fetch(`/api/pages/${pageId}`);
      if (response.ok) {
        const data = await response.json();
        setPage(data.page);
      } else if (response.status === 404) {
        router.push('/dashboard/pages');
      }
    } catch (error) {
      console.error('Failed to fetch page:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '10');

      const response = await fetch(`/api/pages/${pageId}/posts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
        setPostCounts(data.counts || {
          pending: 0,
          scheduled: 0,
          published: 0,
          failed: 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleGeneratePost = async () => {
    if (!page) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: page._id,
          usePageStrategy: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to edit the new post
        router.push(`/dashboard/edit/${data.post._id}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to generate post');
      }
    } catch (error) {
      console.error('Failed to generate:', error);
      alert('Failed to generate post');
    } finally {
      setGenerating(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <p className="text-gray-500">Page not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/pages"
            className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            All Pages
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {page.avatar ? (
                <img
                  src={page.avatar}
                  alt={page.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  {page.type === 'personal' ? (
                    <User className="h-8 w-8 text-white" />
                  ) : (
                    <Building2 className="h-8 w-8 text-white" />
                  )}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {page.name}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 capitalize">
                  {page.isManual ? 'Manual' : page.type} Profile
                  {page.vanityName && ` • @${page.vanityName}`}
                </p>
                {/* Connected Platforms */}
                <div className="flex items-center gap-2 mt-2">
                  {page.connections?.filter(c => c.isActive).map((conn) => (
                    <div
                      key={conn.platform}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        conn.platform === 'linkedin'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : conn.platform === 'facebook'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                      }`}
                    >
                      {conn.platform === 'linkedin' && <Linkedin className="h-3 w-3" />}
                      {conn.platform === 'facebook' && <Facebook className="h-3 w-3" />}
                      {conn.platform === 'twitter' && <Twitter className="h-3 w-3" />}
                      <span className="capitalize">{conn.platformUsername || conn.platform}</span>
                      <CheckCircle className="h-3 w-3" />
                    </div>
                  ))}
                  {(!page.connections || page.connections.filter(c => c.isActive).length === 0) && (
                    <Link
                      href={`/dashboard/pages/${page._id}/settings`}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      No platforms connected - Click to connect
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGeneratePost}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Post
              </button>
              <Link
                href={`/dashboard/create?pageId=${page._id}`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create Post
              </Link>
              <Link
                href={`/dashboard/pages/${page._id}/settings`}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <Settings className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-sm">Impressions</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {page.stats?.totalImpressions?.toLocaleString() || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm">Engagements</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {page.stats?.totalEngagements?.toLocaleString() || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Engagement Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {((page.stats?.avgEngagementRate || 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Total Posts</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {page.stats?.totalPosts || 0}
            </div>
          </div>
        </div>

        {/* Strategy Summary */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Content Strategy
            </h2>
            <Link
              href={`/dashboard/pages/${page._id}/settings`}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Edit
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Persona
              </h3>
              <p className="text-gray-900 dark:text-white">
                {page.contentStrategy?.persona || 'Not set'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Target Audience
              </h3>
              <p className="text-gray-900 dark:text-white">
                {page.contentStrategy?.targetAudience || 'Not set'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tone
              </h3>
              <p className="text-gray-900 dark:text-white">
                {page.contentStrategy?.tone || 'Not set'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Topics
              </h3>
              <div className="flex flex-wrap gap-1">
                {page.contentStrategy?.topics?.length ? (
                  page.contentStrategy.topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm"
                    >
                      {topic}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">No topics specified</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">
                  {page.contentStrategy?.postingFrequency || 3}x per week
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">
                  {page.schedule?.preferredDays?.map((d) => DAYS[d]).join(', ') || 'Weekdays'}
                </span>
              </div>
              {page.schedule?.autoGenerate && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                  <Sparkles className="h-3 w-3" />
                  Auto-generate
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
          <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Posts</h2>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All ({postCounts ? Object.values(postCounts).reduce((a, b) => a + b, 0) : 0})</option>
                  <option value="pending">Pending ({postCounts?.pending ?? 0})</option>
                  <option value="scheduled">Scheduled ({postCounts?.scheduled ?? 0})</option>
                  <option value="published">Published ({postCounts?.published ?? 0})</option>
                  <option value="failed">Failed ({postCounts?.failed ?? 0})</option>
                </select>
              </div>
            </div>
          </div>

          {postsLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No posts yet for this page
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleGeneratePost}
                  disabled={generating}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700"
                >
                  Generate First Post
                </button>
                <Link
                  href={`/dashboard/create?pageId=${page._id}`}
                  className="px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  Create Manually
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-zinc-800">
              {posts.map((post) => (
                <div key={post._id} className="p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white line-clamp-2">
                        {post.content.substring(0, 200)}
                        {post.content.length > 200 && '...'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span
                          className={`px-2 py-0.5 rounded capitalize ${
                            post.status === 'published'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : post.status === 'scheduled'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                              : post.status === 'failed'
                              ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                          }`}
                        >
                          {post.status}
                        </span>
                        {post.confidenceScore !== undefined && (
                          <span className="text-gray-500 dark:text-gray-400">
                            {(post.confidenceScore * 100).toFixed(0)}% confidence
                          </span>
                        )}
                        {post.scheduledFor && (
                          <span className="text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(post.scheduledFor).toLocaleDateString()}
                          </span>
                        )}
                        {post.metrics && (
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            <span><Eye className="h-3 w-3 inline" /> {post.metrics.impressions}</span>
                            <span><ThumbsUp className="h-3 w-3 inline" /> {post.metrics.likes}</span>
                            <span><MessageSquare className="h-3 w-3 inline" /> {post.metrics.comments}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/edit/${post._id}`}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-zinc-800 text-center">
              <Link
                href={`/dashboard/scheduled?pageId=${page._id}`}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                View all posts →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
