import { formatDistanceToNow } from 'date-fns';

/**
 * Utility functions for working with the Kestra API
 */

/**
 * Formats a workflow state as a readable string
 */
export function formatWorkflowState(state) {
  if (!state) return 'Unknown';
  
  const stateMap = {
    'CREATED': 'Created',
    'RUNNING': 'Running',
    'SUCCESS': 'Success',
    'FAILED': 'Failed',
    'KILLED': 'Killed',
    'PAUSED': 'Paused',
    'RESTARTED': 'Restarted',
  };
  
  return stateMap[state] || state;
}

/**
 * Formats a date string as a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Formats a duration in milliseconds as a human-readable string
 */
export function formatDuration(milliseconds) {
  if (!milliseconds) return 'N/A';
  
  const seconds = Math.floor(milliseconds / 1000);
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}