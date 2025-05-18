# Using KV Store for Secrets in Kestra

This guide explains how to use Kestra's Key-Value (KV) store to securely manage secrets like webhook keys in your workflows.

## Setting Up a KV Store Value

1. In the Kestra UI, navigate to the **Namespaces** section
2. Select your namespace (e.g., `demo`)
3. Click on the **Settings** tab
4. Under the "Secrets" section, add a new key-value pair:
   - Key: `WEBHOOK_KEY`
   - Value: A secure random string (e.g., `8a7b6c5d4e3f2g1h`)
5. Click **Save**

## Using KV Values in Workflows

In your workflow YAML, reference the KV store value using the `{{ kv('KEY') }}` syntax:

```yaml
triggers:
  - id: webhook
    type: io.kestra.plugin.core.trigger.Webhook
    key: "{{ kv('WEBHOOK_KEY') }}"
```

## Updating the Next.js Application

Your Next.js application will need the same webhook key to trigger the workflow. Update your `.env.local` file:

```
NEXT_PUBLIC_KESTRA_URL=https://kestra.coderstudio.co
KESTRA_NAMESPACE=demo
KESTRA_WEBHOOK_KEY=8a7b6c5d4e3f2g1h
```

Make sure to use the exact same value that you stored in the KV store.

## Benefits of Using KV Store

1. **Centralized Secret Management**: All secrets are stored in one place
2. **Namespace Scoping**: Secrets are scoped to a specific namespace
3. **No Hardcoded Secrets**: Your workflow definitions remain clean without embedded secrets
4. **Easier Updates**: You can update the secret in one place and all workflows using it will pick up the new value
5. **Access Control**: In Kestra Enterprise Edition, you can control who has access to view and edit secrets

## Additional KV Store Features

The KV store can be used for more than just webhook keys:

- Database credentials
- API tokens
- Connection strings
- Configuration values that might change across environments

You can also use the KV store programmatically within your tasks using the KV Store tasks: