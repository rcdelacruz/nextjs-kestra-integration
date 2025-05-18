import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface KestraTask {
  id: string;
  state: string;
  [key: string]: any;
}

interface KestraExecution {
  id: string;
  state: string;
  tasks?: KestraTask[];
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const executionId = searchParams.get('executionId');
  
  if (!executionId) {
    return new Response(JSON.stringify({ error: 'Execution ID is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  // Create a text encoder for the stream
  const encoder = new TextEncoder();
  let isStreamClosed = false;
  let checkStatusTimeout: NodeJS.Timeout | null = null;
  let closeStreamFn: (() => void) | null = null;
  
  // Create a new ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      // Function to safely close the stream
      const closeStream = () => {
        if (!isStreamClosed) {
          isStreamClosed = true;
          if (checkStatusTimeout) {
            clearTimeout(checkStatusTimeout);
            checkStatusTimeout = null;
          }
          try {
            controller.close();
          } catch (error) {
            console.log('Stream already closed');
          }
        }
      };

      // Store closeStream function for use in cancel
      closeStreamFn = closeStream;

      // Function to safely enqueue data with error handling
      const safeEnqueue = (data: any) => {
        if (!isStreamClosed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (error) {
            console.error('Error enqueueing data:', error);
            closeStream();
          }
        }
      };
      
      // Send initial connection event
      safeEnqueue({ status: 'connected' });
      
      // Function to check execution status with retry logic
      const checkStatus = async (retryCount = 0) => {
        if (isStreamClosed) return;

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_KESTRA_URL}/api/v1/executions/${executionId}`, {
            headers: {
              'Content-Type': 'application/json',
            },
            cache: 'no-store'
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch execution status: ${response.statusText}`);
          }
          
          const executionData = await response.json() as KestraExecution;
          
          // Format the execution data for the client
          const formattedData = {
            ...executionData,
            state: String(executionData.state || 'RUNNING'),
            tasks: executionData.tasks ? executionData.tasks.map((task: KestraTask) => ({
              ...task,
              state: String(task.state || 'RUNNING')
            })) : []
          };
          
          // Send data to client
          safeEnqueue(formattedData);
          
          // Handle terminal states
          if (['SUCCESS', 'FAILED', 'KILLED'].includes(String(executionData.state))) {
            // Send final update with flag
            safeEnqueue({
              ...formattedData,
              finalUpdate: true
            });
            
            // Delay closing to ensure client receives the final message
            setTimeout(closeStream, 1000);
            return;
          }
          
          // Schedule next check if not in terminal state
          if (!isStreamClosed) {
            checkStatusTimeout = setTimeout(() => checkStatus(0), 1000);
          }
        } catch (error) {
          console.error('Error fetching execution status:', error);
          
          // Implement exponential backoff for retries
          const maxRetries = 3;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Cap at 5 seconds
          
          if (retryCount < maxRetries && !isStreamClosed) {
            console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
            safeEnqueue({ 
              status: 'retrying',
              retryCount: retryCount + 1,
              maxRetries,
              delay
            });
            
            checkStatusTimeout = setTimeout(() => checkStatus(retryCount + 1), delay);
          } else {
            console.error('Max retries reached or stream closed');
            safeEnqueue({ 
              error: 'Failed to fetch execution status after multiple attempts',
              status: 'error'
            });
            closeStream();
          }
        }
      };
      
      // Start checking status
      checkStatus();
    },
    
    cancel() {
      console.log('Client disconnected, cleaning up stream');
      if (closeStreamFn) {
        closeStreamFn();
      }
    }
  });
  
  // Return the stream as a response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}