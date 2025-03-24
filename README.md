# Imager2 - Web-Based Image Editor

Imager2 is a powerful, browser-based image editing tool that allows users to apply creative effects and filters to their images in real-time. Built with React, Next.js, and modern web technologies, it provides a smooth and intuitive editing experience directly in the browser.

## Features

- **Easy Image Upload:** Drag & drop or select high-resolution images up to 10MB
- **Real-time Effects Preview:** Instantly see how effects look as you adjust parameters
- **Wide Range of Effects:**
  - Basic adjustments (brightness, contrast, saturation, hue)
  - Filters (grayscale, sepia, invert)
  - Color effects (duotone)
  - Blur & sharpen
  - Artistic effects (halftone, dithering, posterize)
  - Distortion effects (pixelate, noise)
- **Export Options:** Download your edited images in PNG or JPEG format with quality control
- **Responsive Design:** Works on desktop and mobile devices

## Tech Stack

- **Frontend:** React, Next.js, TypeScript
- **Styling:** Tailwind CSS
- **Image Processing:** 
  - Konva.js and React Konva for canvas manipulation
  - Custom pixel manipulation algorithms
- **Deployment:** Vercel

## Getting Started

### Live Demo

Visit [https://imager2.vercel.app](https://imager2.vercel.app) to use the application.

### Local Development

1. Clone the repository:
   ```
   git clone https://github.com/pauljunbear/imager2.git
   cd imager2
   ```

2. Install dependencies:
   ```
   npm install --legacy-peer-deps
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Upload an Image:** Click the "Upload Image" button or drag and drop a file
2. **Select an Effect:** Choose from the effects tabs and click on an effect to apply it
3. **Adjust Settings:** Use the sliders to customize the effect parameters
4. **Export:** Select your desired format and quality, then click "Export Image"

## Future Enhancements

- User-saved custom presets
- Layered effects
- Undo/redo functionality
- Social media sharing
- Advanced 3D effects

## License

ISC

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [React Konva](https://konvajs.org/docs/react/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vercel](https://vercel.com/)
