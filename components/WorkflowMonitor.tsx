'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function WorkflowMonitor({ workflowId, executionId, onStart }) {
  const [status, setStatus] = useState('idle');
  const [executionData, setExecutionData] = useState(null);
  const [error, setError] = useState(null);
  const [eventSource, setEventSource] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // Close event source on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);
  
  // Monitor execution when executionId changes
  useEffect(() => {
    if (!executionId) {
      setStatus('idle');
      setExecutionData(null);
      setProgress(0);
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      return;
    }
    
    setStatus('running');
    
    // Connect to Server-Sent Events endpoint
    const sse = new EventSource(`/api/workflow-status?executionId=${executionId}`);
    setEventSource(sse);
    
    sse.onopen = () => {
      console.log('SSE connection established');
    };
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update execution data
        setExecutionData(data);
        
        // Update status based on execution state
        if (data.state) {
          setStatus(data.state.toLowerCase());
        }
        
        // Calculate progress based on tasks
        if (data.tasks && data.tasks.length > 0) {
          const totalTasks = data.tasks.length;
          const completedTasks = data.tasks.filter(task => 
            ['SUCCESS', 'FAILED', 'KILLED'].includes(task.state)
          ).length;
          
          const calculatedProgress = (completedTasks / totalTasks) * 100;
          setProgress(calculatedProgress);
        }
        
        // Close connection when execution is in terminal state
        if (['SUCCESS', 'FAILED', 'KILLED'].includes(data.state)) {
          sse.close();
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
        setError('Failed to parse execution data');
      }
    };
    
    sse.onerror = (err) => {
      console.error('SSE error:', err);
      setError('Connection to workflow status lost');
      sse.close();
    };
    
    return () => {
      sse.close();
    };
  }, [executionId]);
  
  const handleStartWorkflow = async () => {
    try {
      setError(null);
      await onStart(workflowId);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const renderStatusBadge = (state) => {
    const stateMap = {
      'running': { class: 'bg-yellow-100 text-yellow-800', label: 'Running' },
      'success': { class: 'bg-green-100 text-green-800', label: 'Success' },
      'failed': { class: 'bg-red-100 text-red-800', label: 'Failed' },
      'killed': { class: 'bg-gray-100 text-gray-800', label: 'Killed' },
      'idle': { class: 'bg-blue-100 text-blue-800', label: 'Idle' },
    };
    
    const stateInfo = stateMap[state.toLowerCase()] || stateMap.idle;
    
    return (
      <span className={`status-badge ${stateInfo.class}`}>
        {stateInfo.label}
      </span>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Workflow: {workflowId}</h2>
        <button
          className="btn-primary"
          onClick={handleStartWorkflow}
          disabled={status === 'running'}
        >
          Run Workflow
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
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
            </div>
            
            {executionData && (
              <span className="text-sm text-gray-500">
                Execution ID: {executionId}
              </span>
            )}
          </div>
          
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
          
          {executionData && (
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
                  {executionData.tasks && executionData.tasks.map((task) => {
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
                      <tr key={task.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {renderStatusBadge(task.state)}
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