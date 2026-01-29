import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import connectToDatabase from '@/lib/mongodb';
import Post from '@/lib/models/Post';
import User from '@/lib/models/User';
import { PostForm } from '@/components/post-form';

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login');
  }

  const { id } = await params;

  await connectToDatabase();
  
  const user = await User.findOne({ email: session.user.email });
  
  if (!user) {
    redirect('/login');
  }

  const post = await Post.findOne({ _id: id, userId: user._id });

  if (!post) {
    notFound();
  }

  if (post.status === 'published') {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Edit Post
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Update your LinkedIn post
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <PostForm
          initialContent={post.content}
          initialScheduledFor={post.scheduledFor?.toISOString().slice(0, 16)}
          initialMode={post.mode || 'manual'}
          initialMedia={post.media || []}
          initialStructuredInput={post.structuredInput}
          initialAiPrompt={post.aiPrompt}
          initialPostAs={post.postAs || 'person'}
          initialOrganizationId={post.organizationId}
          postId={post._id.toString()}
          editMode={true}
        />
      </div>
    </div>
  );
}
