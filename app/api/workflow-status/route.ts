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
            // Ignore errors if controller is already closed
            console.log('Stream already closed');
          }
        }
      };

      // Store closeStream function for use in cancel
      closeStreamFn = closeStream;

      // Function to safely enqueue data
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
      
      // Function to check execution status
      const checkStatus = async () => {
        if (isStreamClosed) return;

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_KESTRA_URL}/api/v1/executions/${executionId}`, {
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch execution status');
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
          
          // Only send data if the stream is still open
          safeEnqueue(formattedData);
          
          // If the execution is in a terminal state, close the stream
          if (['SUCCESS', 'FAILED', 'KILLED'].includes(String(executionData.state))) {
            closeStream();
            return;
          }
          
          // Schedule next check only if stream is still open
          if (!isStreamClosed) {
            checkStatusTimeout = setTimeout(checkStatus, 1000);
          }
        } catch (error) {
          console.error('Error fetching execution status:', error);
          if (!isStreamClosed) {
            safeEnqueue({ error: 'Failed to fetch status' });
          }
          closeStream();
        }
      };
      
      // Start checking status
      checkStatus();
    },
    cancel() {
      // This will be called if the client disconnects
      console.log('Client disconnected, cleaning up stream');
      // Use the stored closeStream function to properly clean up
      if (closeStreamFn) {
        closeStreamFn();
      }
    }
  });
  
  // Return the stream as a response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}