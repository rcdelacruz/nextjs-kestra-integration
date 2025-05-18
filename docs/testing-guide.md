# How to Test the Kestra Integration

This guide provides step-by-step instructions for testing the integration between your Next.js application and Kestra.

## Prerequisites

Before testing, ensure you have:

1. Set up a Kestra instance (e.g., https://kestra.coderstudio.co/)
2. Created a namespace in Kestra (e.g., `demo`)
3. Set up the KV store with a `WEBHOOK_KEY` value
4. Imported the `sample_processing_workflow.yml` workflow into your Kestra instance
5. Configured your `.env.local` file with:
   ```
   NEXT_PUBLIC_KESTRA_URL=https://kestra.coderstudio.co
   KESTRA_NAMESPACE=demo
   KESTRA_WEBHOOK_KEY=your_webhook_key_value
   ```

## Testing Steps

1. **Start the Next.js development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the test page**:
   Open your browser and go to [http://localhost:3000/test](http://localhost:3000/test)

3. **Configure the test parameters**:
   - Set a message
   - Set the number of iterations (higher values will make the workflow run longer)

4. **Trigger the workflow**:
   Click the "Trigger Workflow" button

5. **Observe the real-time monitoring**:
   The workflow progress will be displayed below, with real-time updates on task status and overall progress

## Troubleshooting

If you encounter issues:

### Webhook Trigger Fails

1. **Check the WEBHOOK_KEY values**:
   - Ensure the value in your `.env.local` file matches the value in Kestra's KV store
   - Test the webhook directly with curl:
     ```bash
     curl -X POST \
       "https://kestra.coderstudio.co/api/v1/executions/webhook/demo/sample_processing_workflow/your_webhook_key" \
       -H "Content-Type: application/json" \
       -d '{"message": "Test via curl", "iterations": 3}'
     ```

2. **Check namespace permissions**:
   Ensure your user has the necessary permissions in the Kestra namespace

### SSE Connection Issues

1. **Check browser console**:
   Look for errors in the browser's developer tools console

2. **Check CORS settings**:
   If your Kestra instance has CORS restrictions, ensure your local domain is allowed

### No Real-time Updates

1. **Check that the Kestra API is accessible**:
   Make sure your Next.js app can reach the Kestra API endpoint

2. **Verify the execution ID**:
   Ensure the execution ID returned from the trigger API matches what you expect

## Testing with Different Workflows

To test with a different workflow:

1. Create a new workflow in Kestra with a webhook trigger
2. Modify the `workflowId` in the test page:
   ```jsx
   // In app/test/page.tsx
   const triggerWorkflow = async (e) => {
     // ...
     body: JSON.stringify({
       workflowId: 'your_workflow_id',  // Change this
       inputs: formData
     }),
     // ...
   };
   ```

## Expected Results

A successful test should:

1. Show a success message after triggering the workflow
2. Display the execution ID
3. Show real-time progress updates as tasks complete
4. Display final success status when the workflow completes

If you see all of these, congratulations! Your integration is working correctly.