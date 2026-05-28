/**
 * Prisma Zod Generator - Single File (inlined)
 * Auto-generated. Do not edit.
 */

import * as z from 'zod';
// File: TransactionIsolationLevel.schema.ts

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted', 'ReadCommitted', 'RepeatableRead', 'Serializable'])

export type TransactionIsolationLevel = z.infer<typeof TransactionIsolationLevelSchema>;

// File: UserScalarFieldEnum.schema.ts

export const UserScalarFieldEnumSchema = z.enum(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'username', 'role', 'banned', 'banReason', 'banExpires', 'onboardingComplete', 'paymentsCustomerId', 'locale', 'displayUsername', 'twoFactorEnabled', 'isAdmin'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;

// File: SessionScalarFieldEnum.schema.ts

export const SessionScalarFieldEnumSchema = z.enum(['id', 'expiresAt', 'ipAddress', 'userAgent', 'userId', 'impersonatedBy', 'activeOrganizationId', 'token', 'createdAt', 'updatedAt'])

export type SessionScalarFieldEnum = z.infer<typeof SessionScalarFieldEnumSchema>;

// File: AccountScalarFieldEnum.schema.ts

export const AccountScalarFieldEnumSchema = z.enum(['id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken', 'expiresAt', 'password', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'createdAt', 'updatedAt'])

export type AccountScalarFieldEnum = z.infer<typeof AccountScalarFieldEnumSchema>;

// File: VerificationScalarFieldEnum.schema.ts

export const VerificationScalarFieldEnumSchema = z.enum(['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'])

export type VerificationScalarFieldEnum = z.infer<typeof VerificationScalarFieldEnumSchema>;

// File: PasskeyScalarFieldEnum.schema.ts

export const PasskeyScalarFieldEnumSchema = z.enum(['id', 'name', 'publicKey', 'userId', 'credentialID', 'counter', 'deviceType', 'backedUp', 'transports', 'aaguid', 'createdAt'])

export type PasskeyScalarFieldEnum = z.infer<typeof PasskeyScalarFieldEnumSchema>;

// File: TwoFactorScalarFieldEnum.schema.ts

export const TwoFactorScalarFieldEnumSchema = z.enum(['id', 'secret', 'backupCodes', 'userId'])

export type TwoFactorScalarFieldEnum = z.infer<typeof TwoFactorScalarFieldEnumSchema>;

// File: OrganizationScalarFieldEnum.schema.ts

export const OrganizationScalarFieldEnumSchema = z.enum(['id', 'name', 'slug', 'logo', 'createdAt', 'metadata', 'paymentsCustomerId', 'inboundEmailAddress', 'inboundEmailShortId'])

export type OrganizationScalarFieldEnum = z.infer<typeof OrganizationScalarFieldEnumSchema>;

// File: MemberScalarFieldEnum.schema.ts

export const MemberScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'role', 'createdAt'])

export type MemberScalarFieldEnum = z.infer<typeof MemberScalarFieldEnumSchema>;

// File: InvitationScalarFieldEnum.schema.ts

export const InvitationScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'email', 'role', 'status', 'expiresAt', 'inviterId', 'createdAt'])

export type InvitationScalarFieldEnum = z.infer<typeof InvitationScalarFieldEnumSchema>;

// File: PurchaseScalarFieldEnum.schema.ts

export const PurchaseScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'type', 'customerId', 'subscriptionId', 'productId', 'status', 'createdAt', 'updatedAt'])

export type PurchaseScalarFieldEnum = z.infer<typeof PurchaseScalarFieldEnumSchema>;

// File: PromptVersionScalarFieldEnum.schema.ts

export const PromptVersionScalarFieldEnumSchema = z.enum(['id', 'name', 'corePrompt', 'styleDescription', 'isDefault', 'isActive', 'createdById', 'createdAt', 'updatedAt'])

export type PromptVersionScalarFieldEnum = z.infer<typeof PromptVersionScalarFieldEnumSchema>;

// File: MeetingRecordScalarFieldEnum.schema.ts

export const MeetingRecordScalarFieldEnumSchema = z.enum(['id', 'meetingId', 'topic', 'startTime', 'endTime', 'hostUserId', 'participantCount', 'status', 'promptVersionId', 'docUrl', 'docToken', 'skippedReason', 'aiSummary', 'errorMessage', 'minutesContent', 'minutesJson', 'searchText', 'userId', 'isDeleted', 'createdAt', 'updatedAt'])

export type MeetingRecordScalarFieldEnum = z.infer<typeof MeetingRecordScalarFieldEnumSchema>;

// File: ModelProviderScalarFieldEnum.schema.ts

export const ModelProviderScalarFieldEnumSchema = z.enum(['id', 'name', 'apiBase', 'apiKey', 'models', 'createdById', 'createdAt', 'updatedAt'])

export type ModelProviderScalarFieldEnum = z.infer<typeof ModelProviderScalarFieldEnumSchema>;

// File: UserModelAccessScalarFieldEnum.schema.ts

export const UserModelAccessScalarFieldEnumSchema = z.enum(['id', 'userId', 'modelProviderId'])

export type UserModelAccessScalarFieldEnum = z.infer<typeof UserModelAccessScalarFieldEnumSchema>;

// File: UserSettingsScalarFieldEnum.schema.ts

export const UserSettingsScalarFieldEnumSchema = z.enum(['id', 'userId', 'autoEnabled', 'memoryAnalysisEnabled', 'saveFolderToken', 'extraInstructions', 'activePromptVersionId', 'meetingsSyncedAt', 'createdAt', 'updatedAt'])

export type UserSettingsScalarFieldEnum = z.infer<typeof UserSettingsScalarFieldEnumSchema>;

// File: SystemConfigScalarFieldEnum.schema.ts

export const SystemConfigScalarFieldEnumSchema = z.enum(['id', 'key', 'value', 'createdAt', 'updatedAt'])

export type SystemConfigScalarFieldEnum = z.infer<typeof SystemConfigScalarFieldEnumSchema>;

// File: ProcessingLogScalarFieldEnum.schema.ts

export const ProcessingLogScalarFieldEnumSchema = z.enum(['id', 'meetingRecordId', 'step', 'status', 'detail', 'createdAt'])

export type ProcessingLogScalarFieldEnum = z.infer<typeof ProcessingLogScalarFieldEnumSchema>;

// File: SampleLearningScalarFieldEnum.schema.ts

export const SampleLearningScalarFieldEnumSchema = z.enum(['id', 'userId', 'name', 'sampleDocTokens', 'generatedPrompt', 'styleDescription', 'createdAt', 'updatedAt'])

export type SampleLearningScalarFieldEnum = z.infer<typeof SampleLearningScalarFieldEnumSchema>;

// File: FeishuMeetingScalarFieldEnum.schema.ts

export const FeishuMeetingScalarFieldEnumSchema = z.enum(['id', 'meetingId', 'meetingNo', 'topic', 'startTime', 'endTime', 'hostUserId', 'participantCount', 'participantsJson', 'transcriptText', 'transcriptFetched', 'transcriptRetryAt', 'transcriptRetryCount', 'userTranscriptText', 'docUrl', 'source', 'noteDocToken', 'meetingUrl', 'uploadedFileName', 'createdById', 'isDeleted', 'createdAt', 'updatedAt'])

export type FeishuMeetingScalarFieldEnum = z.infer<typeof FeishuMeetingScalarFieldEnumSchema>;

// File: ConversationScalarFieldEnum.schema.ts

export const ConversationScalarFieldEnumSchema = z.enum(['id', 'userId', 'title', 'summary', 'topicTags', 'messageCount', 'totalTokens', 'status', 'metadata', 'createdAt', 'updatedAt'])

export type ConversationScalarFieldEnum = z.infer<typeof ConversationScalarFieldEnumSchema>;

// File: ConversationMessageScalarFieldEnum.schema.ts

export const ConversationMessageScalarFieldEnumSchema = z.enum(['id', 'conversationId', 'role', 'content', 'intentCategory', 'intentConfidence', 'referencedFields', 'unknownFields', 'referencedMeetings', 'toolsUsed', 'tokenCount', 'processedAt', 'createdAt'])

export type ConversationMessageScalarFieldEnum = z.infer<typeof ConversationMessageScalarFieldEnumSchema>;

// File: MemoryInsightScalarFieldEnum.schema.ts

export const MemoryInsightScalarFieldEnumSchema = z.enum(['id', 'userId', 'type', 'scope', 'title', 'description', 'confidence', 'evidence', 'status', 'metadata', 'createdAt', 'updatedAt'])

export type MemoryInsightScalarFieldEnum = z.infer<typeof MemoryInsightScalarFieldEnumSchema>;

// File: DimensionProposalScalarFieldEnum.schema.ts

export const DimensionProposalScalarFieldEnumSchema = z.enum(['id', 'fieldName', 'displayName', 'description', 'suggestedType', 'scope', 'userId', 'exampleValues', 'evidenceCount', 'uniqueUsers', 'confidence', 'status', 'implementedAt', 'createdAt', 'updatedAt'])

export type DimensionProposalScalarFieldEnum = z.infer<typeof DimensionProposalScalarFieldEnumSchema>;

// File: WaitlistEntryScalarFieldEnum.schema.ts

export const WaitlistEntryScalarFieldEnumSchema = z.enum(['id', 'email', 'createdAt'])

export type WaitlistEntryScalarFieldEnum = z.infer<typeof WaitlistEntryScalarFieldEnumSchema>;

// File: SortOrder.schema.ts

export const SortOrderSchema = z.enum(['asc', 'desc'])

export type SortOrder = z.infer<typeof SortOrderSchema>;

// File: NullableJsonNullValueInput.schema.ts

export const NullableJsonNullValueInputSchema = z.enum(['DbNull', 'JsonNull'])

export type NullableJsonNullValueInput = z.infer<typeof NullableJsonNullValueInputSchema>;

// File: JsonNullValueInput.schema.ts

export const JsonNullValueInputSchema = z.enum(['JsonNull'])

export type JsonNullValueInput = z.infer<typeof JsonNullValueInputSchema>;

// File: QueryMode.schema.ts

export const QueryModeSchema = z.enum(['default', 'insensitive'])

export type QueryMode = z.infer<typeof QueryModeSchema>;

// File: NullsOrder.schema.ts

export const NullsOrderSchema = z.enum(['first', 'last'])

export type NullsOrder = z.infer<typeof NullsOrderSchema>;

// File: JsonNullValueFilter.schema.ts

export const JsonNullValueFilterSchema = z.enum(['DbNull', 'JsonNull', 'AnyNull'])

export type JsonNullValueFilter = z.infer<typeof JsonNullValueFilterSchema>;

// File: PurchaseType.schema.ts

export const PurchaseTypeSchema = z.enum(['SUBSCRIPTION', 'ONE_TIME'])

export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

// File: MeetingRecordStatus.schema.ts

export const MeetingRecordStatusSchema = z.enum(['processing', 'completed', 'skipped', 'failed'])

export type MeetingRecordStatus = z.infer<typeof MeetingRecordStatusSchema>;

// File: MeetingSource.schema.ts

export const MeetingSourceSchema = z.enum(['feishu', 'manual'])

export type MeetingSource = z.infer<typeof MeetingSourceSchema>;

// File: User.schema.ts

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  username: z.string().nullish(),
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  banReason: z.string().nullish(),
  banExpires: z.date().nullish(),
  onboardingComplete: z.boolean(),
  paymentsCustomerId: z.string().nullish(),
  locale: z.string().nullish(),
  displayUsername: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
  isAdmin: z.boolean(),
});

export type UserType = z.infer<typeof UserSchema>;


// File: Session.schema.ts

export const SessionSchema = z.object({
  id: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  userId: z.string(),
  impersonatedBy: z.string().nullish(),
  activeOrganizationId: z.string().nullish(),
  token: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SessionType = z.infer<typeof SessionSchema>;


// File: Account.schema.ts

export const AccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  userId: z.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  idToken: z.string().nullish(),
  expiresAt: z.date().nullish(),
  password: z.string().nullish(),
  accessTokenExpiresAt: z.date().nullish(),
  refreshTokenExpiresAt: z.date().nullish(),
  scope: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccountType = z.infer<typeof AccountSchema>;


// File: Verification.schema.ts

export const VerificationSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  value: z.string(),
  expiresAt: z.date(),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type VerificationType = z.infer<typeof VerificationSchema>;


// File: Passkey.schema.ts

export const PasskeySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  publicKey: z.string(),
  userId: z.string(),
  credentialID: z.string(),
  counter: z.number().int(),
  deviceType: z.string(),
  backedUp: z.boolean(),
  transports: z.string().nullish(),
  aaguid: z.string().nullish(),
  createdAt: z.date().nullish(),
});

export type PasskeyType = z.infer<typeof PasskeySchema>;


// File: TwoFactor.schema.ts

export const TwoFactorSchema = z.object({
  id: z.string(),
  secret: z.string(),
  backupCodes: z.string(),
  userId: z.string(),
});

export type TwoFactorType = z.infer<typeof TwoFactorSchema>;


// File: Organization.schema.ts

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullish(),
  logo: z.string().nullish(),
  createdAt: z.date(),
  metadata: z.string().nullish(),
  paymentsCustomerId: z.string().nullish(),
  inboundEmailAddress: z.string().nullish(),
  inboundEmailShortId: z.string().nullish(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;


// File: Member.schema.ts

export const MemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.date(),
});

export type MemberType = z.infer<typeof MemberSchema>;


// File: Invitation.schema.ts

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  status: z.string(),
  expiresAt: z.date(),
  inviterId: z.string(),
  createdAt: z.date(),
});

export type InvitationType = z.infer<typeof InvitationSchema>;


// File: Purchase.schema.ts

export const PurchaseSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  type: PurchaseTypeSchema,
  customerId: z.string(),
  subscriptionId: z.string().nullish(),
  productId: z.string(),
  status: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PurchaseModel = z.infer<typeof PurchaseSchema>;

// File: PromptVersion.schema.ts

export const PromptVersionSchema = z.object({
  id: z.string(),
  name: z.string(),
  corePrompt: z.string(),
  styleDescription: z.string().nullish(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PromptVersionType = z.infer<typeof PromptVersionSchema>;


// File: MeetingRecord.schema.ts

export const MeetingRecordSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  topic: z.string().nullish(),
  startTime: z.date().nullish(),
  endTime: z.date().nullish(),
  hostUserId: z.string().nullish(),
  participantCount: z.number().int().nullish(),
  status: MeetingRecordStatusSchema.default("processing"),
  promptVersionId: z.string().nullish(),
  docUrl: z.string().nullish(),
  docToken: z.string().nullish(),
  skippedReason: z.string().nullish(),
  aiSummary: z.string().nullish(),
  errorMessage: z.string().nullish(),
  minutesContent: z.string().nullish(),
  minutesJson: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  searchText: z.string().nullish(),
  userId: z.string(),
  isDeleted: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MeetingRecordType = z.infer<typeof MeetingRecordSchema>;


// File: ModelProvider.schema.ts

export const ModelProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiBase: z.string(),
  apiKey: z.string(),
  models: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  createdById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ModelProviderType = z.infer<typeof ModelProviderSchema>;


// File: UserModelAccess.schema.ts

export const UserModelAccessSchema = z.object({
  id: z.string(),
  userId: z.string(),
  modelProviderId: z.string(),
});

export type UserModelAccessType = z.infer<typeof UserModelAccessSchema>;


// File: UserSettings.schema.ts

export const UserSettingsSchema = z.object({
  id: z.string(),
  userId: z.string(),
  autoEnabled: z.boolean().default(true),
  memoryAnalysisEnabled: z.boolean().default(true),
  saveFolderToken: z.string().nullish(),
  extraInstructions: z.string().nullish(),
  activePromptVersionId: z.string().nullish(),
  meetingsSyncedAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserSettingsType = z.infer<typeof UserSettingsSchema>;


// File: SystemConfig.schema.ts

export const SystemConfigSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SystemConfigType = z.infer<typeof SystemConfigSchema>;


// File: ProcessingLog.schema.ts

export const ProcessingLogSchema = z.object({
  id: z.string(),
  meetingRecordId: z.string(),
  step: z.string(),
  status: z.string(),
  detail: z.string().nullish(),
  createdAt: z.date(),
});

export type ProcessingLogType = z.infer<typeof ProcessingLogSchema>;


// File: SampleLearning.schema.ts

export const SampleLearningSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  sampleDocTokens: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  generatedPrompt: z.string(),
  styleDescription: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SampleLearningType = z.infer<typeof SampleLearningSchema>;


// File: FeishuMeeting.schema.ts

export const FeishuMeetingSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  meetingNo: z.string().nullish(),
  topic: z.string().nullish(),
  startTime: z.date().nullish(),
  endTime: z.date().nullish(),
  hostUserId: z.string().nullish(),
  participantCount: z.number().int().nullish(),
  participantsJson: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]").nullish(),
  transcriptText: z.string().nullish(),
  transcriptFetched: z.boolean(),
  transcriptRetryAt: z.date().nullish(),
  transcriptRetryCount: z.number().int(),
  userTranscriptText: z.string().nullish(),
  docUrl: z.string().nullish(),
  source: MeetingSourceSchema.default("feishu"),
  noteDocToken: z.string().nullish(),
  meetingUrl: z.string().nullish(),
  uploadedFileName: z.string().nullish(),
  createdById: z.string().nullish(),
  isDeleted: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FeishuMeetingType = z.infer<typeof FeishuMeetingSchema>;


// File: Conversation.schema.ts

export const ConversationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().nullish(),
  summary: z.string().nullish(),
  topicTags: z.array(z.string()),
  messageCount: z.number().int(),
  totalTokens: z.number().int().nullish(),
  status: z.string().default("active"),
  metadata: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ConversationType = z.infer<typeof ConversationSchema>;


// File: ConversationMessage.schema.ts

export const ConversationMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.string(),
  content: z.string(),
  intentCategory: z.string().nullish(),
  intentConfidence: z.number().nullish(),
  referencedFields: z.array(z.string()),
  unknownFields: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  referencedMeetings: z.array(z.string()),
  toolsUsed: z.array(z.string()),
  tokenCount: z.number().int().nullish(),
  processedAt: z.date().nullish(),
  createdAt: z.date(),
});

export type ConversationMessageType = z.infer<typeof ConversationMessageSchema>;


// File: MemoryInsight.schema.ts

export const MemoryInsightSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  scope: z.string().default("personal"),
  title: z.string(),
  description: z.string().nullish(),
  confidence: z.number().nullish(),
  evidence: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  status: z.string().default("proposed"),
  metadata: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MemoryInsightType = z.infer<typeof MemoryInsightSchema>;


// File: DimensionProposal.schema.ts

export const DimensionProposalSchema = z.object({
  id: z.string(),
  fieldName: z.string(),
  displayName: z.string(),
  description: z.string().nullish(),
  suggestedType: z.string(),
  scope: z.string().default("personal"),
  userId: z.string().nullish(),
  exampleValues: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  evidenceCount: z.number().int(),
  uniqueUsers: z.number().int(),
  confidence: z.number().nullish(),
  status: z.string().default("pending_review"),
  implementedAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DimensionProposalType = z.infer<typeof DimensionProposalSchema>;


// File: WaitlistEntry.schema.ts

export const WaitlistEntrySchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.date(),
});

export type WaitlistEntryType = z.infer<typeof WaitlistEntrySchema>;

