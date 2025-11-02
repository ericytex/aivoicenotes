// Transcription service supporting Google Gemini and Groq
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

export type TranscriptionProvider = 'gemini' | 'groq';

class TranscriptionService {
  async transcribeAudio(
    audioBlob: Blob, 
    provider: TranscriptionProvider = 'gemini',
    apiKey?: string
  ): Promise<string> {
    if (provider === 'groq') {
      return this.transcribeWithGroq(audioBlob, apiKey);
    } else {
      return this.transcribeWithGemini(audioBlob, apiKey);
    }
  }

  private async transcribeWithGemini(audioBlob: Blob, apiKey?: string): Promise<string> {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!key) {
      throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your environment variables.');
    }

    try {
      const ai = new GoogleGenAI({ apiKey: key });

      // Upload the audio file
      const myfile = await ai.files.upload({
        file: audioBlob,
        config: { 
          mimeType: audioBlob.type || 'audio/webm'
        },
      });

      // Transcribe using Gemini
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: createUserContent([
          createPartFromUri(myfile.uri, myfile.mimeType),
          "Transcribe this audio recording accurately. Return only the transcribed text without any additional commentary or formatting.",
        ]),
      });

      const transcribedText = response.text || '';
      
      // Clean up the uploaded file
      try {
        await ai.files.delete({ name: myfile.name });
      } catch (cleanupError) {
        console.warn('Failed to cleanup audio file:', cleanupError);
      }

      return transcribedText.trim();
    } catch (error) {
      console.error('Error transcribing audio with Gemini:', error);
      throw error instanceof Error ? error : new Error('Failed to transcribe audio');
    }
  }

  private async transcribeWithGroq(audioBlob: Blob, apiKey?: string): Promise<string> {
    const key = apiKey || import.meta.env.VITE_GROQ_API_KEY;
    
    if (!key) {
      throw new Error('Groq API key not configured. Please set VITE_GROQ_API_KEY in your environment variables.');
    }

    try {
      // Determine file extension based on blob type
      let filename = 'audio.webm';
      let mimeType = audioBlob.type || 'audio/webm';
      
      // Groq Whisper API accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm
      // If it's webm, make sure it has the right extension
      if (mimeType.includes('webm')) {
        filename = 'audio.webm';
      } else if (mimeType.includes('mp4')) {
        filename = 'audio.m4a';
        mimeType = 'audio/m4a';
      } else if (mimeType.includes('ogg')) {
        filename = 'audio.ogg';
        mimeType = 'audio/ogg';
      } else {
        // Default to webm
        filename = 'audio.webm';
        mimeType = 'audio/webm';
      }

      // Ensure blob has proper type
      const typedBlob = audioBlob.type ? audioBlob : new Blob([audioBlob], { type: mimeType });

      // Validate blob size (Groq has size limits)
      if (typedBlob.size === 0) {
        throw new Error('Audio blob is empty');
      }

      // Groq uses OpenAI-compatible Whisper API
      const formData = new FormData();
      // Create a File object instead of just a Blob with a name
      const audioFile = new File([typedBlob], filename, { type: mimeType });
      formData.append('file', audioFile);
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'en'); // Optional: specify language for better results

      console.log(`Sending audio to Groq: ${filename}, size: ${audioFile.size} bytes, type: ${mimeType}`);

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Groq transcription error:', error);
        throw new Error(`Transcription failed: ${error}`);
      }

      const result = await response.json();
      return (result.text || '').trim();
    } catch (error) {
      console.error('Error transcribing audio with Groq:', error);
      throw error instanceof Error ? error : new Error('Failed to transcribe audio');
    }
  }

  // Real-time transcription - transcribe audio chunks as they come in
  async transcribeChunk(
    audioChunk: Blob,
    provider: TranscriptionProvider = 'groq',
    apiKey?: string
  ): Promise<string> {
    // For real-time, Groq is faster and better suited
    if (provider === 'groq') {
      return this.transcribeWithGroq(audioChunk, apiKey);
    } else {
      // Gemini can also work but Groq is typically faster for streaming
      return this.transcribeWithGemini(audioChunk, apiKey);
    }
  }

  // Get audio duration from blob
  private async getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });
      
      audio.addEventListener('error', (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      });
    });
  }

  // Format timestamp as MM:SS
  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Chunk audio into parts and transcribe each part with timestamps
  async transcribeInChunks(
    audioBlob: Blob,
    chunkDurationSeconds: number = 30,
    provider: TranscriptionProvider = 'groq',
    apiKey?: string,
    onProgress?: (current: number, total: number) => void,
    includeTimestamps: boolean = true
  ): Promise<string> {
    // Get total audio duration for timestamp calculation
    let totalDuration = 0;
    try {
      totalDuration = await this.getAudioDuration(audioBlob);
      console.log(`Audio duration: ${totalDuration.toFixed(2)} seconds`);
    } catch (error) {
      console.warn('Could not determine audio duration, estimating from file size');
      // Estimate: ~128kbps = 16KB/second, so duration ≈ size/16KB
      totalDuration = audioBlob.size / (16 * 1024);
    }

    // Groq has a ~25MB file size limit for Whisper API
    // We'll chunk based on approximate file size: ~128kbps bitrate = ~16KB per second
    // So 30 seconds ≈ 480KB, safe chunk size is 400KB to stay well under 25MB
    const maxChunkSizeBytes = 400 * 1024; // 400KB per chunk
    const chunks: Blob[] = [];
    const chunkStartTimes: number[] = [];
    
    // Calculate chunk size in seconds based on file size and duration
    const bytesPerSecond = audioBlob.size / totalDuration;
    const chunkDurationActual = chunkDurationSeconds;
    const chunkSizeBytes = Math.floor(bytesPerSecond * chunkDurationActual);
    
    // If file is small enough, transcribe whole thing
    if (audioBlob.size <= maxChunkSizeBytes) {
      console.log('Audio file is small enough, transcribing whole file');
      const text = provider === 'groq'
        ? await this.transcribeWithGroq(audioBlob, apiKey)
        : await this.transcribeWithGemini(audioBlob, apiKey);
      
      if (includeTimestamps && totalDuration > 0) {
        return `[00:00] ${text.trim()}`;
      }
      return text.trim();
    }
    
    // Split into chunks with timestamp tracking
    let offset = 0;
    let timeOffset = 0;
    while (offset < audioBlob.size) {
      const end = Math.min(offset + Math.min(maxChunkSizeBytes, chunkSizeBytes), audioBlob.size);
      const chunk = audioBlob.slice(offset, end, audioBlob.type);
      chunks.push(chunk);
      chunkStartTimes.push(timeOffset);
      
      // Estimate time offset for next chunk
      const chunkTimeDuration = chunk.size / bytesPerSecond;
      timeOffset += chunkTimeDuration;
      offset = end;
    }
    
    console.log(`Splitting audio into ${chunks.length} chunks (max ${maxChunkSizeBytes / 1024}KB each)`);

    const transcriptions: string[] = [];
    
    // Transcribe each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i + 1, chunks.length);
      const startTime = chunkStartTimes[i];
      console.log(`Transcribing chunk ${i + 1}/${chunks.length} (${(chunks[i].size / 1024).toFixed(1)}KB, starts at ${this.formatTimestamp(startTime)})`);
      
      try {
        const text = provider === 'groq' 
          ? await this.transcribeWithGroq(chunks[i], apiKey)
          : await this.transcribeWithGemini(chunks[i], apiKey);
        
        if (text && text.trim()) {
          const timestamp = includeTimestamps ? `[${this.formatTimestamp(startTime)}] ` : '';
          transcriptions.push(timestamp + text.trim());
          console.log(`Chunk ${i + 1} transcribed: ${text.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error(`Error transcribing chunk ${i + 1}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    const combinedText = transcriptions.join('\n').trim();
    console.log(`Transcription complete: ${combinedText.length} characters`);
    return combinedText;
  }
}

export const transcription = new TranscriptionService();

