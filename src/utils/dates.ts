export function getNextContactDate(
  relationshipLevel: number,
  frequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | null,
  missedInteractions: number
): Date {
  const today = new Date();

  // Base number of days until next contact
  let daysUntilNext = 7; // Default to weekly

  // Adjust based on frequency
  if (frequency === 'daily') daysUntilNext = 1;
  else if (frequency === 'weekly') daysUntilNext = 7;
  else if (frequency === 'fortnightly') daysUntilNext = 14;
  else if (frequency === 'monthly') daysUntilNext = 30;
  else if (frequency === 'quarterly') daysUntilNext = 90;

  // Adjust based on relationship level (closer relationships get more frequent contact)
  const levelMultiplier = 1 - (relationshipLevel - 1) * 0.1; // 1.0 to 0.6
  daysUntilNext = Math.round(daysUntilNext * levelMultiplier);

  // Reduce interval for missed interactions (more urgent follow-up)
  if (missedInteractions > 0) {
    const urgencyMultiplier = Math.max(0.3, 1 - missedInteractions * 0.2); // 0.8 to 0.3
    daysUntilNext = Math.max(1, Math.round(daysUntilNext * urgencyMultiplier));
  }

  // Set the next contact date
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);
  return nextDate;
}