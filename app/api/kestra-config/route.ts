import { NextResponse } from 'next/server';

export async function GET() {
  // Return the namespace configuration from environment variables
  return NextResponse.json({
    namespace: process.env.KESTRA_NAMESPACE || '',
    kestraUrl: process.env.NEXT_PUBLIC_KESTRA_URL || 'https://kestra.coderstudio.co'
  });
}