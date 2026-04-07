import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { coursesAPI, modulesAPI, lessonsAPI } from '../api';
import toast from 'react-hot-toast';
import ModuleModal from '../components/ModuleModal';
import LessonModal from '../components/LessonModal';
import VideoUploader from '../components/VideoUploader';

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessonsByModule, setLessonsByModule] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [moduleModal, setModuleModal] = useState({ open: false, data: null });
  const [lessonModal, setLessonModal] = useState({ open: false, data: null, moduleId: null });
  const [videoUploader, setVideoUploader] = useState({ open: false, lesson: null });

  const fetchAll = async () => {
    try {
      const { data } = await coursesAPI.getById(id);
      setCourse(data.data);
      setModules(data.data.modules || []);
    } catch { toast.error('Failed to load course'); }
    finally { setLoading(false); }
  };

  const fetchLessons = async (moduleId) => {
    try {
      const { data } = await lessonsAPI.getByModule(moduleId);
      setLessonsByModule(prev => ({ ...prev, [moduleId]: data.data }));
    } catch {}
  };

  useEffect(() => { fetchAll(); }, [id]);

  const toggleModule = async (moduleId) => {
    const isOpen = expandedModules[moduleId];
    setExpandedModules(prev => ({ ...prev, [moduleId]: !isOpen }));
    if (!isOpen && !lessonsByModule[moduleId]) {
      await fetchLessons(moduleId);
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Delete module and all its lessons?')) return;
    try {
      await modulesAPI.delete(moduleId);
      toast.success('Module deleted');
      fetchAll();
    } catch { toast.error('Failed to delete module'); }
  };

  const handleDeleteLesson = async (lessonId, moduleId) => {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      await lessonsAPI.delete(lessonId);
      toast.success('Lesson deleted');
      fetchLessons(moduleId);
      fetchAll();
    } catch { toast.error('Failed to delete lesson'); }
  };

  const handleToggleLesson = async (lesson) => {
    try {
      await lessonsAPI.update(lesson._id, { isPublished: !lesson.isPublished });
      fetchLessons(lesson.module);
    } catch { toast.error('Failed to update lesson'); }
  };

  const formatDuration = (s) => {
    if (!s) return '0:00';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-dark-700" />)}
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/courses" className="hover:text-white transition-colors">Courses</Link>
        <span>/</span>
        <span className="text-white truncate">{course?.title}</span>
      </div>

      {/* Course Header */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-40 h-28 rounded-xl bg-dark-700 overflow-hidden flex-shrink-0">
          {course?.thumbnail ? (
            <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
          ) : <div className="w-full h-full flex items-center justify-center text-4xl">🎓</div>}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-white">{course?.title}</h1>
            <span className={course?.isPublished ? 'badge-green' : 'badge-yellow'}>
              {course?.isPublished ? 'Published' : 'Draft'}
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{course?.description}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
            <span>🧑‍🏫 {course?.instructor}</span>
            <span>📹 {course?.totalLessons} lessons</span>
            <span>⏱ {Math.floor((course?.totalDuration || 0) / 60)} min</span>
            <span>👥 {course?.totalEnrolled || 0} enrolled</span>
            {course?.category && <span>🏷️ {course.category}</span>}
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Modules & Lessons</h2>
        <button onClick={() => setModuleModal({ open: true, data: null })} className="btn-primary">
          + Add Module
        </button>
      </div>

      {modules.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-white font-medium">No modules yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first module to organize lessons</p>
          <button onClick={() => setModuleModal({ open: true, data: null })} className="btn-primary mt-4 mx-auto">+ Add Module</button>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, idx) => (
            <div key={mod._id} className="card p-0 overflow-hidden">
              {/* Module Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-dark-700/50 transition-colors"
                onClick={() => toggleModule(mod._id)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary-600/20 text-primary-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{mod.title}</p>
                  <p className="text-xs text-gray-500">{mod.totalLessons || 0} lessons</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={mod.isPublished ? 'badge-green' : 'badge-yellow'}>{mod.isPublished ? 'Published' : 'Draft'}</span>
                  <button onClick={e => { e.stopPropagation(); setModuleModal({ open: true, data: mod }); }} className="text-gray-400 hover:text-white p-1 rounded transition-colors">✏️</button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteModule(mod._id); }} className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors">🗑️</button>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedModules[mod._id] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Lessons */}
              {expandedModules[mod._id] && (
                <div className="border-t border-dark-600 bg-dark-700/30">
                  <div className="p-3 space-y-2">
                    {(lessonsByModule[mod._id] || []).map((lesson, li) => (
                      <div key={lesson._id} className="flex items-center gap-3 p-3 rounded-xl bg-dark-700 hover:bg-dark-600 transition-colors group">
                        <div className="w-7 h-7 rounded-lg bg-dark-600 text-gray-400 flex items-center justify-center text-xs flex-shrink-0">
                          {li + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{lesson.title}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span>{lesson.uploadStatus === 'ready' ? '✅ Video ready' : lesson.uploadStatus === 'pending' ? '⏳ Uploading' : '❌ No video'}</span>
                            {lesson.duration > 0 && <span>⏱ {formatDuration(lesson.duration)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setVideoUploader({ open: true, lesson })}
                            className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-2 py-1 rounded-lg transition-colors"
                          >
                            📹 Video
                          </button>
                          <button
                            onClick={() => handleToggleLesson(lesson)}
                            className={`text-xs px-2 py-1 rounded-lg transition-colors ${lesson.isPublished ? 'bg-yellow-600/20 text-yellow-400' : 'bg-emerald-600/20 text-emerald-400'}`}
                          >
                            {lesson.isPublished ? 'Hide' : 'Show'}
                          </button>
                          <button onClick={() => setLessonModal({ open: true, data: lesson, moduleId: mod._id })} className="text-gray-400 hover:text-white p-1 rounded transition-colors text-xs">✏️</button>
                          <button onClick={() => handleDeleteLesson(lesson._id, mod._id)} className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors text-xs">🗑️</button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => setLessonModal({ open: true, data: null, moduleId: mod._id })}
                      className="w-full py-2.5 border border-dashed border-dark-500 hover:border-primary-500/50 text-gray-500 hover:text-primary-400 rounded-xl text-sm transition-colors"
                    >
                      + Add Lesson
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {moduleModal.open && (
        <ModuleModal
          courseId={id}
          module={moduleModal.data}
          onClose={() => setModuleModal({ open: false, data: null })}
          onSaved={() => { setModuleModal({ open: false, data: null }); fetchAll(); }}
        />
      )}
      {lessonModal.open && (
        <LessonModal
          moduleId={lessonModal.moduleId}
          lesson={lessonModal.data}
          onClose={() => setLessonModal({ open: false, data: null, moduleId: null })}
          onSaved={() => {
            setLessonModal({ open: false, data: null, moduleId: null });
            fetchLessons(lessonModal.moduleId);
            fetchAll();
          }}
        />
      )}
      {videoUploader.open && (
        <VideoUploader
          lesson={videoUploader.lesson}
          onClose={() => setVideoUploader({ open: false, lesson: null })}
          onUploaded={() => {
            setVideoUploader({ open: false, lesson: null });
            if (videoUploader.lesson) fetchLessons(videoUploader.lesson.module);
          }}
        />
      )}
    </div>
  );
}
