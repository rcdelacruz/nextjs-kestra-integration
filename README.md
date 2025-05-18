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

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `/app` - Next.js 13+ App Router files
- `/app/api` - API routes including SSE endpoints
- `/components` - Reusable React components
- `/lib` - Utility functions and API clients
- `/public` - Static assets

## Usage

1. Navigate to the dashboard
2. Select a workflow to run
3. Provide any required inputs
4. Start the workflow and monitor progress in real-time

## License

MIT