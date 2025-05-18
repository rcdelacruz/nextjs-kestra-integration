import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Disable caching

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
    // Get the Kestra URL from environment variable
    const kestraUrl = process.env.NEXT_PUBLIC_KESTRA_URL || 'https://kestra.coderstudio.co';
    
    // Proxy the request to Kestra API
    console.log(`Proxying request to Kestra API: ${kestraUrl}/api/v1/executions/${executionId}`);
    
    const response = await fetch(`${kestraUrl}/api/v1/executions/${executionId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      console.error(`Kestra API responded with status: ${response.status}`);
      return NextResponse.json(
        { error: `Failed to fetch execution status: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Return the data with caching headers
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching execution status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch execution status',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}