import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { coursesAPI } from '../api';
import toast from 'react-hot-toast';
import CourseModal from '../components/CourseModal';
import { IconPlus, IconEdit, IconTrash, IconEye, IconCourses, IconVideo, IconClock, IconCheckCircle, IconAlertCircle } from '../components/Icons';

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

  const filtered = filter === 'all' ? courses : filter === 'published' ? courses.filter(c => c.isPublished) : courses.filter(c => !c.isPublished);

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
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div className="page-wrap anim-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="page-subtitle">{courses.length} total courses in your platform</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary">
          <IconPlus className="w-4 h-4" /> New Course
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="field-input pl-10"
            placeholder="Search courses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
          {['all', 'published', 'draft'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <IconCourses className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-white font-semibold text-lg">No courses found</p>
          <p className="text-gray-500 text-sm mt-1.5 mb-6">Create your first course to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
            <IconPlus className="w-4 h-4" /> Create Course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(course => (
            <div key={course._id} className="card-hover flex flex-col overflow-hidden group">
              {/* Thumbnail */}
              <div
                className="relative h-40 bg-gradient-to-br from-indigo-900/40 to-violet-900/40 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/courses/${course._id}`)}
              >
                {course.thumbnail
                  ? <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : (
                    <div className="w-full h-full flex items-center justify-center">
                      <IconCourses className="w-10 h-10 text-indigo-400/40" />
                    </div>
                  )
                }
                <div className={`absolute top-3 right-3 ${course.isPublished ? 'badge-green' : 'badge-yellow'}`}>
                  {course.isPublished
                    ? <><IconCheckCircle className="w-3 h-3" /> Published</>
                    : <><IconAlertCircle className="w-3 h-3" /> Draft</>
                  }
                </div>
              </div>

              {/* Info */}
              <div className="p-4 flex-1 flex flex-col">
                <h3
                  className="font-semibold text-white text-[14px] leading-snug mb-1 cursor-pointer hover:text-indigo-300 transition-colors line-clamp-2"
                  onClick={() => navigate(`/courses/${course._id}`)}
                >
                  {course.title}
                </h3>
                <p className="text-[12px] text-gray-600 line-clamp-2 mb-3 flex-1">{course.description || 'No description provided'}</p>

                <div className="flex items-center gap-3 text-[11px] text-gray-600 mb-4">
                  <span className="flex items-center gap-1">
                    <IconVideo className="w-3.5 h-3.5" />
                    {course.totalLessons} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <IconClock className="w-3.5 h-3.5" />
                    {Math.floor((course.totalDuration || 0) / 60)}m
                  </span>
                  {course.category && <span className="badge-gray text-[10px] py-0.5">{course.category}</span>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-white/[0.05]">
                  <button onClick={() => navigate(`/courses/${course._id}`)} className="btn-icon w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-indigo-500/10 hover:text-indigo-400" title="View">
                    <IconEye className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setEditing(course); setShowModal(true); }} className="btn-icon w-8 h-8 rounded-lg bg-white/[0.04]" title="Edit">
                    <IconEdit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleTogglePublish(course)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${course.isPublished ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                  >
                    {course.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => handleDelete(course._id, course.title)} className="btn-icon w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-rose-500/10 hover:text-rose-400" title="Delete">
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
