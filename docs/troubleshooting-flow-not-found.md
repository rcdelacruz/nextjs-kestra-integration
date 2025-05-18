# Troubleshooting "Flow not found" Error

If you're encountering the "Flow not found" error when trying to trigger a workflow, follow this guide to diagnose and fix the issue.

## Common Causes

The "Flow not found" error typically occurs for one of these reasons:

1. **The workflow doesn't have a webhook trigger**
2. **The webhook key is incorrect**
3. **The namespace doesn't match exactly**
4. **You don't have permission to access the flow**

## Diagnostic Steps

### 1. Verify the Workflow Has a Webhook Trigger

In your Kestra UI:

1. Navigate to the flow you're trying to trigger
2. Check the "Triggers" tab
3. Confirm there is a trigger of type `io.kestra.plugin.core.trigger.Webhook`
4. If not, edit your flow and add a webhook trigger:

```yaml
triggers:
  - id: webhook
    type: io.kestra.plugin.core.trigger.Webhook
    key: "{{ kv('WEBHOOK_KEY') }}"
```

### 2. Check Your Webhook Key

The webhook key in your environment variables must match the key in Kestra's KV store:

1. In Kestra UI, go to Namespaces → Your Namespace → Settings tab
2. Check for a KV entry with key `WEBHOOK_KEY`
3. Make sure this value matches your `KESTRA_WEBHOOK_KEY` in `.env.local`
4. If using a hardcoded key instead of KV store, ensure it matches exactly

### 3. Verify Your Namespace

1. In the Kestra UI, check the exact spelling and case of your namespace
2. Compare this to the `KESTRA_NAMESPACE` value in your `.env.local` file
3. They must match exactly, including case sensitivity

### 4. Test Direct Webhook Call

Our testing page includes a "Test Direct Webhook" button that bypasses the Next.js API and calls Kestra directly. This can help identify if the issue is with your Kestra configuration or the Next.js application.

1. Go to http://localhost:3000/test
2. Select your workflow
3. Click "Test Direct Webhook"
4. A confirmation dialog will show the exact URL being called
5. Check the response for any error details

### 5. Check Browser Console for Errors

1. Open your browser's developer tools (F12 or right-click → Inspect)
2. Go to the Console tab
3. Look for any error messages when triggering the workflow
4. Check the Network tab to see the actual HTTP requests and responses

## Fixing the Issue

### If the Workflow Doesn't Have a Webhook Trigger

1. Edit your workflow in Kestra
2. Add the webhook trigger section as shown above
3. Save the workflow

### If the Webhook Key Is Incorrect

1. Generate a new webhook key (any secure string)
2. In Kestra, update the KV store entry for `WEBHOOK_KEY`
3. Update your `.env.local` file with the same value for `KESTRA_WEBHOOK_KEY`
4. Restart your Next.js application

### If the Namespace Doesn't Match

1. Update your `.env.local` file with the correct namespace
2. Restart your Next.js application

### If It's a Permission Issue

1. Make sure you're logged in to Kestra with an account that has access to the namespace
2. Check the namespace permissions in Kestra's settings

## Making a Direct Call with curl

You can also test the webhook directly using curl:

```bash
curl -X POST \
  "https://kestra.coderstudio.co/api/v1/executions/webhook/YOUR_NAMESPACE/YOUR_WORKFLOW_ID/YOUR_WEBHOOK_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test via curl", "iterations": 3}'
```

Replace:
- `YOUR_NAMESPACE` with your Kestra namespace
- `YOUR_WORKFLOW_ID` with the ID of your workflow
- `YOUR_WEBHOOK_KEY` with your webhook key

If this works but the Next.js app doesn't, the issue is likely in your Next.js configuration.