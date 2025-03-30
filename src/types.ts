// Common type definitions for the extension
export interface RecordingState {
  isRecording: boolean;
  serverUrl: string;
  mediaRecorder?: MediaRecorder;
  stream?: MediaStream;
  recordedChunks: Blob[];
}

// Response types
export interface CommandResponse {
  success: boolean;
  error?: string;
}