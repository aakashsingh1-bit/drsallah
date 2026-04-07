import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { coursesAPI } from '../api';
import toast from 'react-hot-toast';
import CourseModal from '../components/CourseModal';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const navigate = useNavigate();

  const fetchCourses = async () => {
    try {
      const { data } = await coursesAPI.getAll({ search, limit: 50 });
      setCourses(data.data);
    } catch { toast.error('Failed to load courses'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, [search]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}" and all its content?`)) return;
    try {
      await coursesAPI.delete(id);
      toast.success('Course deleted');
      fetchCourses();
    } catch { toast.error('Failed to delete'); }
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
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Courses</h1>
          <p className="text-gray-400 text-sm">{courses.length} courses total</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary">
          <span>+</span> New Course
        </button>
      </div>

      {/* Search */}
      <input
        className="input max-w-sm"
        placeholder="🔍 Search courses..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-48 animate-pulse bg-dark-700" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-5xl mb-4">🎓</p>
          <p className="text-white font-semibold text-lg">No courses yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first course to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4 mx-auto">+ Create Course</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <div key={course._id} className="card group hover:border-primary-500/30 transition-all cursor-pointer flex flex-col">
              {/* Thumbnail */}
              <div
                className="h-36 rounded-xl bg-dark-700 mb-4 overflow-hidden flex items-center justify-center relative"
                onClick={() => navigate(`/courses/${course._id}`)}
              >
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">🎓</span>
                )}
                <div className={`absolute top-2 right-2 ${course.isPublished ? 'badge-green' : 'badge-yellow'}`}>
                  {course.isPublished ? 'Published' : 'Draft'}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 space-y-1" onClick={() => navigate(`/courses/${course._id}`)}>
                <h3 className="font-semibold text-white leading-tight group-hover:text-primary-400 transition-colors">{course.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{course.description || 'No description'}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
                  <span>📹 {course.totalLessons} lessons</span>
                  <span>⏱ {Math.floor(course.totalDuration / 60)}m</span>
                  {course.category && <span>🏷️ {course.category}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-600">
                <button
                  onClick={() => handleTogglePublish(course)}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${course.isPublished ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'}`}
                >
                  {course.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => { setEditing(course); setShowModal(true); }}
                  className="btn-secondary flex-1 justify-center text-xs py-1.5"
                >
                  ✏️ Edit
                </button>
                <button onClick={() => handleDelete(course._id, course.title)} className="btn-danger py-1.5 px-3 text-xs">
                  🗑️
                </button>
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
