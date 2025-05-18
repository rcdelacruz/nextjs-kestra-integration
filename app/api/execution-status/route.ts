import { NextRequest, NextResponse } from 'next/server';

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
    return NextResponse.json(
      { error: 'Execution ID is required' },
      { status: 400 }
    );
  }

  try {
    const kestraUrl = process.env.NEXT_PUBLIC_KESTRA_URL;
    if (!kestraUrl) {
      throw new Error('NEXT_PUBLIC_KESTRA_URL is not configured');
    }

    const response = await fetch(`${kestraUrl}/api/v1/executions/${executionId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch execution status: ${response.statusText}`);
    }

    const executionData = await response.json() as KestraExecution;

    // Format the execution data consistently with the SSE endpoint
    const formattedData = {
      ...executionData,
      state: String(executionData.state || 'RUNNING'),
      tasks: executionData.tasks ? executionData.tasks.map((task: KestraTask) => ({
        ...task,
        state: String(task.state || 'RUNNING')
      })) : [],
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(formattedData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Error fetching execution status:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch execution status',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}