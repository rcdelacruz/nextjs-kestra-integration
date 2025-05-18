# Next.js Kestra Integration

A fullstack Next.js application integrated with the Kestra workflow orchestration platform.

## Overview

This project demonstrates how to integrate a Next.js web application with Kestra for workflow orchestration and real-time monitoring using Server-Sent Events (SSE).

## Features

- Trigger Kestra workflows from the web UI
- Real-time monitoring of workflow progress
- View task status and execution details
- Detailed logs and error reporting
- Dashboard for tracking multiple workflows

## Getting Started

### Prerequisites

- Node.js 18+
- A Kestra instance (e.g., https://kestra.coderstudio.co/)
- Access to Kestra API

### Installation

1. Clone this repository:

```bash
git clone https://github.com/rcdelacruz/nextjs-kestra-integration.git
cd nextjs-kestra-integration
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your Kestra configuration:

```
NEXT_PUBLIC_KESTRA_URL=https://kestra.coderstudio.co
KESTRA_NAMESPACE=your_namespace
KESTRA_WEBHOOK_KEY=your_webhook_key
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000/test](http://localhost:3000/test) in your browser to use the testing interface.

## Setting Up Kestra

### Create a Workflow in Kestra

1. Log in to your Kestra instance
2. Navigate to the Flows section
3. Click "Create" to create a new flow
4. Set up a KV store entry for your webhook key:
   - Go to Namespaces
   - Select your namespace
   - Go to the Settings tab
   - Add a KV entry with key `WEBHOOK_KEY` and a secure value
5. Copy and paste the example workflow from `example-workflows/sample_processing_workflow.yml`
   - Make sure to update the namespace to match your own
6. Click Save

### Test the Integration

Once everything is set up:

1. Navigate to http://localhost:3000/test
2. The page will display all available workflows in your namespace
3. Select a workflow with a webhook trigger
4. Fill in the test inputs
5. Click "Trigger Workflow"
6. Monitor the real-time progress in the execution panel

## Project Structure

- `/app` - Next.js 13+ App Router files
- `/app/api` - API routes including SSE endpoints
- `/components` - Reusable React components
- `/lib` - Utility functions and API clients
- `/docs` - Documentation and guides
- `/example-workflows` - Example Kestra workflow definitions
- `/public` - Static assets

## Troubleshooting

If you encounter the "Flow not found" error:

1. Make sure your Kestra namespace is correctly set in `.env.local`
2. Verify that you've created the workflow in Kestra with the correct ID
3. Check that you have permissions to access the workflow

See the [Testing Guide](./docs/testing-guide.md) for more troubleshooting tips.

## Learn More

- [Kestra Documentation](https://kestra.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

## License

MIT