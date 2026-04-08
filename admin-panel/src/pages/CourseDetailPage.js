import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { coursesAPI, lessonsAPI, modulesAPI } from '../api';
import toast from 'react-hot-toast';
import ModuleModal from '../components/ModuleModal';
import LessonModal from '../components/LessonModal';
import VideoUploader from '../components/VideoUploader';
import {
  IconPlus, IconEdit, IconTrash, IconVideo, IconClock,
  IconChevronDown, IconChevronRight, IconCheckCircle, IconAlertCircle, IconCourses,
} from '../components/Icons';

const StatusBadge = ({ published }) => published
  ? <span className="badge-green text-[10px]"><IconCheckCircle className="w-3 h-3" />Published</span>
  : <span className="badge-yellow text-[10px]"><IconAlertCircle className="w-3 h-3" />Draft</span>;

const VideoStatusBadge = ({ status }) => {
  if (status === 'ready') return <span className="badge-green text-[10px]"><IconCheckCircle className="w-3 h-3" />Video Ready</span>;
  if (status === 'pending') return <span className="badge-yellow text-[10px]">Uploading...</span>;
  return <span className="badge-gray text-[10px]">No Video</span>;
};

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessonMap, setLessonMap] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [modModal, setModModal] = useState({ open: false, data: null });
  const [lesModal, setLesModal] = useState({ open: false, data: null, moduleId: null });
  const [vidUpload, setVidUpload] = useState({ open: false, lesson: null });

  const fetchAll = async () => {
    setLoading(true);
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
      setLessonMap(p => ({ ...p, [moduleId]: data.data }));
    } catch {}
  };

  useEffect(() => { fetchAll(); }, [id]);

  const toggle = async (mid) => {
    const isOpen = expanded[mid];
    setExpanded(p => ({ ...p, [mid]: !isOpen }));
    if (!isOpen && !lessonMap[mid]) await fetchLessons(mid);
  };

  const deleteModule = async (mid) => {
    if (!window.confirm('Delete module and all lessons?')) return;
    try { await modulesAPI.delete(mid); toast.success('Module deleted'); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  const deleteLesson = async (lid, mid) => {
    if (!window.confirm('Delete this lesson?')) return;
    try { await lessonsAPI.delete(lid); toast.success('Lesson deleted'); fetchLessons(mid); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  const toggleLesson = async (lesson) => {
    try { await lessonsAPI.update(lesson._id, { isPublished: !lesson.isPublished }); fetchLessons(lesson.module); }
    catch { toast.error('Failed'); }
  };

  const fmt = (s) => { if (!s) return '0:00'; return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; };

  if (loading) return (
    <div className="page-wrap space-y-4">
      <div className="skeleton h-6 w-48 rounded" />
      <div className="skeleton h-32 rounded-2xl" />
      {[...Array(3)].map((_,i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="page-wrap anim-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px]">
        <Link to="/courses" className="text-gray-500 hover:text-white transition-colors">Courses</Link>
        <IconChevronRight className="w-3.5 h-3.5 text-gray-700" />
        <span className="text-gray-300">{course?.title}</span>
      </div>

      {/* Course header card */}
      <div className="card p-5 flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-44 h-32 rounded-xl bg-gradient-to-br from-indigo-900/40 to-violet-900/40 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {course?.thumbnail
            ? <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
            : <IconCourses className="w-10 h-10 text-indigo-400/40" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 mb-2">
            <h1 className="text-xl font-bold text-white">{course?.title}</h1>
            <StatusBadge published={course?.isPublished} />
          </div>
          <p className="text-[13px] text-gray-500 line-clamp-2 mb-3">{course?.description || 'No description'}</p>
          <div className="flex flex-wrap gap-4 text-[12px] text-gray-600">
            <span className="flex items-center gap-1.5"><IconVideo className="w-3.5 h-3.5" />{course?.totalLessons} lessons</span>
            <span className="flex items-center gap-1.5"><IconClock className="w-3.5 h-3.5" />{Math.floor((course?.totalDuration||0)/60)} min total</span>
            {course?.category && <span className="badge-gray text-[11px]">{course.category}</span>}
            {course?.level && <span className="badge-blue text-[11px] capitalize">{course.level}</span>}
          </div>
        </div>
      </div>

      {/* Modules header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-white">Modules & Lessons</h2>
          <p className="text-[12px] text-gray-600 mt-0.5">{modules.length} modules</p>
        </div>
        <button onClick={() => setModModal({ open: true, data: null })} className="btn-primary">
          <IconPlus className="w-4 h-4" /> Add Module
        </button>
      </div>

      {/* Module list */}
      {modules.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
            <IconCourses className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-white font-semibold">No modules yet</p>
          <p className="text-gray-500 text-sm mt-1 mb-5">Add your first module to organize lessons</p>
          <button onClick={() => setModModal({ open: true, data: null })} className="btn-primary mx-auto">
            <IconPlus className="w-4 h-4" /> Add Module
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {modules.map((mod, idx) => (
            <div key={mod._id} className="card overflow-hidden">
              {/* Module row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => toggle(mod._id)}
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white">{mod.title}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{mod.totalLessons || lessonMap[mod._id]?.length || 0} lessons</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge published={mod.isPublished} />
                  <button onClick={e => { e.stopPropagation(); setModModal({ open: true, data: mod }); }} className="btn-icon w-7 h-7 rounded-lg">
                    <IconEdit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteModule(mod._id); }} className="btn-icon w-7 h-7 rounded-lg hover:text-rose-400">
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                  <div className={`transition-transform ${expanded[mod._id] ? 'rotate-180' : ''}`}>
                    <IconChevronDown className="w-4 h-4 text-gray-600" />
                  </div>
                </div>
              </div>

              {/* Lessons */}
              {expanded[mod._id] && (
                <div className="border-t border-white/[0.05] bg-[#0d0d14]/60 p-3 space-y-1.5">
                  {(lessonMap[mod._id] || []).map((les, li) => (
                    <div
                      key={les._id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/[0.04] text-gray-600 text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                        {li + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-200 truncate">{les.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <VideoStatusBadge status={les.uploadStatus} />
                          {les.duration > 0 && (
                            <span className="text-[10px] text-gray-600 flex items-center gap-1">
                              <IconClock className="w-3 h-3" />{fmt(les.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setVidUpload({ open: true, lesson: les })}
                          className="flex items-center gap-1.5 text-[11px] font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-500/15"
                        >
                          <IconVideo className="w-3.5 h-3.5" /> Upload
                        </button>
                        <button
                          onClick={() => toggleLesson(les)}
                          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors border ${les.isPublished ? 'bg-amber-500/10 text-amber-400 border-amber-500/15 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/20'}`}
                        >
                          {les.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button onClick={() => setLesModal({ open: true, data: les, moduleId: mod._id })} className="btn-icon w-7 h-7 rounded-lg">
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteLesson(les._id, mod._id)} className="btn-icon w-7 h-7 rounded-lg hover:text-rose-400">
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setLesModal({ open: true, data: null, moduleId: mod._id })}
                    className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.07] hover:border-indigo-500/30 text-[12px] text-gray-600 hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <IconPlus className="w-3.5 h-3.5" /> Add Lesson
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modModal.open && <ModuleModal courseId={id} module={modModal.data} onClose={() => setModModal({ open: false, data: null })} onSaved={() => { setModModal({ open: false, data: null }); fetchAll(); }} />}
      {lesModal.open && <LessonModal moduleId={lesModal.moduleId} lesson={lesModal.data} onClose={() => setLesModal({ open: false, data: null, moduleId: null })} onSaved={() => { const mid = lesModal.moduleId; setLesModal({ open: false, data: null, moduleId: null }); fetchLessons(mid); fetchAll(); }} />}
      {vidUpload.open && <VideoUploader lesson={vidUpload.lesson} onClose={() => setVidUpload({ open: false, lesson: null })} onUploaded={() => { const les = vidUpload.lesson; setVidUpload({ open: false, lesson: null }); if (les) fetchLessons(les.module); }} />}
    </div>
  );
}
