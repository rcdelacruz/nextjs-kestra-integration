'use client';

import { useState, useEffect } from 'react';
import WorkflowList from './WorkflowList';
import WorkflowMonitor from './WorkflowMonitor';

export default function WorkflowDashboard() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [executionId, setExecutionId] = useState(null);
  
  // Fetch available workflows
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/workflows');
        if (!response.ok) {
          throw new Error(`Failed to fetch workflows: ${response.statusText}`);
        }
        const data = await response.json();
        setWorkflows(data);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching workflows:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkflows();
  }, []);
  
  const handleWorkflowSelect = (workflowId) => {
    setActiveWorkflowId(workflowId);
    setExecutionId(null); // Reset execution when selecting a new workflow
  };
  
  const handleWorkflowStart = async (workflowId, inputs = {}) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId,
          inputs,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to start workflow: ${response.statusText}`);
      }
      
      const data = await response.json();
      setExecutionId(data.executionId);
      return data.executionId;
    } catch (err) {
      setError(err.message);
      console.error('Error starting workflow:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <div className="p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Available Workflows</h2>
          {loading && !workflows.length ? (
            <p className="text-gray-500">Loading workflows...</p>
          ) : error ? (
            <div className="text-red-500">
              <p>Error: {error}</p>
              <button 
                className="text-kestra-blue underline mt-2"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          ) : (
            <WorkflowList 
              workflows={workflows} 
              activeWorkflowId={activeWorkflowId}
              onSelect={handleWorkflowSelect}
            />
          )}
        </div>
      </div>
      
      <div className="md:col-span-2">
        <div className="p-4 bg-white rounded-lg shadow">
          {activeWorkflowId ? (
            <WorkflowMonitor 
              workflowId={activeWorkflowId}
              executionId={executionId}
              onStart={handleWorkflowStart}
            />
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium text-gray-500">
                Select a workflow from the list to get started
              </h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}