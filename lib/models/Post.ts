import mongoose, { Schema, Document, Model } from 'mongoose';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type PostMode = 'manual' | 'structured' | 'ai';

export interface StructuredInput {
  title?: string;
  problem?: string;
  solution?: string;
  tech?: string[];
  outcome?: string;
  cta?: string;
  customFields?: Record<string, string>;
}

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  filename: string;
  mimeType: string;
  size: number;
}

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  mode: PostMode;
  content: string;
  generatedContent?: string; // AI-generated content before user edits
  structuredInput?: StructuredInput;
  aiPrompt?: string;
  media: MediaItem[];
  scheduledFor?: Date;
  publishedAt?: Date;
  status: PostStatus;
  linkedinPostId?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MediaItemSchema = new Schema<MediaItem>(
  {
    id: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false }
);

const StructuredInputSchema = new Schema<StructuredInput>(
  {
    title: String,
    problem: String,
    solution: String,
    tech: [String],
    outcome: String,
    cta: String,
    customFields: { type: Map, of: String },
  },
  { _id: false }
);

const PostSchema = new Schema<IPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mode: {
      type: String,
      enum: ['manual', 'structured', 'ai'],
      default: 'manual',
    },
    content: {
      type: String,
      required: true,
      maxlength: 3000, // LinkedIn character limit
    },
    generatedContent: {
      type: String,
    },
    structuredInput: StructuredInputSchema,
    aiPrompt: {
      type: String,
    },
    media: {
      type: [MediaItemSchema],
      default: [],
    },
    scheduledFor: {
      type: Date,
    },
    publishedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'failed'],
      default: 'draft',
    },
    linkedinPostId: {
      type: String,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying of scheduled posts
PostSchema.index({ status: 1, scheduledFor: 1 });
PostSchema.index({ userId: 1, createdAt: -1 });

const Post: Model<IPost> = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);

export default Post;
