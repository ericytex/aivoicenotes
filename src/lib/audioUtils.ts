// Utility functions for creating valid audio files from chunks

/**
 * Converts a WebM blob (potentially incomplete) into a valid WAV file
 * by decoding and re-encoding using Web Audio API
 */
export async function convertToWAV(webmBlob: Blob): Promise<Blob> {
  try {
    // First, try to create an AudioContext from the blob
    const arrayBuffer = await webmBlob.arrayBuffer();
    
    // Decode the audio data
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    
    // Get the audio data
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // Create a WAV file from the audio buffer
    const wavBuffer = audioBufferToWav(audioBuffer);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('Error converting to WAV:', error);
    // Fallback: return original blob if conversion fails
    return webmBlob;
  }
}

/**
 * Converts an AudioBuffer to WAV format
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const length = buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * numChannels * bytesPerSample);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * bytesPerSample, true);
  // WAVE identifier
  writeString(8, 'WAVE');
  // Format chunk identifier
  writeString(12, 'fmt ');
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (PCM)
  view.setUint16(20, format, true);
  // Number of channels
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // Block align
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, bitDepth, true);
  // Data chunk identifier
  writeString(36, 'data');
  // Data chunk length
  view.setUint32(40, length * numChannels * bytesPerSample, true);
  
  // Convert audio data to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}

/**
 * Creates a valid audio file from MediaRecorder chunks by combining them properly
 * For WebM files, we MUST include chunks from the start (index 0) because
 * the first chunk contains initialization data needed for valid WebM files.
 */
export async function createValidAudioFromChunks(
  allChunks: Blob[], 
  mimeType: string,
  startIndex: number = 0
): Promise<Blob> {
  // WebM files require the initialization segment (usually in first chunk)
  // So we always include all chunks from the start for valid files
  // This means we'll send some duplicate audio, but it's necessary for valid format
  
  if (allChunks.length === 0) {
    throw new Error('No audio chunks available');
  }
  
  // Always include all chunks from start for valid WebM
  // The startIndex is used to track what we've already transcribed, but
  // we still need all chunks from 0 for a valid file structure
  const validChunks = allChunks;
  
  // Create blob with all chunks - this ensures valid WebM structure
  const validBlob = new Blob(validChunks, { type: mimeType });
  
  // Validate the blob can be decoded (basic check)
  try {
    // Try to create an audio element to validate
    const testUrl = URL.createObjectURL(validBlob);
    const testAudio = new Audio(testUrl);
    
    return new Promise((resolve, reject) => {
      testAudio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(testUrl);
        resolve(validBlob);
      });
      
      testAudio.addEventListener('error', (e) => {
        URL.revokeObjectURL(testUrl);
        console.warn('Audio validation failed, trying WAV conversion');
        // If validation fails, try converting to WAV
        convertToWAV(validBlob)
          .then(resolve)
          .catch(() => {
            // Last resort: return the blob anyway
            resolve(validBlob);
          });
      });
      
      // Timeout fallback
      setTimeout(() => {
        URL.revokeObjectURL(testUrl);
        resolve(validBlob);
      }, 1000);
    });
  } catch (error) {
    console.warn('Error validating audio, returning blob anyway:', error);
    return validBlob;
  }
}

