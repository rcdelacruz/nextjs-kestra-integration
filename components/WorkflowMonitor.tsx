'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

interface WorkflowMonitorProps {
  workflowId: string;
  executionId: string | null;
  onStart: (workflowId: string) => Promise<void>;
}

interface ExecutionTask {
  id: string;
  state: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

interface ExecutionData {
  state: string;
  tasks?: ExecutionTask[];
  end?: string;
  [key: string]: any;
}

interface StatusInfo {
  class: string;
  label: string;
}

export default function WorkflowMonitor({ workflowId, executionId, onStart }: WorkflowMonitorProps) {
  const [status, setStatus] = useState<string>('idle');
  const [executionData, setExecutionData] = useState<ExecutionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Reference to store the polling interval
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Function to fetch the current status
  const fetchStatus = async () => {
    if (!executionId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching execution status for:', executionId);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_KESTRA_URL}/api/v1/executions/${executionId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Ensure we always get fresh data
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Fetched execution data:', data);
      
      // Update state with fetched data
      setExecutionData(data);
      
      // Update status
      if (data.state) {
        const stateStr = String(data.state).toLowerCase();
        setStatus(stateStr);
        
        // If execution completed, set progress to 100%
        if (['success', 'failed', 'killed'].includes(stateStr)) {
          setProgress(100);
          
          // Clear polling interval if execution is done
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }
      
      // Calculate progress based on tasks
      if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const totalTasks = data.tasks.length;
        const completedTasks = data.tasks.filter(task => 
          ['SUCCESS', 'FAILED', 'KILLED'].includes(String(task.state).toUpperCase())
        ).length;
        
        // Only update progress if we have a valid calculation
        if (totalTasks > 0) {
          const calculatedProgress = (completedTasks / totalTasks) * 100;
          setProgress(calculatedProgress);
        }
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching status:', err);
      if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError('An unknown error occurred');
      }
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  // Start polling when executionId changes
  useEffect(() => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Reset state when executionId changes
    if (!executionId) {
      setStatus('idle');
      setExecutionData(null);
      setProgress(0);
      setError(null);
      return;
    }
    
    // Initial status fetch
    setStatus('running');
    fetchStatus();
    
    // Set up polling every 2 seconds
    pollingIntervalRef.current = setInterval(fetchStatus, 2000);
    
    // Clean up interval on unmount or when executionId changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [executionId]);
  
  // Handle tab visibility changes
  useEffect(() => {
    if (!executionId) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh data when tab becomes visible again
        fetchStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executionId]);
  
  const handleStartWorkflow = async () => {
    try {
      setError(null);
      await onStart(workflowId);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };
  
  const renderStatusBadge = (state: string) => {
    const stateStr = String(state).toLowerCase();
    
    const stateMap: Record<string, StatusInfo> = {
      'running': { class: 'bg-yellow-100 text-yellow-800', label: 'Running' },
      'success': { class: 'bg-green-100 text-green-800', label: 'Success' },
      'failed': { class: 'bg-red-100 text-red-800', label: 'Failed' },
      'killed': { class: 'bg-gray-100 text-gray-800', label: 'Killed' },
      'idle': { class: 'bg-blue-100 text-blue-800', label: 'Idle' },
    };
    
    const stateInfo = stateMap[stateStr] || stateMap.idle;
    
    return (
      <span className={`status-badge ${stateInfo.class}`}>
        {stateInfo.label}
      </span>
    );
  };
  
  const viewInKestra = () => {
    if (!executionId) return;
    
    const kestraUrl = process.env.NEXT_PUBLIC_KESTRA_URL || 'https://kestra.coderstudio.co';
    window.open(`${kestraUrl}/ui/executions/${executionId}`, '_blank');
  };
  
  const handleRefresh = () => {
    fetchStatus();
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Workflow: {workflowId}</h2>
        <div className="flex space-x-2">
          {executionId && (
            <button
              className="btn-secondary text-sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleStartWorkflow}
            disabled={status === 'running' || loading}
          >
            Run Workflow
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {status === 'idle' ? (
        <div className="py-8 text-center text-gray-500">
          <p>Click "Run Workflow" to start execution</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <h3 className="font-medium">Status:</h3>
              {renderStatusBadge(status)}
              {loading && (
                <span className="text-xs text-gray-500">(updating...)</span>
              )}
            </div>
            
            {executionId && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  Execution ID: {executionId}
                </span>
                <button 
                  onClick={viewInKestra}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  View in Kestra
                </button>
              </div>
            )}
          </div>
          
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-right text-xs text-gray-500">
            {Math.round(progress)}% complete
          </div>
          
          {executionData && executionData.tasks && Array.isArray(executionData.tasks) && (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {executionData.tasks.map((task: ExecutionTask) => {
                    const taskId = task.id || 'Unknown';
                    const startTime = task.startDate ? new Date(task.startDate) : null;
                    const endTime = task.endDate ? new Date(task.endDate) : null;
                    let duration = 'N/A';
                    
                    if (startTime && endTime) {
                      const durationMs = endTime.getTime() - startTime.getTime();
                      duration = `${Math.floor(durationMs / 1000)}s`;
                    } else if (startTime) {
                      duration = 'Running...';
                    }
                    
                    return (
                      <tr key={taskId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{taskId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {task.state ? renderStatusBadge(task.state) : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{duration}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800">Workflow Completed Successfully</h3>
              {executionData?.end && (
                <p className="text-sm text-green-700">
                  Completed at: {format(new Date(executionData.end), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              )}
            </div>
          )}
          
          {status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-800">Workflow Failed</h3>
              {executionData?.end && (
                <p className="text-sm text-red-700">
                  Failed at: {format(new Date(executionData.end), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}