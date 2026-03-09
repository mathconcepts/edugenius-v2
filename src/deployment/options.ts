/**
 * Deployment Options — EduGenius v2.0
 *
 * Registry of all supported deployment configurations:
 * 1. Local      — Docker Compose on laptop / home server / Raspberry Pi
 * 2. Hybrid     — Local backend + Supabase DB + Cloudinary/S3 media
 * 3. PaaS       — Railway.app (zero ops)
 * 4. AWS        — ECS Fargate + RDS + S3
 * 5. GCP        — Cloud Run + Cloud SQL + GCS
 */

// ============================================================================
// Types
// ============================================================================

export type DeploymentTier = 'local' | 'hybrid' | 'paas' | 'aws' | 'gcp';

export interface DeploymentOption {
  id: string;
  name: string;
  description: string;
  tier: DeploymentTier;
  emoji: string;

  /** Audience this option is designed for */
  bestFor: string[];

  /** High-level pros */
  pros: string[];

  /** High-level cons */
  cons: string[];

  /** Estimated monthly cost range in USD */
  costRange: { min: number; max: number; currency: 'USD' };

  /** Technical difficulty 1-5 */
  difficulty: 1 | 2 | 3 | 4 | 5;

  /** Quick-start command */
  quickStart: string;
}

export interface ResourceRequirements {
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  networkMbps?: number;
}

export interface ServiceDependency {
  name: string;
  type: 'database' | 'cache' | 'storage' | 'cdn' | 'compute' | 'monitoring';
  provider: string;
  managed: boolean;          // cloud-managed vs self-managed
  optional: boolean;
}

export interface CostBreakdown {
  compute: number;           // $/month
  database: number;          // $/month
  storage: number;           // $/month
  bandwidth: number;         // $/month
  extras: number;            // $/month
  total: number;             // $/month
  notes: string;
}

export interface AgentCapability {
  agentId: string;
  canRun: boolean;
  limitedBy?: string;        // e.g. "No GPU for model inference"
  batchJobsEnabled: boolean;
  schedulingMethod: 'cron' | 'cloud-scheduler' | 'eventbridge' | 'none';
}

export interface DeploymentOptionConfig {
  option: DeploymentOption;

  /** Environment variables required for this deployment */
  requiredEnvVars: string[];

  /** Environment variables that are optional */
  optionalEnvVars: string[];

  /** Infrastructure services this deployment uses */
  services: ServiceDependency[];

  /** Resource requirements per component */
  resources: {
    backend: ResourceRequirements;
    frontend?: ResourceRequirements;
    database?: ResourceRequirements;
    cache?: ResourceRequirements;
  };

  /** Cost estimates at typical scale (100 daily active users) */
  costs: CostBreakdown;

  /** Which agents can run effectively in this deployment */
  agentCapabilities: AgentCapability[];

  /** Deployment script path relative to project root */
  deployScript: string;

  /** Environment template file path */
  envTemplate: string;

  /** Railway/GCP/AWS config file (if applicable) */
  platformConfig?: string;
}

// ============================================================================
// Registry
// ============================================================================

export const DEPLOYMENT_OPTIONS: Record<DeploymentTier, DeploymentOption> = {

  local: {
    id: 'local',
    name: 'Totally Local',
    description:
      'Run everything on your own hardware — laptop, home server, or Raspberry Pi. ' +
      'Docker Compose orchestrates Postgres, Redis, the Node backend, and an Nginx-served frontend. ' +
      'Zero cloud bills. Full data privacy. Ideal for development and self-hosting.',
    tier: 'local',
    emoji: '🖥️',
    bestFor: [
      'Local development',
      'Privacy-first deployments',
      'Home server / Raspberry Pi',
      'Zero-budget pilots',
    ],
    pros: [
      'No cloud bills',
      'Complete data privacy',
      'Single docker compose up command',
      'Works offline',
      'Fast iteration loop',
    ],
    cons: [
      'No HA / redundancy',
      'Tied to local hardware uptime',
      'Manual backup responsibility',
      'No CDN — slow for remote users',
    ],
    costRange: { min: 0, max: 5, currency: 'USD' },   // electricity only
    difficulty: 1,
    quickStart: 'docker compose up -d',
  },

  hybrid: {
    id: 'hybrid',
    name: 'Local + Cloud Hybrid',
    description:
      'Run the Node backend and agents locally while offloading the database to Supabase ' +
      'and media/assets to Cloudinary (or S3). You get cloud durability without cloud compute bills. ' +
      'Perfect for solo founders who want reliability without DevOps.',
    tier: 'hybrid',
    emoji: '🔀',
    bestFor: [
      'Solo founders on a budget',
      'Reliable DB without cloud compute',
      'Fast dev → staging workflow',
      'Teams with a beefy dev machine',
    ],
    pros: [
      'Cloud-grade DB durability (Supabase)',
      'No local Postgres maintenance',
      'Cloudinary CDN for media',
      'Backend stays on cheap hardware',
      'Easy .env switch between local and prod',
    ],
    cons: [
      'Backend still depends on local machine',
      'Latency to Supabase over internet',
      'Supabase free tier has row limits',
    ],
    costRange: { min: 0, max: 25, currency: 'USD' },
    difficulty: 2,
    quickStart: 'bash scripts/deploy-hybrid.sh',
  },

  paas: {
    id: 'paas',
    name: 'Cloud: PaaS (Railway)',
    description:
      'One command deploys the entire stack to Railway.app — backend, frontend, Postgres plugin, ' +
      'and Redis plugin. No Docker knowledge required. Automatic HTTPS, environment injection, ' +
      'and GitHub deploy hooks included. The easiest path to a live URL.',
    tier: 'paas',
    emoji: '🚂',
    bestFor: [
      'Founders who want zero DevOps',
      'Early-stage SaaS (< 1,000 users)',
      'MVP launches',
      'Teams without cloud expertise',
    ],
    pros: [
      'One command: railway up',
      'Managed Postgres + Redis',
      'Automatic HTTPS & custom domains',
      'GitHub CI/CD out of the box',
      'Usage-based billing — pay as you grow',
    ],
    cons: [
      'Less control than raw cloud',
      'Can get expensive at scale (> 10k users)',
      'Railway-specific config lock-in',
    ],
    costRange: { min: 5, max: 40, currency: 'USD' },
    difficulty: 2,
    quickStart: 'bash scripts/deploy-railway.sh',
  },

  aws: {
    id: 'aws',
    name: 'Cloud: AWS (ECS Fargate)',
    description:
      'Production-grade AWS deployment using ECS Fargate (serverless containers) + RDS Postgres + ' +
      'S3 for storage + CloudFront CDN. No EC2 management — Fargate handles scaling. ' +
      'Infra managed via AWS CDK for repeatability. Best for regulated or enterprise workloads.',
    tier: 'aws',
    emoji: '🟠',
    bestFor: [
      'Enterprise / regulated workloads',
      'Existing AWS infrastructure',
      'High-scale (> 10k concurrent users)',
      'Multi-region requirements',
    ],
    pros: [
      'Industry-standard infrastructure',
      'Auto-scaling with Fargate',
      'RDS managed backups + read replicas',
      'CloudFront global CDN',
      'AWS compliance certifications',
    ],
    cons: [
      'Steep learning curve',
      'Complex IAM setup',
      'Higher baseline cost vs GCP Cloud Run',
      'CDK/CloudFormation required',
    ],
    costRange: { min: 30, max: 80, currency: 'USD' },
    difficulty: 4,
    quickStart: 'bash scripts/deploy-aws.sh',
  },

  gcp: {
    id: 'gcp',
    name: 'Cloud: GCP (Cloud Run)',
    description:
      'Serverless deployment on GCP using Cloud Run (scales to zero) + Cloud SQL Postgres + ' +
      'Google Cloud Storage + Cloud CDN. Cheapest cloud option for low-traffic apps because ' +
      'you pay only when requests are served. Ideal for startups that want cloud-grade infra affordably.',
    tier: 'gcp',
    emoji: '🔵',
    bestFor: [
      'Startups watching cloud spend',
      'Variable / spiky traffic patterns',
      'Google Workspace integration',
      'AI/ML workloads (Vertex AI nearby)',
    ],
    pros: [
      'Scales to zero — no idle costs',
      'Cheapest cloud option for low traffic',
      'Google Cloud SQL managed backups',
      'Artifact Registry for container images',
      'Easy Vertex AI integration for future ML',
    ],
    cons: [
      'Cold start latency (< 1s typical)',
      'Cloud SQL min cost even at zero traffic',
      'GCP console learning curve',
    ],
    costRange: { min: 10, max: 40, currency: 'USD' },
    difficulty: 3,
    quickStart: 'bash scripts/deploy-gcp.sh',
  },
};

// ============================================================================
// Full Config Registry
// ============================================================================

export const DEPLOYMENT_CONFIGS: Record<DeploymentTier, DeploymentOptionConfig> = {

  local: {
    option: DEPLOYMENT_OPTIONS.local,
    requiredEnvVars: [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'GEMINI_API_KEY',
    ],
    optionalEnvVars: [
      'ANTHROPIC_API_KEY',
      'PORT',
      'LOG_LEVEL',
      'CORS_ORIGIN',
    ],
    services: [
      { name: 'Postgres 16', type: 'database', provider: 'docker', managed: false, optional: false },
      { name: 'Redis 7', type: 'cache', provider: 'docker', managed: false, optional: false },
      { name: 'Nginx', type: 'compute', provider: 'docker', managed: false, optional: true },
    ],
    resources: {
      backend:  { cpuCores: 1, memoryGb: 1, storageGb: 10 },
      database: { cpuCores: 1, memoryGb: 0.5, storageGb: 20 },
      cache:    { cpuCores: 0.25, memoryGb: 0.25, storageGb: 1 },
    },
    costs: {
      compute:  0,
      database: 0,
      storage:  0,
      bandwidth: 0,
      extras:   3,    // electricity estimate
      total:    3,
      notes:    'Electricity only. Hardware cost amortized separately.',
    },
    agentCapabilities: [
      { agentId: 'atlas',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'scout',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'oracle', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'herald', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'forge',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'sage',   canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
      { agentId: 'mentor', canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
    ],
    deployScript: 'scripts/deploy-local.sh',
    envTemplate:  'deploy/local.env.example',
  },

  hybrid: {
    option: DEPLOYMENT_OPTIONS.hybrid,
    requiredEnvVars: [
      'NODE_ENV',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'REDIS_URL',
      'GEMINI_API_KEY',
    ],
    optionalEnvVars: [
      'ANTHROPIC_API_KEY',
      'CLOUDINARY_URL',
      'AWS_S3_BUCKET',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'PORT',
      'LOG_LEVEL',
    ],
    services: [
      { name: 'Supabase',    type: 'database', provider: 'supabase', managed: true, optional: false },
      { name: 'Redis 7',     type: 'cache',    provider: 'docker',   managed: false, optional: false },
      { name: 'Cloudinary',  type: 'storage',  provider: 'cloudinary', managed: true, optional: true },
      { name: 'AWS S3',      type: 'storage',  provider: 'aws',      managed: true, optional: true },
    ],
    resources: {
      backend: { cpuCores: 1, memoryGb: 1, storageGb: 5 },
      cache:   { cpuCores: 0.25, memoryGb: 0.25, storageGb: 1 },
    },
    costs: {
      compute:  0,
      database: 0,     // Supabase free tier
      storage:  5,     // Cloudinary free / S3 minimal
      bandwidth: 2,
      extras:   5,
      total:    12,
      notes:    'Supabase free tier (500MB). Cloudinary free (25 credits/month). Backend on local hardware.',
    },
    agentCapabilities: [
      { agentId: 'atlas',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'scout',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'oracle', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'herald', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'forge',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'sage',   canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
      { agentId: 'mentor', canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
    ],
    deployScript: 'scripts/deploy-hybrid.sh',
    envTemplate:  'deploy/hybrid.env.example',
  },

  paas: {
    option: DEPLOYMENT_OPTIONS.paas,
    requiredEnvVars: [
      'NODE_ENV',
      'DATABASE_URL',       // auto-injected by Railway Postgres plugin
      'REDIS_URL',          // auto-injected by Railway Redis plugin
      'GEMINI_API_KEY',
    ],
    optionalEnvVars: [
      'ANTHROPIC_API_KEY',
      'PORT',               // Railway injects $PORT automatically
      'RAILWAY_STATIC_URL',
      'LOG_LEVEL',
    ],
    services: [
      { name: 'Railway Postgres', type: 'database', provider: 'railway', managed: true, optional: false },
      { name: 'Railway Redis',    type: 'cache',    provider: 'railway', managed: true, optional: false },
      { name: 'Railway CDN',      type: 'cdn',      provider: 'railway', managed: true, optional: true },
    ],
    resources: {
      backend: { cpuCores: 1, memoryGb: 0.5, storageGb: 5 },
    },
    costs: {
      compute:  8,
      database: 10,
      storage:  2,
      bandwidth: 2,
      extras:   0,
      total:    22,
      notes:    'Railway Hobby plan ~$5/month base + usage. Postgres plugin ~$10/month. Scales with usage.',
    },
    agentCapabilities: [
      { agentId: 'atlas',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'scout',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'oracle', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'herald', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'forge',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cron' },
      { agentId: 'sage',   canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
      { agentId: 'mentor', canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
    ],
    deployScript: 'scripts/deploy-railway.sh',
    envTemplate:  'deploy/railway.env.example',
    platformConfig: 'railway.json',
  },

  aws: {
    option: DEPLOYMENT_OPTIONS.aws,
    requiredEnvVars: [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'GEMINI_API_KEY',
      'AWS_REGION',
      'AWS_ACCOUNT_ID',
      'ECR_REPOSITORY',
      'ECS_CLUSTER',
      'ECS_SERVICE',
    ],
    optionalEnvVars: [
      'ANTHROPIC_API_KEY',
      'AWS_S3_BUCKET',
      'CLOUDFRONT_DISTRIBUTION_ID',
      'RDS_INSTANCE_CLASS',
      'ECS_DESIRED_COUNT',
      'LOG_LEVEL',
    ],
    services: [
      { name: 'ECS Fargate',   type: 'compute',  provider: 'aws', managed: true, optional: false },
      { name: 'RDS Postgres',  type: 'database', provider: 'aws', managed: true, optional: false },
      { name: 'ElastiCache',   type: 'cache',    provider: 'aws', managed: true, optional: false },
      { name: 'S3',            type: 'storage',  provider: 'aws', managed: true, optional: false },
      { name: 'CloudFront',    type: 'cdn',      provider: 'aws', managed: true, optional: true },
      { name: 'CloudWatch',    type: 'monitoring', provider: 'aws', managed: true, optional: true },
    ],
    resources: {
      backend:  { cpuCores: 0.5, memoryGb: 1, storageGb: 20 },   // Fargate 0.5 vCPU / 1GB
      database: { cpuCores: 2, memoryGb: 8, storageGb: 100 },    // db.t3.medium
    },
    costs: {
      compute:  20,    // Fargate 0.5vCPU/1GB ~$0.025/hr ≈ $18/month
      database: 30,    // RDS db.t3.micro ~$25/month
      storage:  5,     // S3 + ECR
      bandwidth: 10,   // CloudFront
      extras:   5,     // CloudWatch, NAT
      total:    70,
      notes:    'RDS db.t3.micro minimum. Scale to db.t3.small ($50/mo) for > 100 concurrent users.',
    },
    agentCapabilities: [
      { agentId: 'atlas',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'eventbridge' },
      { agentId: 'scout',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'eventbridge' },
      { agentId: 'oracle', canRun: true, batchJobsEnabled: true, schedulingMethod: 'eventbridge' },
      { agentId: 'herald', canRun: true, batchJobsEnabled: true, schedulingMethod: 'eventbridge' },
      { agentId: 'forge',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'eventbridge' },
      { agentId: 'sage',   canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
      { agentId: 'mentor', canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
    ],
    deployScript: 'scripts/deploy-aws.sh',
    envTemplate:  'deploy/aws.env.example',
  },

  gcp: {
    option: DEPLOYMENT_OPTIONS.gcp,
    requiredEnvVars: [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'GEMINI_API_KEY',
      'GCP_PROJECT_ID',
      'GCP_REGION',
      'GCP_SERVICE_NAME',
      'ARTIFACT_REGISTRY_REPO',
    ],
    optionalEnvVars: [
      'ANTHROPIC_API_KEY',
      'GCS_BUCKET',
      'CLOUD_SQL_INSTANCE',
      'CLOUD_RUN_MIN_INSTANCES',
      'CLOUD_RUN_MAX_INSTANCES',
      'LOG_LEVEL',
    ],
    services: [
      { name: 'Cloud Run',     type: 'compute',  provider: 'gcp', managed: true, optional: false },
      { name: 'Cloud SQL',     type: 'database', provider: 'gcp', managed: true, optional: false },
      { name: 'Memorystore',   type: 'cache',    provider: 'gcp', managed: true, optional: true },
      { name: 'Cloud Storage', type: 'storage',  provider: 'gcp', managed: true, optional: false },
      { name: 'Cloud CDN',     type: 'cdn',      provider: 'gcp', managed: true, optional: true },
      { name: 'Cloud Logging', type: 'monitoring', provider: 'gcp', managed: true, optional: true },
    ],
    resources: {
      backend:  { cpuCores: 1, memoryGb: 0.5, storageGb: 10 },   // Cloud Run 1vCPU/512MB
      database: { cpuCores: 1, memoryGb: 3.75, storageGb: 10 },  // db-f1-micro
    },
    costs: {
      compute:  5,     // Cloud Run pays-per-request, ~$5/month at low traffic
      database: 18,    // Cloud SQL db-f1-micro ~$10-20/month
      storage:  3,     // GCS standard
      bandwidth: 5,    // Cloud CDN egress
      extras:   2,     // Cloud Scheduler, Logging
      total:    33,
      notes:    'Cloud Run scales to zero — ideal for MVP. Cloud SQL db-f1-micro for dev/low-traffic.',
    },
    agentCapabilities: [
      { agentId: 'atlas',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cloud-scheduler' },
      { agentId: 'scout',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cloud-scheduler' },
      { agentId: 'oracle', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cloud-scheduler' },
      { agentId: 'herald', canRun: true, batchJobsEnabled: true, schedulingMethod: 'cloud-scheduler' },
      { agentId: 'forge',  canRun: true, batchJobsEnabled: true, schedulingMethod: 'cloud-scheduler' },
      { agentId: 'sage',   canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
      { agentId: 'mentor', canRun: true, batchJobsEnabled: false, schedulingMethod: 'none' },
    ],
    deployScript: 'scripts/deploy-gcp.sh',
    envTemplate:  'deploy/gcp.env.example',
  },
};

// ============================================================================
// Helpers
// ============================================================================

/** Get deployment config by tier */
export function getDeploymentConfig(tier: DeploymentTier): DeploymentOptionConfig {
  return DEPLOYMENT_CONFIGS[tier];
}

/** Get all deployment options sorted by cost (ascending) */
export function getDeploymentOptionsSortedByCost(): DeploymentOption[] {
  return Object.values(DEPLOYMENT_OPTIONS).sort(
    (a, b) => a.costRange.min - b.costRange.min
  );
}

/** Detect the active deployment tier from environment */
export function detectActiveTier(): DeploymentTier {
  const env = process.env;

  if (env.GCP_PROJECT_ID)   return 'gcp';
  if (env.AWS_ACCOUNT_ID)   return 'aws';
  if (env.RAILWAY_STATIC_URL) return 'paas';
  if (env.SUPABASE_URL && !env.AWS_ACCOUNT_ID && !env.GCP_PROJECT_ID) return 'hybrid';
  return 'local';
}

/** Check whether all required env vars are present for a tier */
export function validateEnvForTier(tier: DeploymentTier): { valid: boolean; missing: string[] } {
  const config = DEPLOYMENT_CONFIGS[tier];
  const missing = config.requiredEnvVars.filter(v => !process.env[v]);
  return { valid: missing.length === 0, missing };
}

/** Cost comparison across all tiers */
export function getCostComparison(): Array<{ tier: DeploymentTier; min: number; max: number; label: string }> {
  return Object.entries(DEPLOYMENT_OPTIONS).map(([tier, option]) => ({
    tier: tier as DeploymentTier,
    min:  option.costRange.min,
    max:  option.costRange.max,
    label: `$${option.costRange.min}–$${option.costRange.max}/mo`,
  }));
}
