export function formatCountLabel(value: number, label: string): string {
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

export function formatReminderTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatStatusLabel(value: string): string {
  return value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
