# /add-effect - Add New Image Effect

Scaffold a new image effect for imHAX.

## Instructions

When adding a new effect, follow these steps:

### 1. Choose Effect Details

Ask the user for:

- Effect name (e.g., "chromatic aberration")
- Category: Adjust, Blur, Color, Distort, Stylize, Sharpen, Effects, Math
- Settings/parameters needed

### 2. Add Effect Configuration

In `src/lib/effects.ts`, add to `effectsConfig`:

```typescript
effectsConfig['effectName'] = {
  label: 'Effect Label',
  category: 'CategoryName',
  settings: [
    {
      id: 'parameterName',
      label: 'Parameter Label',
      min: 0,
      max: 1,
      defaultValue: 0.5,
      step: 0.01,
    },
    // Add more settings as needed
  ],
};
```

### 3. Implement the Filter

Add the filter function:

```typescript
const effectNameFilter = function(this: any, imageData: KonvaImageData) {
  const { data, width, height } = imageData;

  // Get parameter values
  const param = this.effectNameParam?.() ?? 0.5;

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Alpha at data[i + 3]

    // Apply effect logic here
    data[i] = /* new red value */;
    data[i + 1] = /* new green value */;
    data[i + 2] = /* new blue value */;
  }
};

// Add factory that attaches the parameter
Konva.Factory.addGetterSetter(Konva.Node, 'effectNameParam', 0.5);
```

### 4. Register in Category

Add to `effectCategories`:

```typescript
effectCategories.CategoryName.effects.push('effectName');
```

### 5. Add to applyEffect Switch

In the `applyEffect` function, add case:

```typescript
case 'effectName':
  image.effectNameParam(settings.parameterName ?? 0.5);
  image.filters([effectNameFilter]);
  break;
```

### 6. Test the Effect

1. Run `npm run dev`
2. Upload an image
3. Find effect in browser
4. Adjust settings
5. Verify visual output

## Performance Tips

- Use `clampByte()` for fast 0-255 clamping
- Use buffer pooling for temporary arrays
- Consider Web Worker for heavy effects
- Cache computed values when possible

## Example: Simple Tint Effect

```typescript
effectsConfig['tint'] = {
  label: 'Tint',
  category: 'Color',
  settings: [
    { id: 'red', label: 'Red', min: 0, max: 255, defaultValue: 128, step: 1 },
    { id: 'green', label: 'Green', min: 0, max: 255, defaultValue: 128, step: 1 },
    { id: 'blue', label: 'Blue', min: 0, max: 255, defaultValue: 128, step: 1 },
    { id: 'amount', label: 'Amount', min: 0, max: 1, defaultValue: 0.5, step: 0.01 },
  ],
};
```
