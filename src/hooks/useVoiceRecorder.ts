import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { createValidAudioFromChunks } from '@/lib/audioUtils';

export const useVoiceRecorder = (onChunkAvailable?: (chunk: Blob) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const lastTranscribedChunkRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('audio/webm');
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check for supported MIME types
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          // Use browser default
          mimeType = '';
        }
      }
      
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mimeTypeRef.current = mediaRecorder.mimeType || mimeType || 'audio/webm';

      console.log('MediaRecorder started with MIME type:', mimeTypeRef.current);

      // Collect audio chunks continuously
      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Total chunks:', audioChunksRef.current.length, 'Total size:', audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0), 'bytes');
          
          // Call callback for live transcription if provided
          // Check paused state via ref to avoid closure issues
          if (onChunkAvailable && mediaRecorder.state === 'recording') {
            // For live transcription, we need valid audio files
            // Process after 2 chunks for faster initial transcription (≈2-3 seconds vs 9 seconds)
            // This provides better real-time feel while still ensuring valid audio files
            if (audioChunksRef.current.length >= 2) {
              // Create a valid audio file from chunks (including all chunks from start for webm)
              // This ensures we have initialization segments needed for valid webm files
              createValidAudioFromChunks(
                audioChunksRef.current,
                mimeTypeRef.current,
                lastTranscribedChunkRef.current
              ).then(async (validAudioBlob) => {
                // Lower threshold to 10KB for faster response (was 20KB)
                // This allows transcription to start sooner
                if (validAudioBlob.size > 10000) {
                  console.log(`Preparing valid audio for transcription: ${validAudioBlob.size} bytes, type: ${validAudioBlob.type}`);
                  
                  // Update last transcribed index to avoid re-sending same audio
                  // We keep last 1 chunk to ensure next segment includes necessary data
                  lastTranscribedChunkRef.current = Math.max(0, audioChunksRef.current.length - 1);
                  
                  onChunkAvailable(validAudioBlob);
                }
              }).catch(error => {
                console.error('Error creating valid audio file:', error);
              });
            }
          }
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped. Total chunks:', audioChunksRef.current.length);
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('Total audio size:', totalSize, 'bytes');
        
        if (audioChunksRef.current.length > 0 && totalSize > 0) {
          const blobType = mimeTypeRef.current;
          const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
          console.log('Created audio blob:', audioBlob.size, 'bytes, type:', blobType);
          setAudioBlob(audioBlob);
        } else {
          console.error('No audio chunks collected!');
          toast({
            title: "Recording error",
            description: "No audio data was captured. Please try again.",
            variant: "destructive",
          });
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast({
          title: "Recording error",
          description: "An error occurred while recording.",
          variant: "destructive",
        });
      };

      // Start recording - request data every 1.5 seconds for real-time feel
      // This provides faster transcription updates (≈3 seconds for first transcription vs 9 seconds)
      // while maintaining API efficiency and valid audio file creation
      mediaRecorder.start(1500);
      lastTranscribedChunkRef.current = 0;
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: "Recording started",
        description: "Your voice note is being recorded.",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      toast({ title: "Recording resumed" });
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
      toast({ title: "Recording paused" });
    }
  }, [isPaused, toast]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    // Request final data chunk before stopping
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.requestData();
    }
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setIsPaused(false);
    if (timerRef.current) clearInterval(timerRef.current);

    toast({
      title: "Recording stopped",
      description: "Your recording is ready to be saved.",
    });
  }, [toast]);

  const resetRecording = useCallback(() => {
    setRecordingTime(0);
    setAudioBlob(null);
    audioChunksRef.current = [];
    lastTranscribedChunkRef.current = 0;
    mimeTypeRef.current = 'audio/webm';
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    pauseRecording,
    stopRecording,
    resetRecording,
  };
};
