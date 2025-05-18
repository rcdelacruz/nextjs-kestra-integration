'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  finalUpdate?: boolean;
  retrySuccess?: boolean;
  [key: string]: any;
}

interface StatusInfo {
  class: string;
  label: string;
}

interface MessageEvent {
  data: string;
  type: string;
  lastEventId: string;
}

type StreamState = 'connecting' | 'open' | 'closed' | 'error' | 'completed';

export default function WorkflowMonitor({ workflowId, executionId, onStart }: WorkflowMonitorProps) {
  const [status, setStatus] = useState<string>('idle');
  const [executionData, setExecutionData] = useState<ExecutionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<StreamState>('connecting');
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RETRY_DELAY = 1000;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to manually refresh status
  const refreshStatus = useCallback(async () => {
    if (!executionId) return;
    
    try {
      setError(null);
      
      // Directly fetch current execution status
      const response = await fetch(`${process.env.NEXT_PUBLIC_KESTRA_URL}/api/v1/executions/${executionId}`, {
        cache: 'no-store', // Prevent caching
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as ExecutionData;
      
      // Update state with fresh data
      setExecutionData(data);
      
      if (data.state) {
        const stateStr = String(data.state).toLowerCase();
        setStatus(stateStr);
        
        // If terminal state, update UI appropriately
        if (['success', 'failed', 'killed'].includes(stateStr)) {
          setStreamState('completed');
          setProgress(100);
        }
      }
      
      // Calculate task progress
      if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const totalTasks = data.tasks.length;
        const completedTasks = data.tasks.filter(task => 
          ['SUCCESS', 'FAILED', 'KILLED'].includes(String(task.state).toUpperCase())
        ).length;
        
        const calculatedProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        setProgress(calculatedProgress);
      }
      
      return data;
    } catch (err) {
      console.error('Error refreshing status:', err);
      if (err instanceof Error) {
        setError(`Failed to refresh: ${err.message}`);
      } else {
        setError('Failed to refresh: Unknown error');
      }
      return null;
    }
  }, [executionId]);

  // Setup polling as backup when SSE fails
  useEffect(() => {
    // Clear any existing poll interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // Only poll if execution is running and SSE has issues
    if (executionId && ['error', 'closed'].includes(streamState) && status !== 'idle' && 
        !['success', 'failed', 'killed'].includes(status)) {
      
      // Poll every 5 seconds as fallback
      pollIntervalRef.current = setInterval(refreshStatus, 5000);
    }
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [executionId, status, streamState, refreshStatus]);

  // Function to create and setup EventSource
  const setupEventSource = useCallback(() => {
    if (!executionId) return null;

    const sse = new EventSource(`/api/workflow-status?executionId=${executionId}`);
    
    sse.onopen = () => {
      console.log('SSE connection established');
      setError(null);
      setReconnectAttempt(0);
      setStreamState('open');
    };
    
    sse.onmessage = (event: MessageEvent) => {
      try {
        console.log('Received SSE data:', event.data);
        const data = JSON.parse(event.data) as ExecutionData;
        
        // If we receive a retry success message, clear errors
        if (data.retrySuccess) {
          setError(null);
        }
        
        // Update execution data
        setExecutionData(data);
        setParsingError(null);
        
        // Update status based on execution state
        if (data.state) {
          const stateStr = String(data.state).toLowerCase();
          setStatus(stateStr);
          
          // If we reach a terminal state, mark as completed
          if (['success', 'failed', 'killed'].includes(stateStr)) {
            setStreamState('completed');
            setProgress(100); // Force progress to 100% when complete
            
            // Clean up event source
            sse.close();
            setEventSource(null);
            
            // Clear polling if active
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            
            return;
          }
        }
        
        // If we get finalUpdate flag, force progress to 100%
        if (data.finalUpdate) {
          setProgress(100);
          return;
        }
        
        // Calculate progress based on tasks
        if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
          const totalTasks = data.tasks.length;
          const completedTasks = data.tasks.filter((task: ExecutionTask) => 
            ['SUCCESS', 'FAILED', 'KILLED'].includes(String(task.state).toUpperCase())
          ).length;
          
          const calculatedProgress = (completedTasks / totalTasks) * 100;
          setProgress(calculatedProgress);
        } else {
          // If no tasks are available, increment progress gradually
          setProgress(prev => Math.min(prev + 5, 90));
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err, event.data);
        if (err instanceof Error) {
          setParsingError(`Failed to parse execution data: ${err.message}`);
        } else {
          setParsingError('Failed to parse execution data: Unknown error');
        }
        setProgress(prev => Math.min(prev + 2, 90));
      }
    };
    
    sse.onerror = (err: Event) => {
      console.error('SSE error:', err);
      setStreamState('error');
      sse.close();
      setEventSource(null);
      
      // Only attempt reconnect if it wasn't a natural completion
      if (streamState !== 'completed' && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, reconnectAttempt);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempt + 1})`);
        
        setError(`Connection lost. Reconnecting in ${delay/1000} seconds...`);
        
        setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          const newSSE = setupEventSource();
          if (newSSE) setEventSource(newSSE);
        }, delay);
      } else if (streamState !== 'completed') {
        setError('Connection to workflow status lost. Using polling as fallback.');
        // Fallback to polling - will be activated by the useEffect
      }
    };
    
    return sse;
  }, [executionId, reconnectAttempt, streamState]);

  // Check status on tab visibility change
  useEffect(() => {
    if (!executionId) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When tab becomes visible again, refresh the status
        refreshStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executionId, refreshStatus]);

  // Setup EventSource when executionId changes
  useEffect(() => {
    if (!executionId) {
      setStatus('idle');
      setExecutionData(null);
      setProgress(0);
      setParsingError(null);
      setError(null);
      setReconnectAttempt(0);
      setStreamState('closed');
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      return;
    }
    
    setStatus('running');
    setStreamState('connecting');
    const sse = setupEventSource();
    if (sse) setEventSource(sse);
    
    return () => {
      if (sse) {
        setStreamState('closed');
        sse.close();
      }
    };
  }, [executionId, setupEventSource]);

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

  // Don't show connection lost error if workflow completed successfully
  const shouldShowError = error && streamState !== 'completed';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Workflow: {workflowId}</h2>
        <div className="flex space-x-2">
          {executionId && (
            <button
              className="btn-secondary text-sm"
              onClick={refreshStatus}
              disabled={status === 'idle'}
            >
              Refresh Status
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleStartWorkflow}
            disabled={status === 'running'}
          >
            Run Workflow
          </button>
        </div>
      </div>
      
      {shouldShowError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {parsingError && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">{parsingError}</p>
          <p className="text-sm mt-1">
            The workflow may still be running correctly. You can
            <button 
              onClick={viewInKestra} 
              className="ml-1 text-blue-600 hover:text-blue-800 underline"
            >
              view it directly in Kestra
            </button>.
          </p>
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
              {streamState === 'error' && (
                <span className="text-xs text-gray-500">(using polling fallback)</span>
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
          
          {executionData && !parsingError && executionData.tasks && Array.isArray(executionData.tasks) && (
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