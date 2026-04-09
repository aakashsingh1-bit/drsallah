import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { coursesAPI, lessonsAPI, modulesAPI } from '../api';
import toast from 'react-hot-toast';
import ModuleModal from '../components/ModuleModal';
import LessonModal from '../components/LessonModal';
import VideoUploader from '../components/VideoUploader';
import {
  IconPlus, IconEdit, IconTrash, IconVideo, IconClock, IconCourses,
  IconChevronDown, IconChevronRight, IconCheckCircle, IconAlertCircle,
} from '../components/Icons';

const StatusBadge = ({ published }) => published
  ? <span className="badge-green"><IconCheckCircle className="w-3 h-3" />Published</span>
  : <span className="badge-yellow"><IconAlertCircle className="w-3 h-3" />Draft</span>;

const VideoStatusBadge = ({ status }) => {
  if (status === 'ready') return <span className="badge-green"><IconCheckCircle className="w-3 h-3" />Video Ready</span>;
  if (status === 'pending') return <span className="badge-yellow">Uploading...</span>;
  return <span className="badge-gray">No Video</span>;
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
      setCourse(data.data); setModules(data.data.modules || []);
    } catch { toast.error('Failed to load course'); }
    finally { setLoading(false); }
  };

  const fetchLessons = async (mid) => {
    try { const { data } = await lessonsAPI.getByModule(mid); setLessonMap(p => ({ ...p, [mid]: data.data })); }
    catch {}
  };

  useEffect(() => { fetchAll(); }, [id]);

  const toggle = async (mid) => {
    const isOpen = expanded[mid];
    setExpanded(p => ({ ...p, [mid]: !isOpen }));
    if (!isOpen && !lessonMap[mid]) await fetchLessons(mid);
  };

  const delModule = async (mid) => {
    if (!window.confirm('Delete module and all lessons?')) return;
    try { await modulesAPI.delete(mid); toast.success('Module deleted'); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  const delLesson = async (lid, mid) => {
    if (!window.confirm('Delete this lesson?')) return;
    try { await lessonsAPI.delete(lid); toast.success('Deleted'); fetchLessons(mid); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  const toggleLesson = async (lesson) => {
    try { await lessonsAPI.update(lesson._id, { isPublished: !lesson.isPublished }); fetchLessons(lesson.module); }
    catch { toast.error('Failed'); }
  };

  const fmt = s => !s ? '0:00' : `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) return (
    <div className="page-wrap space-y-4">
      <div className="skeleton h-6 w-48 rounded" />
      <div className="skeleton h-32 rounded-xl" />
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
    </div>
  );

  return (
    <div className="page-wrap animate-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px]">
        <Link to="/courses" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">Courses</Link>
        <IconChevronRight className="w-3.5 h-3.5 text-[#b0afab]" />
        <span className="text-[#6a6f73]">{course?.title}</span>
      </div>

      {/* Course header */}
      <div className="card p-5 flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-44 h-28 rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {course?.thumbnail ? <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" /> : <IconCourses className="w-10 h-10 text-violet-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 mb-2">
            <h1 className="text-[18px] font-bold text-[#1c1d1f]">{course?.title}</h1>
            <StatusBadge published={course?.isPublished} />
          </div>
          <p className="text-[13px] text-[#6a6f73] line-clamp-2 mb-2">{course?.description || 'No description'}</p>
          <div className="flex flex-wrap gap-4 text-[12px] text-[#9e9e9e]">
            <span className="flex items-center gap-1.5"><IconVideo className="w-3.5 h-3.5" />{course?.totalLessons} lessons</span>
            <span className="flex items-center gap-1.5"><IconClock className="w-3.5 h-3.5" />{Math.floor((course?.totalDuration || 0) / 60)} min total</span>
            {course?.category && <span className="badge-gray">{course.category}</span>}
            {course?.level && <span className="badge-blue capitalize">{course.level}</span>}
          </div>
        </div>
      </div>

      {/* Modules header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-title">Modules & Lessons</p>
          <p className="section-sub">{modules.length} modules</p>
        </div>
        <button onClick={() => setModModal({ open: true, data: null })} className="btn-primary"><IconPlus className="w-4 h-4" />Add Module</button>
      </div>

      {/* Module list */}
      {modules.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
            <IconCourses className="w-6 h-6 text-violet-500" />
          </div>
          <p className="text-[15px] font-bold text-[#1c1d1f]">No modules yet</p>
          <p className="text-[13px] text-[#6a6f73] mt-1 mb-5">Add your first module to organize lessons</p>
          <button onClick={() => setModModal({ open: true, data: null })} className="btn-primary mx-auto"><IconPlus className="w-4 h-4" />Add Module</button>
        </div>
      ) : (
        <div className="space-y-2">
          {modules.map((mod, idx) => (
            <div key={mod._id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#faf9f6] transition-colors" onClick={() => toggle(mod._id)}>
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 text-[12px] font-bold flex items-center justify-center flex-shrink-0 border border-brand-100">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1c1d1f]">{mod.title}</p>
                  <p className="text-[11px] text-[#9e9e9e] mt-0.5">{mod.totalLessons || lessonMap[mod._id]?.length || 0} lessons</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge published={mod.isPublished} />
                  <button onClick={e => { e.stopPropagation(); setModModal({ open: true, data: mod }); }} className="btn-icon"><IconEdit className="w-3.5 h-3.5" /></button>
                  <button onClick={e => { e.stopPropagation(); delModule(mod._id); }} className="btn-icon hover:bg-red-50 hover:text-red-600"><IconTrash className="w-3.5 h-3.5" /></button>
                  <div className={`transition-transform duration-200 ${expanded[mod._id] ? 'rotate-180' : ''}`}>
                    <IconChevronDown className="w-4 h-4 text-[#9e9e9e]" />
                  </div>
                </div>
              </div>

              {expanded[mod._id] && (
                <div className="border-t border-[#f0ece4] bg-[#faf9f6] p-3 space-y-1.5">
                  {(lessonMap[mod._id] || []).map((les, li) => (
                    <div key={les._id} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#f0ece4] hover:border-[#e0ddd6] hover:shadow-soft transition-all group">
                      <div className="w-7 h-7 rounded-md bg-[#f5f4f0] text-[#6a6f73] text-[11px] font-semibold flex items-center justify-center flex-shrink-0">{li + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1c1d1f] truncate">{les.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <VideoStatusBadge status={les.uploadStatus} />
                          {les.duration > 0 && <span className="text-[10px] text-[#9e9e9e] flex items-center gap-1"><IconClock className="w-3 h-3" />{fmt(les.duration)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setVidUpload({ open: true, lesson: les })}
                          className="text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors border border-blue-200 flex items-center gap-1">
                          <IconVideo className="w-3.5 h-3.5" />Upload
                        </button>
                        <button onClick={() => toggleLesson(les)}
                          className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-colors border ${les.isPublished ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
                          {les.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button onClick={() => setLesModal({ open: true, data: les, moduleId: mod._id })} className="btn-icon"><IconEdit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => delLesson(les._id, mod._id)} className="btn-icon hover:bg-red-50 hover:text-red-600"><IconTrash className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setLesModal({ open: true, data: null, moduleId: mod._id })}
                    className="w-full py-2.5 rounded-lg border border-dashed border-[#d1d0cc] hover:border-brand-400 text-[12px] text-[#9e9e9e] hover:text-brand-600 transition-colors flex items-center justify-center gap-1.5">
                    <IconPlus className="w-3.5 h-3.5" />Add Lesson
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
