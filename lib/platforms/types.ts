// Platform types and interfaces for multi-platform support

export type PlatformType = 'linkedin' | 'facebook' | 'twitter' | 'instagram';

export type PlatformAccountType = 'personal' | 'page' | 'group';

export interface PlatformConfig {
  platform: PlatformType;
  name: string;
  icon: string;
  maxCharacters: number;
  hashtagStrategy: 'few' | 'moderate' | 'many' | 'optional';
  recommendedHashtags: { min: number; max: number };
  supportsMedia: boolean;
  mediaTypes: ('image' | 'video' | 'document' | 'carousel')[];
  maxMediaItems: number;
  tonePreference: 'professional' | 'casual' | 'mixed';
  supportsScheduling: boolean;
  supportsOrganizations: boolean;
}

// Platform-specific configurations
export const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  linkedin: {
    platform: 'linkedin',
    name: 'LinkedIn',
    icon: 'linkedin',
    maxCharacters: 3000,
    hashtagStrategy: 'few',
    recommendedHashtags: { min: 3, max: 5 },
    supportsMedia: true,
    mediaTypes: ['image', 'video', 'document'],
    maxMediaItems: 9,
    tonePreference: 'professional',
    supportsScheduling: true,
    supportsOrganizations: true,
  },
  facebook: {
    platform: 'facebook',
    name: 'Facebook',
    icon: 'facebook',
    maxCharacters: 63206,
    hashtagStrategy: 'optional',
    recommendedHashtags: { min: 0, max: 3 },
    supportsMedia: true,
    mediaTypes: ['image', 'video', 'carousel'],
    maxMediaItems: 10,
    tonePreference: 'casual',
    supportsScheduling: true,
    supportsOrganizations: true,
  },
  twitter: {
    platform: 'twitter',
    name: 'X (Twitter)',
    icon: 'twitter',
    maxCharacters: 280,
    hashtagStrategy: 'few',
    recommendedHashtags: { min: 1, max: 3 },
    supportsMedia: true,
    mediaTypes: ['image', 'video'],
    maxMediaItems: 4,
    tonePreference: 'casual',
    supportsScheduling: true,
    supportsOrganizations: false,
  },
  instagram: {
    platform: 'instagram',
    name: 'Instagram',
    icon: 'instagram',
    maxCharacters: 2200,
    hashtagStrategy: 'many',
    recommendedHashtags: { min: 10, max: 30 },
    supportsMedia: true,
    mediaTypes: ['image', 'video', 'carousel'],
    maxMediaItems: 10,
    tonePreference: 'casual',
    supportsScheduling: true,
    supportsOrganizations: true,
  },
};

// Connection stored in database
export interface PlatformConnection {
  platform: PlatformType;
  // Platform account identifiers
  platformId: string; // Platform-specific account/page ID (e.g., LinkedIn URN, Facebook Page ID)
  platformUsername: string; // Display name on platform
  accountType?: PlatformAccountType;
  avatarUrl?: string;
  // Authentication
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes?: string[];
  // Connection state
  isActive: boolean;
  connectedAt: Date;
  lastUsedAt?: Date;
  // Platform-specific data
  metadata?: Record<string, unknown>;
}

// Publishing result per platform
export interface PlatformPublishResult {
  platform: PlatformType;
  connectionId: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  publishedAt?: Date;
}

// Metrics per platform
export interface PlatformMetrics {
  platform: PlatformType;
  connectionId: string;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  engagementRate?: number;
  lastUpdated?: Date;
}

// Content adapted for each platform
export interface PlatformContent {
  platform: PlatformType;
  content: string;
  hashtags?: string[];
  mediaIds?: string[]; // Platform-specific media IDs after upload
}

// Publishing options
export interface PublishOptions {
  platforms: PlatformType[];
  scheduledFor?: Date;
  mediaUrls?: string[];
}

// Platform adapter interface - all platform integrations must implement this
export interface IPlatformAdapter {
  platform: PlatformType;
  
  // Content operations
  adaptContent(baseContent: string, strategy?: ContentStrategyInput): Promise<PlatformContent>;
  
  // Publishing
  publish(
    connection: PlatformConnection,
    content: PlatformContent,
    media?: MediaUploadResult[]
  ): Promise<PlatformPublishResult>;
  
  // Media handling
  uploadMedia?(
    connection: PlatformConnection,
    mediaUrl: string,
    mediaType: 'image' | 'video'
  ): Promise<MediaUploadResult>;
  
  // Metrics
  fetchMetrics?(
    connection: PlatformConnection,
    postId: string
  ): Promise<PlatformMetrics>;
  
  // Token management
  refreshToken?(connection: PlatformConnection): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  
  // Validation
  validateConnection(connection: PlatformConnection): Promise<boolean>;
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

export interface ContentStrategyInput {
  persona?: string;
  tone?: string;
  targetAudience?: string;
  topics?: string[];
}
