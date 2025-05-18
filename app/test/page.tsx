'use client';

import { useState, useEffect } from 'react';
import WorkflowMonitor from '@/components/WorkflowMonitor';

export default function TestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
        const response = await fetch('/api/kestra-config');
        
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
      
      const response = await fetch('/api/workflows');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }
      
      const data = await response.json();
      setWorkflows(data);
      
      // Select the first workflow by default if available
      if (data.length > 0) {
        setSelectedWorkflow(data[0].id);
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
      
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: selectedWorkflow,
          inputs: formData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger workflow');
      }
      
      const data = await response.json();
      console.log('Workflow triggered:', data);
      setExecutionId(data.executionId);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Test Kestra Integration</h1>
      
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Trigger Workflow</h2>
        
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
            <button
              onClick={fetchWorkflows}
              className="mt-2 text-blue-600 hover:text-blue-800"
            >
              Refresh workflows
            </button>
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
            
            <button
              type="submit"
              disabled={loading || !selectedWorkflow}
              className="btn-primary w-full"
            >
              {loading ? 'Triggering...' : 'Trigger Workflow'}
            </button>
          </form>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Workflow Monitor</h2>
        
        {executionId ? (
          <WorkflowMonitor
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