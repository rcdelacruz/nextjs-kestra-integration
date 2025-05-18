import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const requestData = await request.json();
    
    // Extract inputs if provided
    const inputs = requestData.inputs || {};
    
    // Get webhook key from environment variables - will be compared with KV store value in Kestra
    const webhookKey = process.env.KESTRA_WEBHOOK_KEY;
    const namespace = process.env.KESTRA_NAMESPACE;
    const workflowId = requestData.workflowId;
    
    // Debug info
    console.log('Triggering workflow with params:', {
      namespace,
      workflowId,
      webhookKeyExists: !!webhookKey,
      inputsProvided: Object.keys(inputs)
    });
    
    if (!webhookKey || !namespace) {
      return NextResponse.json(
        { error: 'Kestra configuration missing. Check environment variables.' },
        { status: 500 }
      );
    }
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required in the request body' },
        { status: 400 }
      );
    }
    
    // Trigger the Kestra workflow via webhook
    // The webhook key in the URL should match the value in the KV store
    const kestraUrl = process.env.NEXT_PUBLIC_KESTRA_URL;
    const url = `${kestraUrl}/api/v1/executions/webhook/${namespace}/${workflowId}/${webhookKey}`;
    
    console.log('Making request to Kestra URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inputs),
    });
    
    if (!response.ok) {
      // Try to get the error message from the response
      let errorMessage;
      let errorBody;
      
      try {
        errorBody = await response.json();
        console.error('Error response from Kestra:', errorBody);
        errorMessage = errorBody.message || `Failed with status: ${response.status}`;
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
        errorMessage = `Failed with status: ${response.status}`;
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          status: response.status,
          url: url,
          // Include redacted versions of config to help debug
          config: {
            namespace: namespace,
            workflowId: workflowId,
            webhookKeyLength: webhookKey ? webhookKey.length : 0,
          }
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Return the execution ID and other data
    return NextResponse.json({
      executionId: data.id,
      namespace: data.namespace,
      flowId: data.flowId,
      status: data.state,
      message: 'Workflow triggered successfully',
    });
  } catch (error) {
    console.error('Error triggering workflow:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger workflow',
        details: error.message
      },
      { status: 500 }
    );
  }
}