import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

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
  
  // Create a new ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'connected' })}\n\n`));
      
      // Function to check execution status
      const checkStatus = async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_KESTRA_URL}/api/v1/executions/${executionId}`, {
            headers: {
              'Content-Type': 'application/json',
              // Add any auth headers if needed
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch execution status');
          }
          
          const executionData = await response.json();
          
          // Send the execution data to the client
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(executionData)}\n\n`));
          
          // If the execution is in a terminal state, close the stream
          if (['SUCCESS', 'FAILED', 'KILLED'].includes(executionData.state)) {
            controller.close();
            return;
          }
          
          // Check again after a delay
          setTimeout(checkStatus, 1000);
        } catch (error) {
          console.error('Error fetching execution status:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Failed to fetch status' })}\n\n`));
          controller.close();
        }
      };
      
      // Start checking status
      checkStatus();
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