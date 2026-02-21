/**
 * ABTestCTA — A/B test infrastructure for blog CTA buttons
 *
 * Implements a 50/50 split for the primary blog CTA.
 * - Control:  "Try AI Tutor"
 * - Variant:  "Ask Sage — Get Your Answer in 30s"
 *
 * Assignment is deterministic per browser session (no flicker):
 *   - Stored in sessionStorage under `edugenius_ab_blog_cta`
 *   - First visit: random 50/50 assignment
 *   - Subsequent visits within session: same variant
 *
 * Tracking: deep-link source param encodes variant for Prism
 *   /chat?source=blog_cta_ab_control | blog_cta_ab_variant
 *
 * Usage:
 *   <ABTestCTA postSlug="jee-main-2026-complete-strategy" postTitle="..." examTag="JEE" />
 *   <ABTestCTA postSlug="..." variant="forced-variant" />   ← for previewing
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CTAVariant = 'control' | 'variant';

// ─── Variant assignment ────────────────────────────────────────────────────────

const AB_KEY = 'edugenius_ab_blog_cta';

function getVariant(forcedVariant?: CTAVariant): CTAVariant {
  if (forcedVariant) return forcedVariant;
  try {
    const stored = sessionStorage.getItem(AB_KEY);
    if (stored === 'control' || stored === 'variant') return stored;
    const assigned: CTAVariant = Math.random() < 0.5 ? 'control' : 'variant';
    sessionStorage.setItem(AB_KEY, assigned);
    return assigned;
  } catch {
    return 'control';
  }
}

// ─── CTA config per variant ────────────────────────────────────────────────────

interface CTAConfig {
  label:    string;
  sublabel: string;
  icon:     JSX.Element;
  source:   string;
}

const VARIANTS: Record<CTAVariant, CTAConfig> = {
  control: {
    label:    'Try AI Tutor',
    sublabel: 'Free — no signup needed',
    icon:     <Sparkles className="w-4 h-4" />,
    source:   'blog_cta_ab_control',
  },
  variant: {
    label:    'Ask Sage — Get Your Answer in 30s',
    sublabel: '1,240+ students already use Sage',
    icon:     <Zap className="w-4 h-4" />,
    source:   'blog_cta_ab_variant',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ABTestCTAProps {
  postSlug:  string;
  postTitle: string;
  examTag?:  string;
  /** Force a specific variant (useful for testing/preview) */
  variant?:  CTAVariant;
  className?: string;
  /** 'full' = wide button with subtitle | 'compact' = small inline */
  size?: 'full' | 'compact';
}

export function ABTestCTA({
  postSlug,
  postTitle,
  examTag = 'JEE',
  variant: forcedVariant,
  className = '',
  size = 'full',
}: ABTestCTAProps) {
  const navigate = useNavigate();

  // Stable variant for this session
  const variant = useMemo(() => getVariant(forcedVariant), [forcedVariant]);
  const config  = VARIANTS[variant];

  const handleClick = () => {
    const params = new URLSearchParams({
      source: config.source,
      slug:   postSlug,
      topic:  postTitle,
      exam:   examTag,
    });
    navigate(`/chat?${params.toString()}`);
  };

  if (size === 'compact') {
    return (
      <button
        onClick={handleClick}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-400
          text-white text-sm font-medium transition-all shadow-md shadow-primary-500/20
          ${className}
        `}
        data-ab-variant={variant}
      >
        {config.icon}
        {config.label}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`
        w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
        bg-gradient-to-r from-primary-600 to-primary-500
        hover:from-primary-500 hover:to-primary-400
        text-white font-semibold transition-all
        shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40
        ${className}
      `}
      data-ab-variant={variant}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="flex items-center gap-2 text-base">
          {config.icon}
          {config.label}
        </span>
        <span className="text-xs text-primary-200 font-normal">{config.sublabel}</span>
      </div>
    </button>
  );
}

// ─── Hook — exposes variant for parent analytics ──────────────────────────────

export function useABVariant(forcedVariant?: CTAVariant): CTAVariant {
  return useMemo(() => getVariant(forcedVariant), [forcedVariant]);
}

export default ABTestCTA;
