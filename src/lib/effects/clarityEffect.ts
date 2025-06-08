import { Effect } from '../types'

export const clarityEffect: Effect = {
  name: 'Clarity',
  description: 'Enhances local contrast and detail while preserving overall image balance',
  category: 'Enhancement',
  parameters: {
    amount: {
      name: 'Amount',
      type: 'range',
      min: -100,
      max: 100,
      step: 1,
      default: 0,
    },
    radius: {
      name: 'Radius',
      type: 'range',
      min: 0.1,
      max: 5,
      step: 0.1,
      default: 1,
    },
    preserveHighlights: {
      name: 'Preserve Highlights',
      type: 'range',
      min: 0,
      max: 100,
      step: 1,
      default: 50,
    },
    preserveShadows: {
      name: 'Preserve Shadows',
      type: 'range',
      min: 0,
      max: 100,
      step: 1,
      default: 50,
    },
  },
  apply: async (imageData: ImageData, parameters: Record<string, number>) => {
    const { amount, radius, preserveHighlights, preserveShadows } = parameters
    
    // Convert amount to 0-1 range
    const normalizedAmount = amount / 100
    
    // Create a copy of the original image
    const original = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )
    
    // Apply local contrast enhancement
    const enhanced = await applyLocalContrast(imageData, radius, normalizedAmount)
    
    // Apply highlight and shadow preservation
    return preserveTonalRange(original, enhanced, preserveHighlights, preserveShadows)
  },
}

// Helper function to apply local contrast enhancement
async function applyLocalContrast(
  imageData: ImageData,
  radius: number,
  amount: number
): Promise<ImageData> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')
  
  // Create high-pass filter
  const highPass = await createHighPassFilter(imageData, radius)
  
  // Blend with original
  const result = new ImageData(imageData.width, imageData.height)
  const data = imageData.data
  const highPassData = highPass.data
  const resultData = result.data
  
  for (let i = 0; i < data.length; i += 4) {
    // Calculate local contrast
    const localContrast = highPassData[i] / 255
    
    // Apply enhancement
    const enhancement = localContrast * amount
    
    // Apply to each channel
    for (let j = 0; j < 3; j++) {
      const value = data[i + j] / 255
      const enhanced = value + (value - 0.5) * enhancement
      resultData[i + j] = Math.max(0, Math.min(255, enhanced * 255))
    }
    resultData[i + 3] = data[i + 3]
  }
  
  return result
}

// Helper function to create high-pass filter
async function createHighPassFilter(
  imageData: ImageData,
  radius: number
): Promise<ImageData> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')
  
  // Create blurred version
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(await createImageFromData(imageData), 0, 0)
  const blurred = ctx.getImageData(0, 0, imageData.width, imageData.height)
  
  // Create high-pass version
  const result = new ImageData(imageData.width, imageData.height)
  const data = imageData.data
  const blurredData = blurred.data
  const resultData = result.data
  
  for (let i = 0; i < data.length; i += 4) {
    // Calculate difference between original and blurred
    const diff = data[i] - blurredData[i]
    
    // Normalize to 0-255 range
    resultData[i] = Math.max(0, Math.min(255, diff + 128))
    resultData[i + 1] = resultData[i]
    resultData[i + 2] = resultData[i]
    resultData[i + 3] = data[i + 3]
  }
  
  return result
}

// Helper function to preserve tonal range
function preserveTonalRange(
  original: ImageData,
  enhanced: ImageData,
  preserveHighlights: number,
  preserveShadows: number
): ImageData {
  const result = new ImageData(original.width, original.height)
  const originalData = original.data
  const enhancedData = enhanced.data
  const resultData = result.data
  
  for (let i = 0; i < originalData.length; i += 4) {
    // Calculate luminance
    const luminance = (
      originalData[i] * 0.299 +
      originalData[i + 1] * 0.587 +
      originalData[i + 2] * 0.114
    ) / 255
    
    // Calculate highlight and shadow preservation factors
    const highlightFactor = Math.max(0, (luminance - 0.7) / 0.3) * (preserveHighlights / 100)
    const shadowFactor = Math.max(0, (0.3 - luminance) / 0.3) * (preserveShadows / 100)
    
    // Apply preservation
    for (let j = 0; j < 3; j++) {
      const originalValue = originalData[i + j]
      const enhancedValue = enhancedData[i + j]
      
      // Calculate preservation factor based on luminance
      const preservationFactor = Math.max(highlightFactor, shadowFactor)
      
      // Blend original and enhanced values
      resultData[i + j] = Math.round(
        originalValue * preservationFactor + enhancedValue * (1 - preservationFactor)
      )
    }
    resultData[i + 3] = originalData[i + 3]
  }
  
  return result
}

// Helper function to create Image from ImageData
async function createImageFromData(imageData: ImageData): Promise<HTMLImageElement> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')
  
  ctx.putImageData(imageData, 0, 0)
  const blob = await canvas.convertToBlob()
  const url = URL.createObjectURL(blob)
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = reject
    img.src = url
  })
} 