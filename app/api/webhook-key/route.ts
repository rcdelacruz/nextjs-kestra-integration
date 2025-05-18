import { NextResponse } from 'next/server';

export async function GET() {
  // Return the webhook key from environment variables
  // Note: In a production application, this would typically be more secure
  return NextResponse.json({
    key: process.env.KESTRA_WEBHOOK_KEY || '',
  });
}