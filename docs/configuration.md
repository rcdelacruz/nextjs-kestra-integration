# Setting Up Your Next.js and Kestra Integration

This documentation guides you through configuring and using your Next.js application with the Kestra orchestration platform at https://kestra.coderstudio.co/.

## Configuration Steps

1. Create a namespace in your Kestra instance where your workflows will live.

2. Import the example workflow from this repository:
   - Go to your Kestra UI
   - Navigate to "Flows"
   - Click "Create"
   - Copy the content from `example-workflows/sample_processing_workflow.yml`
   - Update the namespace to match your namespace
   - Generate a secure webhook key and replace `YOUR_WEBHOOK_KEY_HERE`
   - Save the workflow

3. Configure your Next.js application:
   - Copy `.env.local.example` to `.env.local`
   - Update the variables:
     ```
     NEXT_PUBLIC_KESTRA_URL=https://kestra.coderstudio.co
     KESTRA_NAMESPACE=your_namespace
     KESTRA_WEBHOOK_KEY=your_webhook_key
     ```

## Authentication (Optional)

If your Kestra instance requires authentication, you'll need to:

1. Create an API token in Kestra
2. Add these additional environment variables:
   ```
   KESTRA_API_TOKEN=your_api_token
   ```

3. Update the API calls in `lib/kestra-api.ts` and the API routes to include authorization headers.

## Advanced Usage

### Creating Custom Workflows

Create workflows in Kestra that include a webhook trigger. The webhook should be in this format:

```yaml
triggers:
  - id: webhook
    type: io.kestra.plugin.core.trigger.Webhook
    key: your_webhook_key
```

### Viewing Real-time Progress

The Server-Sent Events (SSE) implementation in this application allows you to view real-time progress of workflow executions. This is enabled by the `/api/workflow-status` endpoint that continuously polls the Kestra API and pushes updates to the client.

### Custom UI Components

You can extend the UI components in the `components` directory to add more functionality or customize the appearance to match your application's design system.