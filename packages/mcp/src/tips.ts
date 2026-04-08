/**
 * Contextual tips shown after tool output.
 * Rotate so users see a fresh tip each time.
 * Tips are grouped by context — each tool picks the relevant group.
 */

const TIPS = {
  afterCounts: [
    '💡 Want this automatically? Run `/schedule daily "Check my signup numbers and flag anything unusual"`',
    '💡 Compare periods: ask "How do signups this week compare to last week?" for trend analysis',
    '💡 Go deeper: ask "Break down signups by country" to add group_by to any event count',
    '💡 Set up monitoring: `/loop 12h "Check error counts and alert if spiking"` catches issues while you sleep',
    '💡 Build a funnel: ask "How many users signed up vs completed onboarding vs made a purchase?"',
    '💡 Ask "What should I track?" and I\'ll read your codebase to propose a tracking plan',
  ],
  afterRetention: [
    '💡 Track this over time: `/schedule weekly "Run retention analysis and compare to last week"`',
    '💡 Dig deeper: ask "Show me the journey of a user who churned" to find where they dropped off',
    '💡 Improve retention: ask "What do retained users do differently in their first session?"',
    '💡 Set an alert: `/loop 24h "Check if week-1 retention dropped below 25% and warn me"`',
    '💡 Ask "Give me the top 5 insights" for a full health check including retention',
  ],
  afterJourney: [
    '💡 Compare users: ask "Show me a user who retained vs one who churned" to spot patterns',
    '💡 Find friction: ask "What was the last event before users who churned stopped?"',
    '💡 Ask "What events are being tracked?" to see all event types with get_top_events',
    '💡 Automate debugging: `/schedule daily "Check for users who hit errors and show their journey"`',
  ],
  afterTopEvents: [
    '💡 Go deeper on any event: ask "How many [event_name] this week?" for counts and trends',
    '💡 Missing events? Ask "What should I track?" and I\'ll analyze your codebase to suggest custom events',
    '💡 Get the full picture: ask "Give me the top 5 insights about my app"',
    '💡 Monitor continuously: `/loop 24h "Show me top events and flag any unusual changes"`',
  ],
  afterInsights: [
    '💡 Automate this: `/schedule daily "Run Infer analytics health check"` for daily insights',
    '💡 Set alerts: `/loop 6h "Check if error rate spiked or retention dropped, only notify if urgent"`',
    '💡 Dig into any finding: ask me to investigate a specific insight further',
    '💡 Share with your team: ask me to summarize these insights in a format you can post to Slack',
  ],
};

type TipCategory = keyof typeof TIPS;

// Track which tips have been shown (per session, resets on MCP server restart)
const shownTips = new Map<TipCategory, Set<number>>();

/**
 * Get a contextual tip for the given category.
 * Returns a different tip each time. Returns empty string when all tips exhausted.
 */
export function getTip(category: TipCategory): string {
  const tips = TIPS[category];
  if (!tips || tips.length === 0) return "";

  let shown = shownTips.get(category);
  if (!shown) {
    shown = new Set();
    shownTips.set(category, shown);
  }

  // Reset if all tips shown
  if (shown.size >= tips.length) {
    shown.clear();
  }

  // Find next unshown tip
  for (let i = 0; i < tips.length; i++) {
    if (!shown.has(i)) {
      shown.add(i);
      return `\n\n${tips[i]}`;
    }
  }

  return "";
}
