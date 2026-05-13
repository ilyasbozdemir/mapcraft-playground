import { Feature, FeatureCollection } from 'geojson';

/**
 * A specialized loader for very large GeoJSON files that avoids loading the entire file into memory.
 * It reads the file in chunks and extracts features one by one.
 */
export async function* streamGeoJSONFeatures(file: File): AsyncGenerator<Feature, void, unknown> {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inFeaturesArray = false;
  let bracketCount = 0;
  let startIdx = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    if (!inFeaturesArray) {
      const featuresStart = buffer.indexOf('"features"');
      if (featuresStart !== -1) {
        const arrayStart = buffer.indexOf('[', featuresStart);
        if (arrayStart !== -1) {
          inFeaturesArray = true;
          buffer = buffer.slice(arrayStart + 1);
        }
      }
      continue;
    }

    // Very basic brace counting parser to extract individual features
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      if (char === '{') {
        if (bracketCount === 0) startIdx = i;
        bracketCount++;
      } else if (char === '}') {
        bracketCount--;
        if (bracketCount === 0 && startIdx !== -1) {
          const featureStr = buffer.slice(startIdx, i + 1);
          try {
            const feature = JSON.parse(featureStr);
            yield feature;
          } catch (e) {
            console.error('Failed to parse feature chunk', e);
          }
          buffer = buffer.slice(i + 1);
          i = -1; // Reset loop for new buffer
          startIdx = -1;
        }
      }
    }
    
    // To prevent the buffer from growing indefinitely if we are between features
    if (bracketCount === 0 && startIdx === -1 && buffer.length > 10000) {
      // Just keep a small tail in case a feature is starting
      buffer = buffer.slice(-100);
    }
  }
}

/**
 * Loads a large GeoJSON file in batches to keep the UI responsive.
 */
export async function loadLargeGeoJSON(
  file: File, 
  onBatch: (features: Feature[]) => void, 
  batchSize: number = 5000
): Promise<void> {
  let batch: Feature[] = [];
  
  for await (const feature of streamGeoJSONFeatures(file)) {
    batch.push(feature);
    if (batch.length >= batchSize) {
      onBatch([...batch]);
      batch = [];
      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  if (batch.length > 0) {
    onBatch(batch);
  }
}
