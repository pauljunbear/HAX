// API route for image utilities
export async function GET(request) {
  // Get the URL for parsing parameters
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // API info response
  const apiInfo = {
    message: 'Image processor API is working',
    version: '1.0.0',
    endpoints: {
      '/api': 'API information',
      '/api?action=info': 'System information',
      '/api?action=effects': 'List available effects',
    },
    status: 'online'
  };

  // Handle different actions
  if (action === 'info') {
    return new Response(JSON.stringify({
      system: process.env.NODE_ENV || 'unknown',
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'content-type': 'application/json' },
    });
  } else if (action === 'effects') {
    return new Response(JSON.stringify({
      categories: ['Basic', 'Color', 'Artistic', 'Distortion'],
      effects: [
        { id: 'brightness', category: 'Basic', label: 'Brightness' },
        { id: 'contrast', category: 'Basic', label: 'Contrast' },
        { id: 'saturation', category: 'Color', label: 'Saturation' },
        { id: 'hue', category: 'Color', label: 'Hue Rotation' },
        { id: 'duotone', category: 'Color', label: 'Duotone' },
        { id: 'threshold', category: 'Artistic', label: 'Threshold' },
        { id: 'posterize', category: 'Artistic', label: 'Posterize' },
        { id: 'blur', category: 'Distortion', label: 'Blur' },
        { id: 'sharpen', category: 'Distortion', label: 'Sharpen' },
        { id: 'pixelate', category: 'Distortion', label: 'Pixelate' },
        { id: 'noise', category: 'Distortion', label: 'Noise' },
      ]
    }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // Default response
  return new Response(JSON.stringify(apiInfo), {
    headers: { 'content-type': 'application/json' },
  });
} 