# Imager

A modern web-based image editing application built with Next.js, React, and Tailwind CSS. Imager provides real-time artistic effects and filters for your images.

## Features

- **Modern UI**: Clean, intuitive interface with a left sidebar for controls and main canvas area
- **Image Upload**: Easily upload images to edit
- **Real-time Effects**: Apply various effects to your images including:
  - Brightness, contrast, and saturation adjustments
  - Duotone effects
  - Dithering and halftone processing
  - Blur, sharpen, and pixelate filters
  - Noise and texture generators
- **Export**: Download your edited images

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/imager.git
cd imager
```

2. Install dependencies:
```
npm install
# or
yarn install
```

3. Start the development server:
```
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Troubleshooting

### Images Not Displaying

If uploaded images aren't displaying in the editor:

1. Check your browser console for any errors
2. Try resizing your browser window which can trigger a redraw
3. Ensure the image is a valid format (JPG, PNG) and under 10MB

### Build Errors

If you encounter build errors:

1. Make sure you have the correct Node.js version installed
2. Clear Next.js cache with `npm run clean` or `rm -rf .next`
3. Reinstall dependencies with `npm install`

### Directory Structure Issues

If you see errors about missing directories or routing problems:

1. Ensure that both `/app` and `/src/app` directories exist
2. Check that all routes are properly set up
3. Make sure `next.config.js` has the experimental `appDir` option enabled

## Project Structure

```
imager/
├── app/               # Next.js App Router core (root routes)
├── src/
│   ├── app/           # Main application code 
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities and helper functions
│   └── styles/        # CSS styles
├── public/            # Static assets
└── ...                # Config files
```

## Technologies Used

- **Next.js**: React framework for production
- **React**: UI library
- **Konva.js**: Canvas manipulation
- **Tailwind CSS**: Utility-first CSS framework

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI styled with [Tailwind CSS](https://tailwindcss.com/)
- Canvas powered by [Konva.js](https://konvajs.org/)
