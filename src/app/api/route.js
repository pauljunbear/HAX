import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      message: 'API is working',
      timestamp: new Date().toISOString(),
      status: 'ok',
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Handle different API endpoints based on the request
    if (body.action) {
      switch (body.action) {
        case 'health':
          return NextResponse.json({ status: 'healthy' });

        case 'process-image':
          // Image processing logic would go here
          return NextResponse.json({
            message: 'Image processing endpoint',
            received: body,
          });

        default:
          return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
      }
    }

    return NextResponse.json({
      message: 'POST received',
      body: body,
    });
  } catch (error) {
    console.error('API POST Error:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    return NextResponse.json({
      message: 'PUT received',
      body: body,
    });
  } catch (error) {
    console.error('API PUT Error:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
