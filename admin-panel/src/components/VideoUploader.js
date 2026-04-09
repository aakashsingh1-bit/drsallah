import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { videoAPI } from '../api';
import toast from 'react-hot-toast';
import { IconUpload, IconVideo, IconCheckCircle, IconX, IconAlertCircle } from './Icons';

export default function VideoUploader({ lesson, onClose, onUploaded }) {
  const [mode, setMode] = useState('presigned');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [duration, setDuration] = useState('');

  const onDrop = useCallback(accepted => { if (accepted[0]) setFile(accepted[0]); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'video/*': ['.mp4','.webm','.mov','.avi'] }, maxFiles: 1, maxSize: 500*1024*1024,
  });

  const uploadPresigned = async () => {
    if (!file) return toast.error('Select a video file first');
    setStatus('uploading');
    try {
      const { data: pd } = await videoAPI.getPresignedUrl({ lessonId: lesson._id, filename: file.name, contentType: file.type||'video/mp4' });
      await videoAPI.uploadToS3(pd.data.uploadUrl, file, p => setProgress(p));
      setStatus('confirming');
      await videoAPI.confirmUpload({ lessonId: lesson._id, key: pd.data.key, duration: duration ? parseInt(duration) : undefined });
      setStatus('done');
      toast.success('Video uploaded successfully');
      setTimeout(() => onUploaded?.(), 1400);
    } catch (err) {
      setStatus('error');
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const uploadDirect = async () => {
    if (!file) return toast.error('Select a video file first');
    setStatus('uploading');
    const fd = new FormData();
    fd.append('video', file);
    try {
      await videoAPI.uploadDirect(lesson._id, fd, p => setProgress(p));
      setStatus('done');
      toast.success('Video uploaded successfully');
      setTimeout(() => onUploaded?.(), 1400);
    } catch (err) {
      setStatus('error');
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const isUploading = ['uploading','confirming'].includes(status);
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-[#e8e6e0] rounded-2xl w-full max-w-[480px] shadow-card-lg animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e8e6e0]">
          <div>
            <p className="text-[15px] font-bold text-[#1c1d1f]">Upload Video</p>
            <p className="text-[12px] text-[#9e9e9e] mt-0.5 truncate max-w-[320px]">{lesson?.title}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><IconX className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">

          {/* Mode toggle */}
          <div>
            <label className="field-label">Upload Method</label>
            <div className="flex gap-1.5 bg-[#f0ece4] p-1 rounded-lg border border-[#e0ddd6]">
              {[['presigned','S3 Direct (Recommended)'],['direct','Server Upload (< 100MB)']].map(([v,l]) => (
                <button key={v} onClick={() => setMode(v)}
                  className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-semibold transition-all ${mode===v ? 'bg-white text-[#1c1d1f] shadow-soft' : 'text-[#6a6f73] hover:text-[#1c1d1f]'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Dropzone */}
          {!isDone && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragActive ? 'border-brand-500 bg-brand-50' : file ? 'border-emerald-500/50 bg-emerald-50' : 'border-[#d1d0cc] hover:border-brand-400 hover:bg-[#faf9f6]'}`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto">
                    <IconVideo className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#1c1d1f]">{file.name}</p>
                  <p className="text-[12px] text-[#9e9e9e]">{(file.size/1024/1024).toFixed(1)} MB</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-[11px] text-red-600 hover:text-red-700 transition-colors flex items-center gap-1 mx-auto">
                    <IconX className="w-3 h-3" />Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#f0ece4] flex items-center justify-center mx-auto">
                    <IconUpload className="w-6 h-6 text-[#9e9e9e]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1c1d1f]">{isDragActive ? 'Drop to upload' : 'Drop video or click to browse'}</p>
                    <p className="text-[11px] text-[#9e9e9e] mt-1">MP4, WebM, MOV, AVI — up to 500 MB</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Duration hint (presigned) */}
          {mode === 'presigned' && !isDone && (
            <div>
              <label className="field-label">Duration <span className="normal-case text-[#9e9e9e] font-normal">(seconds, optional)</span></label>
              <input type="number" className="field-input" placeholder="e.g. 1800 for 30 minutes" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#6a6f73]">{status === 'confirming' ? 'Confirming upload...' : `Uploading to S3...`}</span>
                <span className="text-[#1c1d1f] font-semibold">{status === 'confirming' ? '100' : progress}%</span>
              </div>
              <div className="h-2 bg-[#f0ece4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-orange-500 rounded-full transition-all duration-200"
                  style={{ width: `${status === 'confirming' ? 100 : progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Done */}
          {isDone && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                <IconCheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-[15px] font-bold text-[#1c1d1f]">Upload Complete!</p>
              <p className="text-[13px] text-[#9e9e9e]">The lesson video is ready for streaming</p>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
              <IconAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-[13px] text-red-600">Upload failed. Please try again.</p>
            </div>
          )}

          {/* Actions */}
          {!isDone && (
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1" disabled={isUploading}>Cancel</button>
              <button
                onClick={mode === 'presigned' ? uploadPresigned : uploadDirect}
                className="btn-primary flex-1"
                disabled={!file || isUploading}
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {status === 'confirming' ? 'Confirming...' : `${progress}%`}
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