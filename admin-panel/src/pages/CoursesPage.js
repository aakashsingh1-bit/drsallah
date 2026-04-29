import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { coursesAPI } from '../api';
import toast from 'react-hot-toast';
import CourseModal from '../components/CourseModal';
import {
  IconPlus, IconEdit, IconTrash, IconEye,
  IconCourses, IconVideo, IconClock, IconCheckCircle, IconAlertCircle, IconTrendUp,
} from '../components/Icons';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data } = await coursesAPI.getAll({ search, limit: 100 });
      setCourses(data.data);
    } catch { toast.error('Failed to load courses'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, [search]);

  const filtered = filter === 'all' ? courses
    : filter === 'published' ? courses.filter(c => c.isPublished)
    : courses.filter(c => !c.isPublished);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}" and all its content?`)) return;
    try { await coursesAPI.delete(id); toast.success('Course deleted'); fetchCourses(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleTogglePublish = async (course) => {
    try {
      const fd = new FormData();
      fd.append('isPublished', !course.isPublished);
      await coursesAPI.update(course._id, fd);
      toast.success(course.isPublished ? 'Course unpublished' : 'Course published');
      fetchCourses();
    } catch { toast.error('Update failed'); }
  };

  return (
    <div className="page-wrap animate-fade-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-sub">{courses.length} courses on your platform</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary">
          <IconPlus className="w-4 h-4" /> New Course
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#b0afab]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            className="field-input pl-9"
            placeholder="Search courses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-[#f5f4f0] border border-[#e0ddd6] p-1 rounded-lg">
          {['all','published','draft'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-[12px] font-semibold capitalize transition-all ${
                filter === f
                  ? 'bg-white text-[#1c1d1f] shadow-soft border border-[#e0ddd6]'
                  : 'text-[#6a6f73] hover:text-[#1c1d1f]'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-64 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <IconCourses className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-[17px] font-bold text-[#1c1d1f]">No courses found</p>
          <p className="text-[13px] text-[#6a6f73] mt-1.5 mb-6">Create your first course to get started</p>
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary mx-auto">
            <IconPlus className="w-4 h-4" /> Create Course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(course => (
            <div key={course._id} className="bg-white border border-[#e8e6e0] rounded-xl shadow-soft hover:shadow-card transition-all duration-150 flex flex-col overflow-hidden group">

              {/* Thumbnail */}
              <div
                className="relative h-40 bg-gradient-to-br from-violet-100 to-orange-50 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/courses/${course._id}`)}
              >
                {course.thumbnail
                  ? <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                  : (
                    <div className="w-full h-full flex items-center justify-center">
                      <IconCourses className="w-12 h-12 text-violet-300" />
                    </div>
                  )
                }
                <div className={`absolute top-2.5 right-2.5 ${course.isPublished ? 'badge-green' : 'badge-gray'}`}>
                  {course.isPublished
                    ? <><IconCheckCircle className="w-3 h-3"/>Published</>
                    : <><IconAlertCircle className="w-3 h-3"/>Draft</>
                  }
                </div>
              </div>

              {/* Info */}
              <div className="p-4 flex-1 flex flex-col">
                <h3
                  className="text-[14px] font-bold text-[#1c1d1f] leading-snug mb-1.5 cursor-pointer hover:text-brand-600 transition-colors line-clamp-2"
                  onClick={() => navigate(`/courses/${course._id}`)}
                >
                  {course.title}
                </h3>
                <p className="text-[12px] text-[#6a6f73] line-clamp-2 mb-3 flex-1">
                  {course.description || 'No description provided'}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-[#9e9e9e] mb-2">
                  <span className="flex items-center gap-1">
                    <IconVideo className="w-3.5 h-3.5"/> {course.totalLessons} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <IconClock className="w-3.5 h-3.5"/> {Math.floor((course.totalDuration || 0) / 60)}m
                  </span>
                  {course.category && (
                    <span className="badge-gray text-[10px] py-0.5">{course.category}</span>
                  )}
                </div>

                {/* Price Tiers */}
                {course.priceTiers?.filter(t => t.isActive).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {course.priceTiers
                      .filter(t => t.isActive && t.price > 0)
                      .sort((a, b) => a.months - b.months)
                      .slice(0, 4)
                      .map(tier => (
                        <span key={tier.months} className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                          {tier.months === 1 ? '1mo' : tier.months === 12 ? '1yr' : `${tier.months}mo`} AED {tier.price}
                        </span>
                      ))
                    }
                    {course.priceTiers.filter(t => t.isActive && t.price > 0).length > 4 && (
                      <span className="text-[10px] text-[#9e9e9e]">+more</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-3 border-t border-[#f5f4f0]">
                  <button
                    onClick={() => navigate(`/courses/${course._id}`)}
                    className="btn-icon w-8 h-8 rounded-lg bg-[#f5f4f0] hover:bg-violet-50 hover:text-violet-600"
                    title="View"
                  >
                    <IconEye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setEditing(course); setShowModal(true); }}
                    className="btn-icon w-8 h-8 rounded-lg bg-[#f5f4f0]"
                    title="Edit"
                  >
                    <IconEdit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleTogglePublish(course)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      course.isPublished
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {course.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(course._id, course.title)}
                    className="btn-icon w-8 h-8 rounded-lg bg-[#f5f4f0] hover:bg-red-50 hover:text-red-500"
                    title="Delete"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CourseModal
          course={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchCourses(); }}
        />
      )}
    </div>
  );
}
