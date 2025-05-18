'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

interface WorkflowMonitorProps {
  workflowId: string;
  executionId: string | null;
  onStart: (workflowId: string) => Promise<void>;
}

interface ExecutionState {
  current: string;
  histories?: any[];
  endDate?: string;
  startDate?: string;
  duration?: string;
}

interface ExecutionTask {
  id: string;
  state: ExecutionState | string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

interface ExecutionData {
  id: string;
  namespace: string;
  flowId: string;
  state: ExecutionState | string;
  taskRunList?: ExecutionTask[];
  tasks?: ExecutionTask[];
  end?: string;
  [key: string]: any;
}

interface StatusInfo {
  class: string;
  label: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'retrying' | 'completed';
type ExecutionStatus = 'idle' | 'running' | 'success' | 'failed' | 'killed';

export default function WorkflowMonitor({ workflowId, executionId, onStart }: WorkflowMonitorProps) {
  const [status, setStatus] = useState<ExecutionStatus>(executionId ? 'running' : 'idle');
  const [executionData, setExecutionData] = useState<ExecutionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [shouldKeepProgress, setShouldKeepProgress] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [retryCount, setRetryCount] = useState<number>(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRY_ATTEMPTS = 5;
  const BASE_RETRY_DELAY = 1000;

  // Helper function to extract the current state string from state object
  const getCurrentState = (state: ExecutionState | string): string => {
    if (typeof state === 'string') {
      return state;
    }
    return state?.current || 'UNKNOWN';
  };

  // Helper function to calculate overall workflow progress
  const calculateProgress = (tasks: ExecutionTask[], execState: string) => {
    if (!tasks || tasks.length === 0) return 0;
    
    const stateStr = execState.toUpperCase();
    // Always return 100 for terminal states
    if (['SUCCESS', 'FAILED', 'KILLED'].includes(stateStr)) {
      return 100;
    }

    // Get the actual task states, handling both string and object formats
    const taskStates = tasks.map(task => getCurrentState(task.state).toUpperCase());
    
    // Count tasks in various states
    const completedCount = taskStates.filter(state => 
      ['SUCCESS', 'FAILED', 'KILLED'].includes(state)
    ).length;
    
    const runningCount = taskStates.filter(state => state === 'RUNNING').length;
    const pendingCount = taskStates.filter(state => ['CREATED', 'PENDING', 'RESTARTED'].includes(state)).length;
    
    // Weighted progress calculation:
    // - Completed tasks = 1
    // - Running tasks = 0.5
    // - Pending tasks = 0.1 (to show some progress even for queued tasks)
    const totalWeight = tasks.length;
    const currentWeight = completedCount + (runningCount * 0.5) + (pendingCount * 0.1);
    
    // Calculate percentage, capping at 99% while workflow is running
    const calculatedProgress = (currentWeight / totalWeight) * 100;
    return stateStr === 'RUNNING' ? Math.min(calculatedProgress, 99) : calculatedProgress;
  };

  // Helper function to determine the workflow status based on tasks and state
  const determineWorkflowStatus = (
    workflowState: string,
    tasks: ExecutionTask[],
    currentStatus: ExecutionStatus
  ): ExecutionStatus => {
    const state = workflowState.toUpperCase();
    
    // Terminal states take precedence
    if (['SUCCESS', 'FAILED', 'KILLED'].includes(state)) {
      setShouldKeepProgress(true); // Keep progress at 100% for terminal states
      return state.toLowerCase() as ExecutionStatus;
    }

    // Check task states first
    if (tasks.length > 0) {
      const taskStates = tasks.map(task => getCurrentState(task.state).toUpperCase());
      
      // If any task is running/pending, workflow is running
      const hasActiveTask = taskStates.some(state => 
        ['RUNNING', 'CREATED', 'RESTARTED', 'PENDING'].includes(state)
      );
      if (hasActiveTask) {
        setShouldKeepProgress(false); // Allow progress updates while running
        return 'running';
      }

      // If all tasks are done, check their status
      const allTasksCompleted = taskStates.every(state =>
        ['SUCCESS', 'FAILED', 'KILLED'].includes(state)
      );
      
      if (allTasksCompleted) {
        setShouldKeepProgress(true); // Keep progress at 100% for completed tasks
        const hasFailedTask = taskStates.some(state => ['FAILED', 'KILLED'].includes(state));
        const allTasksSuccessful = taskStates.every(state => state === 'SUCCESS');
        
        if (allTasksSuccessful) return 'success';
        if (hasFailedTask) return 'failed';
      }
      
      // If tasks exist but not all completed, we're running
      setShouldKeepProgress(false);
      return 'running';
    }      // If workflow state indicates activity, we're running
    if (['RUNNING', 'CREATED', 'RESTARTED', 'PENDING'].includes(state)) {
      return 'running';
    }

    // Keep running state if we're already running and we have an executionId
    if (currentStatus === 'running' && executionId) {
      return 'running';
    }

    // Only go to idle if we have no tasks and no active state
    return 'idle';
  };  // Helper to update all states together for consistency
  const updateStates = (
    newStatus: ExecutionStatus,
    newProgress: number,
    newConnectionState: ConnectionState
  ) => {
    // Don't allow transition to idle state if we have an executionId
    // unless it's the initial state and we have no data yet
    if (newStatus === 'idle' && executionId && executionData) {
      // Keep current status and progress if we have them
      if (status !== 'idle' && progress > 0) {
        setConnectionState(newConnectionState);
        return;
      }
    }
    
    // Handle progress based on status and connection state
    let finalProgress = newProgress;
    if (['success', 'failed', 'killed'].includes(newStatus)) {
      // Always set to 100% for terminal states
      finalProgress = 100;
    } else if (connectionState === 'completed' && ['success', 'failed', 'killed'].includes(status)) {
      // Keep existing progress for completed workflows
      finalProgress = progress;
    }
    
    setStatus(newStatus);
    setProgress(finalProgress);
    setConnectionState(newConnectionState);
  };
  
  // Function to handle connection cleanup
  const cleanupConnection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    // Only reset progress if we're not in a terminal state
    if (!['success', 'failed', 'killed'].includes(status)) {
      setProgress(0);
    }
  };

  const connectToEventSource = () => {
    if (!executionId) return;

    // Don't reconnect if we're in a terminal state
    const isTerminalState = ['success', 'failed', 'killed'].includes(status);
    if (isTerminalState) {
      updateStates(status, 100, 'completed');
      return;
    }

    // Clean up any existing connection
    cleanupConnection();

    // Use regular fetch first to establish connection and validate status
    fetch(`/api/workflow-status?executionId=${executionId}`, {
      headers: { accept: 'text/event-stream' }
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setConnectionState('connecting');
      const sse = new EventSource(`/api/workflow-status?executionId=${executionId}`, {
        withCredentials: true
      });
      eventSourceRef.current = sse;

      sse.onopen = () => {
        console.log('SSE connection established');
        setError(null);
        setRetryCount(0);
        setConnectionState('connected');
      };

      sse.onmessage = (event) => {
        try {
          // Ignore empty messages
          if (!event.data || event.data.trim() === '') {
            return;
          }

          console.log('Received SSE data:', event.data);
          const data = JSON.parse(event.data) as ExecutionData;
          
          // Always update execution data first to ensure UI has latest data
          setExecutionData(data);
          setError(null);
          
          // Extract tasks and state
          const tasks = data.taskRunList || data.tasks || [];
          const workflowState = getCurrentState(data.state);
          const currentWorkflowState = workflowState.toUpperCase();
          
          console.log('Current workflow state:', currentWorkflowState);
          
          // Special handling for stream_ended or NONE state
          if (data.status === 'stream_ended' || currentWorkflowState === 'NONE') {
            // If we're already in a terminal state, just complete the connection
            if (['success', 'failed', 'killed'].includes(status)) {
              setConnectionState('completed');
              cleanupConnection();
              return;
            }

            // Determine final status based on tasks
            const taskStates = tasks.map(task => getCurrentState(task.state).toUpperCase());
            const hasRunningTasks = taskStates.some(state => 
              ['RUNNING', 'CREATED', 'RESTARTED', 'PENDING'].includes(state)
            );
            const allTasksSuccessful = taskStates.every(state => state === 'SUCCESS');
            const hasFailedTasks = taskStates.some(state => 
              ['FAILED', 'KILLED'].includes(state)
            );

            if (!hasRunningTasks) {
              if (allTasksSuccessful) {
                updateStates('success', 100, 'completed');
              } else if (hasFailedTasks) {
                updateStates('failed', 100, 'completed');
              } else {
                // Keep current state but mark as completed
                setConnectionState('completed');
              }
            }
            cleanupConnection();
            return;
          }

          // Skip status-only messages
          if (data.status === 'connected' && !data.state) {
            return;
          }

          // Determine new status and progress
          const newStatus = determineWorkflowStatus(workflowState, tasks, status);
          const calculatedProgress = calculateProgress(tasks, workflowState);
          
          console.log('Determined status:', newStatus);
          console.log('Calculated progress:', calculatedProgress);

          // Update states based on new information
          if (['success', 'failed', 'killed'].includes(newStatus)) {
            updateStates(newStatus, 100, 'completed');
            cleanupConnection();
          } else if (newStatus === 'running' || (tasks.length > 0 && currentWorkflowState !== 'IDLE')) {
            updateStates(newStatus, calculatedProgress, 'connected');
          } else {
            updateStates(newStatus, calculatedProgress, connectionState);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
          handleSSEError(err);
        }
      };

      sse.onerror = (err) => {
        console.error('SSE error:', err);
        handleSSEError(err);
      };
    }).catch(err => {
      console.error('Error connecting to SSE:', err);
      handleSSEError(err);
    });
  };

  // Centralized error handling for SSE
  const handleSSEError = (err: any) => {
    console.error('SSE connection error:', err);
    cleanupConnection();

    // If we're in idle or a terminal state, just close the connection
    if (status === 'idle' || ['success', 'failed', 'killed'].includes(status)) {
      updateStates(status, status === 'idle' ? 0 : 100, 'completed');
      return;
    }

    // Don't retry if we're in completed state
    if (connectionState === 'completed') return;

    // Special handling for HTTP/2 protocol errors
    const isHttp2Error = err?.message?.includes('ERR_HTTP2_PROTOCOL_ERROR') || 
                        err?.target?.readyState === EventSource.CLOSED;

    if (isHttp2Error && retryCount === 0) {
      // For HTTP/2 errors, try an immediate retry with a fresh connection
      console.log('HTTP/2 protocol error detected, attempting immediate retry');
      setRetryCount(prev => prev + 1);
      setTimeout(() => connectToEventSource(), 100);
      return;
    }

    if (retryCount < MAX_RETRY_ATTEMPTS) {
      setConnectionState('retrying');
      // Use exponential backoff for subsequent retries
      const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount);
      setError(`Connection lost. Reconnecting in ${delay/1000} seconds... (Attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);

      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        connectToEventSource();
      }, delay);
    } else {
      setConnectionState('disconnected');
      checkWorkflowStatus();
    }
  };

  // Function to check workflow status after connection error
  const checkWorkflowStatus = async () => {
    try {
      const response = await fetch(`/api/execution-status?executionId=${executionId}`);
      const data = await response.json();
      
      if (data.state) {
        const stateStr = getCurrentState(data.state).toLowerCase() as ExecutionStatus;
        if (['success', 'failed', 'killed'].includes(stateStr)) {
          updateStates(stateStr as ExecutionStatus, 100, 'completed');
          setExecutionData(data);
          return;
        }
      }
      setError('Connection lost. Click "Try Again" to reconnect.');
    } catch (err) {
      setError('Connection lost. Click "Try Again" to reconnect.');
    }
  };

  // Start SSE connection when executionId changes
  useEffect(() => {
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Reset states when executionId changes
    if (!executionId) {
      updateStates('idle', 0, 'disconnected');
      setExecutionData(null);
      setError(null);
      setRetryCount(0);
      cleanupConnection();
      return;
    }
    
    // When we have an executionId, set initial state to running
    updateStates('running', 0, 'connecting');
    setExecutionData(null);
    setError(null);
    setRetryCount(0);
    connectToEventSource();

    // Cleanup function
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [executionId]);

  // Handle tab visibility changes
  useEffect(() => {
    if (!executionId) return;

    const handleVisibilityChange = () => {
      const isTerminalState = ['success', 'failed', 'killed'].includes(status);
      if (document.visibilityState === 'visible' && 
          !isTerminalState &&
          connectionState !== 'connected') {
        // Reconnect if we're not already connected or completed
        setRetryCount(0);
        connectToEventSource();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [executionId, connectionState, status]);

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    connectToEventSource();
  };
  
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
  
  const renderStatusBadge = (state: ExecutionState | string) => {
    const stateStr = getCurrentState(state).toLowerCase();
    
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
  
  // Add manual refresh handler that respects terminal states
  const handleRefresh = () => {
    const isTerminalState = ['success', 'failed', 'killed'].includes(status);
    if (!isTerminalState) {
      setRetryCount(0);
      connectToEventSource();
    }
  };
  
  // Get end date from either executionData.end or from state.endDate
  const getEndDate = () => {
    if (executionData?.end) {
      return executionData.end;
    }
    
    if (typeof executionData?.state === 'object' && executionData?.state?.endDate) {
      return executionData.state.endDate;
    }
    
    return null;
  };
  
  // Extract tasks from either taskRunList or tasks
  const getTasks = () => {
    return executionData?.taskRunList || executionData?.tasks || [];
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Workflow: {workflowId}</h2>
        <div className="flex space-x-2">
          {executionId && (
            <button
              className="btn-secondary text-sm"
              onClick={() => connectToEventSource()}
              disabled={connectionState === 'retrying' || connectionState === 'connecting'}
            >
              {connectionState === 'connecting' ? 'Connecting...' : 'Refresh'}
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleStartWorkflow}
            disabled={status === 'running' || connectionState === 'connecting' || connectionState === 'retrying'}
          >
            Run Workflow
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
          {connectionState === 'disconnected' && (
            <button
              onClick={handleRetry}
              className="ml-4 underline hover:no-underline"
            >
              Try Again
            </button>
          )}
        </div>
      )}
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium">Status:</h3>
            {renderStatusBadge(executionData?.state || status)}
            {connectionState === 'connecting' && (
              <span className="text-xs text-gray-500">(connecting...)</span>
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
        
        {/* Show progress bar for running workflows */}
        {status === 'running' && (
          <>
            <div className="progress-bar">
              <div 
                className="progress-bar-fill bg-blue-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-500">
              {`${Math.round(progress)}% complete`}
            </div>
          </>
        )}

        {/* Show task table */}
        {executionData && getTasks().length > 0 && (
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
                {getTasks().map((task: ExecutionTask) => {
                  const taskId = task.id || 'Unknown';
                  
                  // Handle different format for dates
                  const startTime = task.startDate ? new Date(task.startDate) : 
                                   (typeof task.state === 'object' && task.state.startDate ? new Date(task.state.startDate) : null);
                  
                  const endTime = task.endDate ? new Date(task.endDate) : 
                                   (typeof task.state === 'object' && task.state.endDate ? new Date(task.state.endDate) : null);
                  
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
          
          {/* Show success message */}
          {status === 'success' && connectionState === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800">Workflow Completed Successfully</h3>
              {getEndDate() && (
                <p className="text-sm text-green-700">
                  Completed at: {format(new Date(getEndDate()!), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              )}
              <p className="text-sm text-green-700 mt-2">
                {executionData?.outputs?.message || 'All tasks completed successfully'}
              </p>
            </div>
          )}

          {/* Show failure message */}
          {status === 'failed' && connectionState === 'completed' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-800">Workflow Failed</h3>
              {getEndDate() && (
                <p className="text-sm text-red-700">
                  Failed at: {format(new Date(getEndDate()!), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              )}
              <p className="text-sm text-red-700 mt-2">
                {executionData?.outputs?.error || 'One or more tasks failed to complete'}
              </p>
            </div>
          )}

          {/* Show killed message */}
          {status === 'killed' && connectionState === 'completed' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800">Workflow Stopped</h3>
              {getEndDate() && (
                <p className="text-sm text-gray-700">
                  Stopped at: {format(new Date(getEndDate()!), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
  );
}