/**
 * Kestra API client for interacting with Kestra
 */

const BASE_URL = process.env.NEXT_PUBLIC_KESTRA_URL || 'https://kestra.coderstudio.co';
const NAMESPACE = process.env.KESTRA_NAMESPACE;

/**
 * Fetch workflows from Kestra
 */
export async function fetchWorkflows() {
  const response = await fetch(`${BASE_URL}/api/v1/flows/${NAMESPACE}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch workflows: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch a specific workflow by ID
 */
export async function fetchWorkflow(id) {
  const response = await fetch(`${BASE_URL}/api/v1/flows/${NAMESPACE}/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch executions for a specific workflow
 */
export async function fetchExecutions(workflowId, pageSize = 10) {
  const response = await fetch(`${BASE_URL}/api/v1/executions/search?namespace=${NAMESPACE}&flowId=${workflowId}&size=${pageSize}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch executions: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch a specific execution by ID
 */
export async function fetchExecution(executionId) {
  const response = await fetch(`${BASE_URL}/api/v1/executions/${executionId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch execution: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Trigger a workflow execution
 */
export async function triggerWorkflow(workflowId, inputs = {}) {
  const response = await fetch(`${BASE_URL}/api/v1/executions/${NAMESPACE}/${workflowId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inputs),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to trigger workflow: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Trigger a workflow via webhook
 */
export async function triggerWebhook(workflowId, webhookKey, data = {}) {
  const response = await fetch(`${BASE_URL}/api/v1/executions/webhook/${NAMESPACE}/${workflowId}/${webhookKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to trigger webhook: ${response.statusText}`);
  }
  
  return response.json();
}