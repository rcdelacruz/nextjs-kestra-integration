'use client';

import { useState } from 'react';
import WorkflowMonitor from '@/components/WorkflowMonitor';

export default function TestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionId, setExecutionId] = useState(null);
  const [formData, setFormData] = useState({
    message: 'Test message',
    iterations: 3
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'iterations' ? parseInt(value, 10) || 0 : value
    });
  };
  
  const triggerWorkflow = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: 'sample_processing_workflow',
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
        
        <form onSubmit={triggerWorkflow} className="space-y-4">
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
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Triggering...' : 'Trigger Workflow'}
          </button>
        </form>
        
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
            workflowId="sample_processing_workflow"
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