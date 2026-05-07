import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { videoAPI } from '../api';
import toast from 'react-hot-toast';
import { IconUpload, IconVideo, IconCheckCircle, IconX, IconClock, IconAlertCircle } from './Icons';

export default function VideoUploader({ lesson, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [duration, setDuration] = useState(null);
  const [fileSize, setFileSize] = useState(null);

  const onDrop = useCallback((accepted) => { 
    if (accepted[0]) {
      const videoFile = accepted[0];
      setFile(videoFile);
      setFileSize(videoFile.size);
      
      // Get video duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setDuration(Math.floor(video.duration));
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(videoFile);
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, 
    accept: { 'video/*': ['.mp4','.webm','.mov','.avi'] }, 
    maxFiles: 1, 
    maxSize: 500*1024*1024*20,
  });

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    if (bytes > 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // ── Server-Proxy Upload ────────────────────────────────────────────────
  // File goes: Browser → Server (s3StreamStorage) → S3 (multipart upload)
  // The server streams the file directly to S3 without writing to disk.
  const uploadVideo = async () => {
    if (!file) return toast.error('Select a video file first');
    setStatus('uploading');
    setProgress(0);
    
    const fd = new FormData();
    fd.append('video', file);
    fd.append('duration', duration || 0);
    
    try {
      await videoAPI.uploadDirect(lesson._id, fd, p => setProgress(p));
      setStatus('done');
      toast.success('Video uploaded to S3 successfully');
      setTimeout(() => onUploaded?.(), 1500);
    } catch (err) {
      console.error('Upload error:', err);
      setStatus('error');
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const isUploading = status === 'uploading';
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-[#e8e6e0] rounded-2xl w-full max-w-[520px] shadow-card-lg animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e8e6e0]">
          <div>
            <p className="text-[15px] font-bold text-[#1c1d1f]">Upload Video</p>
            <p className="text-[12px] text-[#9e9e9e] mt-0.5 truncate max-w-[360px]">{lesson?.title}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><IconX className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">

          {/* Dropzone */}
          {!isDone && (
            <>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragActive 
                    ? 'border-brand-500 bg-brand-50' 
                    : file 
                      ? 'border-emerald-500/50 bg-emerald-50' 
                      : 'border-[#d1d0cc] hover:border-brand-400 hover:bg-[#faf9f6]'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                      <IconVideo className="w-7 h-7 text-emerald-600" />
                    </div>
                    <p className="text-[13px] font-semibold text-[#1c1d1f]">{file.name}</p>
                    <div className="flex items-center justify-center gap-4 text-[12px] text-[#6a6f73]">
                      <span className="flex items-center gap-1">
                        <IconClock className="w-3.5 h-3.5" />
                        {formatDuration(duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6M12 9v6" />
                        </svg>
                        {formatSize(fileSize)}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFile(null); setDuration(null); setFileSize(null); }} 
                      className="text-[11px] text-red-600 hover:text-red-700 transition-colors flex items-center gap-1 mx-auto"
                    >
                      <IconX className="w-3 h-3" />Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#f0ece4] flex items-center justify-center mx-auto">
                      <IconUpload className="w-7 h-7 text-[#9e9e9e]" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#1c1d1f]">
                        {isDragActive ? 'Drop video here' : 'Drop video or click to browse'}
                      </p>
                      <p className="text-[12px] text-[#9e9e9e] mt-2">MP4, WebM, MOV, AVI — up to 10GB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Duration display */}
              {duration && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <IconClock className="w-4 h-4 text-blue-600" />
                  <span className="text-[13px] text-blue-700 font-medium">
                    Video duration: {formatDuration(duration)} ({duration} seconds)
                  </span>
                </div>
              )}
            </>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#6a6f73]">Uploading to server...</span>
                <span className="text-[#1c1d1f] font-semibold">{progress}%</span>
              </div>
              <div className="h-2 bg-[#f0ece4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-orange-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-[#9e9e9e] text-center">
                {fileSize > 1024 * 1024 * 1024 ? (
                  <>Large file — this may take several minutes. Do not close this page.</>
                ) : (
                  <>Uploading to S3 via server...</>
                )}
              </p>
            </div>
          )}

          {/* Done */}
          {isDone && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                <IconCheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-[16px] font-bold text-[#1c1d1f]">Upload Complete!</p>
              <p className="text-[13px] text-[#9e9e9e]">The lesson video is ready for streaming</p>
              {duration && (
                <p className="text-[12px] text-[#6a6f73]">
                  Duration: {formatDuration(duration)} | Size: {formatSize(fileSize)}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
              <IconAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-[13px] text-red-600">
                Upload failed. Please try again.
              </p>
            </div>
          )}

          {/* Actions */}
          {!isDone && (
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1" disabled={isUploading}>
                Cancel
              </button>
              <button
                onClick={uploadVideo}
                className="btn-primary flex-1"
                disabled={!file || isUploading}
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {progress}%
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <IconUpload className="w-4 h-4" />
                    Upload Video
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
