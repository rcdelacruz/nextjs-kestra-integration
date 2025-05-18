'use client';

import { useState, useEffect } from 'react';
import WorkflowMonitor from '@/components/WorkflowMonitor';

export default function TestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [executionId, setExecutionId] = useState(null);
  const [namespace, setNamespace] = useState('');
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [formData, setFormData] = useState({
    message: 'Test message',
    iterations: 3
  });
  
  // Fetch available namespaces and workflows on page load
  useEffect(() => {
    const fetchEnvData = async () => {
      try {
        // First get namespace from config
        const response = await fetch('/api/kestra-config', {
          cache: 'no-store'
        });
        
        if (response.ok) {
          const config = await response.json();
          if (config.namespace) {
            setNamespace(config.namespace);
          }
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };
    
    fetchEnvData();
  }, []);
  
  // Fetch workflows when namespace is known
  useEffect(() => {
    if (namespace) {
      fetchWorkflows();
    }
  }, [namespace]);
  
  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      
      const timestamp = new Date().getTime(); // Add timestamp to break cache
      const response = await fetch(`/api/workflows?_=${timestamp}`, {
        cache: 'no-store' // Ensure fresh data
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }
      
      const data = await response.json();
      // Handle the updated API response format
      const workflowsData = data.workflows || data;
      
      setWorkflows(workflowsData);
      
      // Select the first workflow by default if available
      if (workflowsData.length > 0) {
        setSelectedWorkflow(workflowsData[0].id);
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError('Failed to fetch workflows. Please check your Kestra configuration.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'iterations' ? parseInt(value, 10) || 0 : value
    });
  };
  
  const handleWorkflowChange = (e) => {
    setSelectedWorkflow(e.target.value);
  };
  
  const triggerWorkflow = async (e) => {
    e.preventDefault();
    
    if (!selectedWorkflow) {
      setError('Please select a workflow to trigger');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      console.log('Triggering workflow:', selectedWorkflow);
      console.log('With inputs:', formData);
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/trigger-workflow?_=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: selectedWorkflow,
          inputs: formData
        }),
        cache: 'no-store'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error response:', data);
        
        // Store debug info if available
        if (data.config || data.url) {
          setDebugInfo(data);
        }
        
        throw new Error(data.error || 'Failed to trigger workflow');
      }
      
      console.log('Workflow triggered:', data);
      // Clear any existing executionId first to reset the WorkflowMonitor state
      setExecutionId(null);
      // Use setTimeout to ensure the component re-mounts completely
      setTimeout(() => {
        setExecutionId(data.executionId);
      }, 100);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const testWebhookDirectly = async () => {
    if (!selectedWorkflow) {
      setError('Please select a workflow first');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch the webhook key and namespace from API
      const timestamp = new Date().getTime();
      const configResponse = await fetch(`/api/kestra-config?_=${timestamp}`, {
        cache: 'no-store'
      });
      const config = await configResponse.json();
      
      if (!config.namespace || !config.kestraUrl) {
        throw new Error('Missing configuration. Check your .env.local file.');
      }
      
      // Get the webhook key - in a real app this should be more secure
      const webhookKeyResponse = await fetch(`/api/webhook-key?_=${timestamp}`, {
        cache: 'no-store'
      });
      const webhookKeyData = await webhookKeyResponse.json();
      
      if (!webhookKeyData.key) {
        throw new Error('Webhook key not available. Check your .env.local file.');
      }
      
      // Construct the webhook URL
      const webhookUrl = `${config.kestraUrl}/api/v1/executions/webhook/${config.namespace}/${selectedWorkflow}/${webhookKeyData.key}`;
      
      // Show confirmation dialog with info
      const confirm = window.confirm(
        `This will make a direct call to Kestra bypassing the Next.js API:\n\n` +
        `URL: ${webhookUrl}\n\n` +
        `Are you sure you want to continue?`
      );
      
      if (!confirm) {
        setLoading(false);
        return;
      }
      
      // Call the webhook directly
      const response = await fetch(`${webhookUrl}?_=${timestamp}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Direct webhook call failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Direct webhook response:', data);
      
      // Clear executionId first to reset the WorkflowMonitor state
      setExecutionId(null);
      // Use setTimeout to ensure the component re-mounts completely
      setTimeout(() => {
        setExecutionId(data.id);
      }, 100);
      
      setDebugInfo({
        directCall: true,
        url: webhookUrl,
        response: {
          id: data.id,
          status: response.status
        }
      });
      
    } catch (err) {
      console.error('Error in direct webhook call:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const resetMonitor = () => {
    setExecutionId(null);
    setDebugInfo(null);
    setError(null);
  };
  
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Test Kestra Integration</h1>
      
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Trigger Workflow</h2>
          <button
            onClick={fetchWorkflows}
            className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 border border-blue-600 rounded"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Workflows'}
          </button>
        </div>
        
        {namespace ? (
          <p className="text-gray-600 mb-4">Using namespace: <strong>{namespace}</strong></p>
        ) : (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="text-yellow-700">
              Namespace not configured. Please check your .env.local file.
            </p>
          </div>
        )}
        
        {workflows.length === 0 && !loading ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="text-yellow-700">
              No workflows found in your namespace. Please create a workflow in Kestra first.
            </p>
          </div>
        ) : (
          <form onSubmit={triggerWorkflow} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Workflow
              </label>
              <select
                value={selectedWorkflow}
                onChange={handleWorkflowChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select a workflow</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.id} {workflow.hasWebhookTrigger ? '(webhook ready)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Workflows labeled "webhook ready" have a webhook trigger configured
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <input
                type="text"
                name="message"
                value={formData.message}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Iterations
              </label>
              <input
                type="number"
                name="iterations"
                min="1"
                max="10"
                value={formData.iterations}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher values will make the workflow run longer (1-10)
              </p>
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={loading || !selectedWorkflow}
                className="btn-primary flex-grow"
              >
                {loading ? 'Triggering...' : 'Trigger Workflow'}
              </button>
              
              <button
                type="button"
                onClick={testWebhookDirectly}
                disabled={loading || !selectedWorkflow}
                className="btn-secondary flex-grow"
              >
                Test Direct Webhook
              </button>
            </div>
          </form>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        {debugInfo && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded">
            <p className="font-medium">Debug Information:</p>
            <div className="mt-2 text-xs font-mono overflow-x-auto">
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Workflow Monitor</h2>
          {executionId && (
            <button
              onClick={resetMonitor}
              className="text-sm text-red-600 hover:text-red-800 px-3 py-1 border border-red-600 rounded"
            >
              Reset Monitor
            </button>
          )}
        </div>
        
        {executionId ? (
          <WorkflowMonitor
            key={executionId} /* Force re-mount on executionId change */
            workflowId={selectedWorkflow}
            executionId={executionId}
            onStart={() => {}}
          />
        ) : (
          <p className="text-gray-500 py-12 text-center">
            Trigger a workflow to see real-time monitoring here
          </p>
        )}
      </div>
    </div>
  );
}