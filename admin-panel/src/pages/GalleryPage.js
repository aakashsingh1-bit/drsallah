import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { galleryAPI } from '../api';
import {
  IconImage, IconUpload, IconTrash, IconX, IconEye, IconSearch,
  IconChevronLeft, IconChevronRight, IconRefresh, IconFilter,
} from '../components/Icons';

const CATEGORIES = ['general', 'events', 'courses', 'promotional', 'other'];
const CATEGORY_COLORS = {
  general: 'bg-gray-100 text-gray-700',
  events: 'bg-blue-100 text-blue-700',
  courses: 'bg-purple-100 text-purple-700',
  promotional: 'bg-orange-100 text-orange-700',
  other: 'bg-green-100 text-green-700',
};

export default function GalleryPage() {
  const [images, setImages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [bulkTitle, setBulkTitle] = useState('');
  const [bulkCategory, setBulkCategory] = useState('general');
  const [viewImage, setViewImage] = useState(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (category) params.category = category;
      if (search) params.search = search;
      const { data: res } = await galleryAPI.getAll(params);
      setImages(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [page, limit, category, search]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const totalPages = Math.ceil(total / limit);

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (files.length > 20) {
      toast.error('Maximum 20 images at a time');
      return;
    }
    setSelectedFiles(files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
  };

  const removeFile = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearUpload = () => {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setSelectedFiles([]);
    setPreviews([]);
    setBulkTitle('');
    setBulkCategory('general');
    setShowUpload(false);
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Select at least one image');
      return;
    }
    setUploading(true);
    try {
      if (selectedFiles.length === 1) {
        const formData = new FormData();
        formData.append('image', selectedFiles[0]);
        formData.append('title', bulkTitle || selectedFiles[0].name);
        formData.append('category', bulkCategory);
        await galleryAPI.upload(formData);
      } else {
        const formData = new FormData();
        selectedFiles.forEach((f) => formData.append('images', f));
        formData.append('title', bulkTitle || '');
        formData.append('category', bulkCategory);
        await galleryAPI.uploadBulk(formData);
      }
      toast.success(`Uploaded ${selectedFiles.length} image(s)`);
      clearUpload();
      fetchImages();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title || 'this image'}"?`)) return;
    try {
      await galleryAPI.deleteImage(id);
      toast.success('Image deleted');
      fetchImages();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────────────
  const handleToggleActive = async (img) => {
    try {
      await galleryAPI.update(img._id, { isActive: !img.isActive });
      toast.success(img.isActive ? 'Image hidden' : 'Image shown');
      fetchImages();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1c1d1f]">Gallery</h1>
          <p className="text-sm text-[#6a6f73] mt-0.5">{total} image{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <IconUpload size={16} />
          Upload Images
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6f73]" />
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-[#e8e6e0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <IconFilter size={14} className="text-[#6a6f73]" />
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-[#e8e6e0] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setSearch(''); setCategory(''); setPage(1); }}
          className="p-2 text-[#6a6f73] hover:text-[#1c1d1f] transition-colors"
          title="Reset filters"
        >
          <IconRefresh size={16} />
        </button>
      </div>

      {/* ── Image Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 text-[#6a6f73]">
          <IconImage size={48} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No images found</p>
          <p className="text-sm mt-1">Upload images to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img) => (
            <div
              key={img._id}
              className="group relative bg-white rounded-xl border border-[#e8e6e0] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-square overflow-hidden bg-gray-50">
                <img
                  src={img.imageUrl}
                  alt={img.title || 'Gallery image'}
                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                  onClick={() => setViewImage(img)}
                  loading="lazy"
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-[#1c1d1f] truncate">
                  {img.title || 'Untitled'}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[img.category] || CATEGORY_COLORS.general}`}>
                    {img.category}
                  </span>
                  {!img.isActive && (
                    <span className="text-[10px] text-red-500 font-medium">Hidden</span>
                  )}
                </div>
              </div>
              {/* Hover actions */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setViewImage(img)}
                  className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
                  title="View"
                >
                  <IconEye size={14} className="text-[#1c1d1f]" />
                </button>
                <button
                  onClick={() => handleToggleActive(img)}
                  className={`p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors ${
                    img.isActive ? 'text-green-600' : 'text-[#6a6f73]'
                  }`}
                  title={img.isActive ? 'Hide' : 'Show'}
                >
                  <IconEye size={14} />
                </button>
                <button
                  onClick={() => handleDelete(img._id, img.title)}
                  className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors text-red-500"
                  title="Delete"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-[#e8e6e0] disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            <IconChevronLeft size={16} />
          </button>
          <span className="text-sm text-[#6a6f73] px-3">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-[#e8e6e0] disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Upload Modal ───────────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e6e0]">
              <h2 className="font-semibold text-[#1c1d1f]">Upload Images</h2>
              <button onClick={clearUpload} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <IconX size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* File drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  selectedFiles.length > 0
                    ? 'border-brand-500 bg-brand-50/30'
                    : 'border-[#e8e6e0] hover:border-brand-400'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFilesSelected}
                  className="hidden"
                  id="gallery-upload"
                />
                <label htmlFor="gallery-upload" className="cursor-pointer block">
                  <IconUpload size={32} className="mx-auto mb-2 text-[#6a6f73]" />
                  <p className="text-sm font-medium text-[#1c1d1f]">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected`
                      : 'Click to select images'}
                  </p>
                  <p className="text-xs text-[#6a6f73] mt-1">JPEG, PNG, WebP, GIF up to 10MB each</p>
                </label>
              </div>

              {/* Previews */}
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previews.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#e8e6e0] group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <IconX size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Metadata fields */}
              <div>
                <label className="block text-xs font-medium text-[#6a6f73] mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={bulkTitle}
                  onChange={(e) => setBulkTitle(e.target.value)}
                  placeholder={selectedFiles.length === 1 ? 'Image title' : 'Common title for all images'}
                  className="w-full px-3 py-2 border border-[#e8e6e0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6a6f73] mb-1">Category</label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e8e6e0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#e8e6e0] bg-gray-50/50">
              <button
                onClick={clearUpload}
                className="px-4 py-2 text-sm font-medium text-[#6a6f73] hover:text-[#1c1d1f] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || uploading}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <IconUpload size={16} />
                    Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Image Modal ────────────────────────────────────────────────── */}
      {viewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setViewImage(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <img
                src={viewImage.imageUrl}
                alt={viewImage.title || 'Gallery image'}
                className="w-full max-h-[60vh] object-contain bg-gray-100"
              />
              <button
                onClick={() => setViewImage(null)}
                className="absolute top-3 right-3 p-1.5 bg-black/40 backdrop-blur-sm rounded-lg text-white hover:bg-black/60 transition-colors"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="p-5 space-y-2">
              <h3 className="font-semibold text-[#1c1d1f]">{viewImage.title || 'Untitled'}</h3>
              <div className="flex items-center gap-3 text-xs text-[#6a6f73]">
                <span className={`px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[viewImage.category] || CATEGORY_COLORS.general}`}>
                  {viewImage.category}
                </span>
                {viewImage.fileSize && (
                  <span>{(viewImage.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                )}
                {viewImage.createdAt && (
                  <span>{new Date(viewImage.createdAt).toLocaleDateString()}</span>
                )}
                <span className={viewImage.isActive ? 'text-green-600' : 'text-red-500'}>
                  {viewImage.isActive ? 'Active' : 'Hidden'}
                </span>
              </div>
              {viewImage.altText && (
                <p className="text-sm text-[#6a6f73]">{viewImage.altText}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
