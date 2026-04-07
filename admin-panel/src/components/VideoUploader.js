import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { videoAPI, lessonsAPI } from '../api';
import toast from 'react-hot-toast';

export default function VideoUploader({ lesson, onClose, onUploaded }) {
  const [uploadMode, setUploadMode] = useState('presigned'); // 'presigned' | 'direct'
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | uploading | confirming | done | error
  const [duration, setDuration] = useState('');

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.webm', '.mov', '.avi'] },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024,
  });

  const handlePresignedUpload = async () => {
    if (!file) return toast.error('Please select a video file');
    setStatus('uploading');
    try {
      // Step 1: Get presigned URL
      const { data: presignData } = await videoAPI.getPresignedUrl({
        lessonId: lesson._id,
        filename: file.name,
        contentType: file.type || 'video/mp4',
      });
      const { uploadUrl, key } = presignData.data;

      // Step 2: Upload directly to S3
      await videoAPI.uploadToS3(uploadUrl, file, (p) => setProgress(p));
      setStatus('confirming');

      // Step 3: Confirm
      await videoAPI.confirmUpload({
        lessonId: lesson._id,
        key,
        duration: duration ? parseInt(duration) : undefined,
      });

      setStatus('done');
      toast.success('Video uploaded successfully! 🎉');
      setTimeout(() => { onUploaded?.(); }, 1500);
    } catch (err) {
      setStatus('error');
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const handleDirectUpload = async () => {
    if (!file) return toast.error('Please select a video file');
    setStatus('uploading');
    const fd = new FormData();
    fd.append('video', file);
    try {
      await videoAPI.uploadDirect(lesson._id, fd, (p) => setProgress(p));
      setStatus('done');
      toast.success('Video uploaded successfully! 🎉');
      setTimeout(() => { onUploaded?.(); }, 1500);
    } catch (err) {
      setStatus('error');
      toast.error(err.response?.data?.message || 'Direct upload failed');
    }
  };

  const isUploading = status === 'uploading' || status === 'confirming';
  const isDone = status === 'done';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-600">
          <div>
            <h2 className="text-lg font-bold text-white">Upload Video</h2>
            <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{lesson?.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Upload Mode Toggle */}
          <div className="flex gap-2 bg-dark-700 p-1 rounded-xl">
            {[
              { id: 'presigned', label: '☁️ S3 Direct (Recommended)', desc: 'Upload directly to AWS S3' },
              { id: 'direct', label: '📡 Server Upload', desc: 'Upload through server (< 100MB)' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setUploadMode(m.id)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${uploadMode === m.id ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Dropzone */}
          {!isDone && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary-500 bg-primary-500/10' : file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-dark-500 hover:border-primary-500/50'}`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="space-y-2">
                  <p className="text-3xl">🎬</p>
                  <p className="font-medium text-white text-sm truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-4xl">📹</p>
                  <p className="text-white font-medium text-sm">{isDragActive ? 'Drop it here' : 'Drop video or click to browse'}</p>
                  <p className="text-xs text-gray-500">MP4, WebM, MOV, AVI — max 500MB</p>
                </div>
              )}
            </div>
          )}

          {/* Duration (for presigned) */}
          {uploadMode === 'presigned' && !isDone && (
            <div>
              <label className="label">Video Duration (seconds) <span className="text-gray-600">optional</span></label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 1800 (for 30 minutes)"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </div>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{status === 'confirming' ? '✅ Confirming upload...' : `Uploading to S3...`}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${status === 'confirming' ? 100 : progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Done */}
          {isDone && (
            <div className="text-center py-4 space-y-2">
              <p className="text-5xl">✅</p>
              <p className="text-white font-semibold">Upload Complete!</p>
              <p className="text-gray-400 text-sm">The lesson video is now ready for streaming</p>
            </div>
          )}

          {/* Actions */}
          {!isDone && (
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center" disabled={isUploading}>Cancel</button>
              <button
                onClick={uploadMode === 'presigned' ? handlePresignedUpload : handleDirectUpload}
                className="btn-primary flex-1 justify-center"
                disabled={!file || isUploading}
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {status === 'confirming' ? 'Confirming...' : `${progress}%`}
                  </span>
                ) : '⬆️ Upload Video'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
