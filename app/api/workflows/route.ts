import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Disable caching

export async function GET(request: NextRequest) {
  try {
    const kestraUrl = process.env.NEXT_PUBLIC_KESTRA_URL;
    const namespace = process.env.KESTRA_NAMESPACE;
    
    if (!kestraUrl || !namespace) {
      return NextResponse.json(
        { error: 'Kestra configuration missing. Check environment variables.' },
        { status: 500 }
      );
    }
    
    // Fetch available workflows from Kestra
    const response = await fetch(`${kestraUrl}/api/v1/flows/${namespace}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store' // Prevent caching
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch workflows: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const workflows = await response.json();
    
    // Filter and format workflow data for the frontend
    const formattedWorkflows = workflows.map((workflow: any) => ({
      id: workflow.id,
      namespace: workflow.namespace,
      description: workflow.description || '',
      lastModified: workflow.revision?.date || null,
      hasWebhookTrigger: !!(workflow.triggers && workflow.triggers.some((t: any) => t.type === 'io.kestra.plugin.core.trigger.Webhook')),
    }));
    
    // Return directly without nesting - maintains backward compatibility
    return NextResponse.json(formattedWorkflows, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
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