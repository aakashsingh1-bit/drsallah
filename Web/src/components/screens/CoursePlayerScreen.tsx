import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Play,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "../PageHeader";
import {
  useGetCourseContent,
  useGetLessonStream,
  useUpdateWatchHistory,
  useSubmitReview,
  useGetBookmarks,
  useToggleBookmark,
} from "@/hooks/useCoursesHooks";
import { formatDuration } from "@/lib/format";
import {
  shouldSaveWatchProgress,
  getResumePosition,
  getWatchProgressForLesson,
} from "@/lib/watchProgress";
import { toast } from "sonner";

const CoursePlayerScreen = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { courseId = "" } = useParams();
  const location = useLocation();
  const initialLessonId = (location.state as { lessonId?: string })?.lessonId;
  const stateCourse = (location.state as { course?: any })?.course;

  const { data: content, isLoading, error: contentError } = useGetCourseContent(courseId);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [resumeHint, setResumeHint] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaveRef = useRef({ at: 0, progress: -1, lessonId: "" });
  const resumeAppliedRef = useRef<string | null>(null);

  const { mutate: saveProgress } = useUpdateWatchHistory();

  const hasAccess = content?.access?.hasAccess ?? false;
  const courseProgress = content?.courseProgress;
  const modules = content?.modules || [];
  const flatLessons = useMemo(
    () => modules.flatMap((m: any) => (m.lessons || []).map((l: any) => ({ ...l, moduleTitle: m.title }))),
    [modules]
  );

  const activeLesson = flatLessons.find((l: any) => l._id === activeLessonId);
  const useFreeEndpoint = Boolean(activeLesson?.isFree);

  const {
    data: streamData,
    isLoading: streamLoading,
    isError: streamError,
    error: streamErr,
  } = useGetLessonStream(activeLessonId || undefined, useFreeEndpoint);

  const { mutate: submitReview, isPending: reviewPending } = useSubmitReview();
  const { data: bookmarks = [] } = useGetBookmarks();
  const { mutate: toggleBookmark } = useToggleBookmark();

  const isBookmarked = bookmarks.some((b: any) => b._id === activeLessonId);
  const activeIndex = flatLessons.findIndex((l: any) => l._id === activeLessonId);
  const activeWatch = activeLesson ? getWatchProgressForLesson(activeLesson) : null;

  const canPlayLesson = (lesson: any) => {
    if (lesson.isLocked) return false;
    if (hasAccess) return true;
    return Boolean(lesson.isFree);
  };

  useEffect(() => {
    if (!activeLessonId && flatLessons.length) {
      const continueId = courseProgress?.lastLessonId || initialLessonId;
      const preferred = continueId ? flatLessons.find((l: any) => l._id === continueId) : null;
      const start =
        preferred && canPlayLesson(preferred)
          ? preferred
          : flatLessons.find((l: any) => canPlayLesson(l));
      if (start) {
        setActiveLessonId(start._id);
        const modIndex = modules.findIndex((m: any) =>
          (m.lessons || []).some((l: any) => l._id === start._id)
        );
        if (modIndex >= 0) setExpandedModule(modIndex);
      }
    }
  }, [flatLessons, activeLessonId, initialLessonId, hasAccess, courseProgress?.lastLessonId, modules]);

  useEffect(() => {
    if (activeLesson?.requiresReview && activeLesson?.isLocked) {
      setShowReview(true);
    }
  }, [activeLesson]);

  const flushProgress = useCallback(
    (force = false) => {
      const v = videoRef.current;
      if (!v || !activeLessonId) return;
      const duration = activeLesson?.duration || 0;
      const atEnd = duration > 0 && v.currentTime >= duration - 2;
      const progress = atEnd ? duration : Math.floor(v.currentTime);
      if (progress <= 0) return;
      const last = lastSaveRef.current;
      if (
        !force &&
        last.lessonId === activeLessonId &&
        !shouldSaveWatchProgress(last.at, last.progress, progress)
      ) {
        return;
      }
      lastSaveRef.current = { at: Date.now(), progress, lessonId: activeLessonId };
      saveProgress({ lessonId: activeLessonId, progress });
    },
    [activeLessonId, activeLesson?.duration, saveProgress]
  );

  useEffect(() => {
    lastSaveRef.current = { at: 0, progress: -1, lessonId: activeLessonId || "" };
    resumeAppliedRef.current = null;
    setResumeHint(null);
  }, [activeLessonId]);

  useEffect(() => {
    return () => {
      flushProgress(true);
    };
  }, [activeLessonId, flushProgress]);

  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ["myLearning"] });
      queryClient.invalidateQueries({ queryKey: ["courseContent", courseId] });
    };
  }, [queryClient, courseId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !streamData?.streamUrl || !activeLessonId || !activeLesson) return;

    const savedPosition = getWatchProgressForLesson(activeLesson).position || 0;
    const resumeAt = getResumePosition(savedPosition, activeLesson.duration || 0);

    const applyResume = () => {
      if (resumeAppliedRef.current === activeLessonId) return;
      resumeAppliedRef.current = activeLessonId;
      if (resumeAt > 0) {
        v.currentTime = resumeAt;
        setResumeHint(`Resumed from ${formatDuration(resumeAt)}`);
      }
      v.play().catch(() => {});
    };

    v.addEventListener("loadedmetadata", applyResume);
    v.load();

    return () => v.removeEventListener("loadedmetadata", applyResume);
  }, [streamData?.streamUrl, activeLessonId, activeLesson]);

  const onTimeUpdate = () => flushProgress(false);
  const onPause = () => flushProgress(true);
  const onEnded = () => flushProgress(true);

  const goToLesson = (lesson: any) => {
    console.log("lesson", lesson);
    console.log("canPlayLesson", canPlayLesson(lesson));
    console.log("hasAccess", hasAccess);
    console.log(hasAccess);
    if (!canPlayLesson(lesson)) {
      if (!hasAccess) {
        toast.error("Enroll to watch this lesson");
        navigate(`/purchase-course/${courseId}`, { state: { course: stateCourse || content } });
      }
      return;
    }
    flushProgress(true);
    setActiveLessonId(lesson._id);
  };

  const goNext = () => {
    const next = flatLessons.slice(activeIndex + 1).find((l) => canPlayLesson(l));
    if (next) goToLesson(next);
  };

  const goPrev = () => {
    const prev = [...flatLessons.slice(0, activeIndex)].reverse().find((l) => canPlayLesson(l));
    if (prev) goToLesson(prev);
  };

  const handleSubmitReview = () => {
    submitReview(
      { courseId, rating, comment },
      {
        onSuccess: () => {
          setShowReview(false);
          toast.success("Review submitted — final lesson unlocked");
          queryClient.invalidateQueries({ queryKey: ["courseContent", courseId] });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (contentError || !content) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="text-foreground font-semibold mb-2">Could not load course</p>
        <p className="text-sm text-foreground/60 mb-4">Please try again or enroll in this course.</p>
        <button onClick={() => navigate(`/course-detail/${courseId}`)} className="text-primary font-semibold">
          Back to course
        </button>
      </div>
    );
  }

  const streamErrorMsg = (streamErr as Error)?.message;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={content.title}
        subtitle={`Lesson ${activeIndex + 1} of ${flatLessons.length}`}
        onBack={() => navigate(hasAccess ? "/dashboard/learning" : `/course-detail/${courseId}`)}
        badge="Now playing"
      />

      {courseProgress && (
        <div className="max-w-7xl mx-auto px-5 lg:px-8 mt-2 mb-2">
          <div className="flex items-center justify-between text-xs text-foreground/60 mb-1">
            <span>Course progress</span>
            <span className="font-semibold text-accent">{courseProgress.percentComplete || 0}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full gradient-warm rounded-full transition-all"
              style={{ width: `${courseProgress.percentComplete || 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-5 lg:p-8 grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-4">
          <div className="bg-black rounded-2xl overflow-hidden aspect-video relative shadow-xl">
            {streamLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-white" />
                <span className="text-white/60 text-sm">Loading video…</span>
              </div>
            ) : streamData?.streamUrl ? (
              <video
                ref={videoRef}
                key={`${activeLessonId}-${streamData.streamUrl}`}
                src={streamData.streamUrl}
                controls
                controlsList="nodownload"
                playsInline
                className="w-full h-full bg-black"
                onTimeUpdate={onTimeUpdate}
                onPause={onPause}
                onEnded={onEnded}
                onContextMenu={(e) => e.preventDefault()}
              />
            ) : activeLesson?.isLocked ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                <Lock size={40} className="mb-3 opacity-80" />
                <p className="font-semibold mb-1">Final lesson locked</p>
                <p className="text-sm text-white/70 mb-4">Submit a course review to unlock</p>
                <button onClick={() => setShowReview(true)} className="px-5 py-2.5 gradient-warm rounded-xl text-sm font-bold">
                  Leave review
                </button>
              </div>
            ) : streamError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                <Lock size={40} className="mb-3 opacity-80" />
                <p className="font-semibold mb-1">{streamErrorMsg || "Cannot play this lesson"}</p>
                {!hasAccess && (
                  <button
                    onClick={() => navigate(`/purchase-course/${courseId}`, { state: { course: content } })}
                    className="mt-4 px-5 py-2.5 gradient-warm rounded-xl text-sm font-bold flex items-center gap-2"
                  >
                    <BookOpen size={16} /> Enroll to watch
                  </button>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/60">
                Select a lesson from the curriculum
              </div>
            )}
          </div>

          {activeLesson && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs text-foreground/50 font-medium mb-1">{activeLesson.moduleTitle}</p>
                  <h2 className="text-xl font-bold text-foreground">{activeLesson.title}</h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-foreground/60">
                    <span>{formatDuration(activeLesson.duration)}</span>
                    {activeWatch?.completed && (
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <CheckCircle2 size={14} /> Completed
                      </span>
                    )}
                    {resumeHint && !activeWatch?.completed && (
                      <span className="text-xs text-primary font-medium">{resumeHint}</span>
                    )}
                  </div>
                  {!activeWatch?.completed && (activeWatch?.percent || 0) > 0 && (
                    <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${activeWatch?.percent || 0}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => activeLessonId && toggleBookmark(activeLessonId)}
                  className="p-2.5 rounded-xl border border-border hover:bg-secondary shrink-0"
                  title={isBookmarked ? "Remove bookmark" : "Bookmark lesson"}
                >
                  <Bookmark size={18} className={isBookmarked ? "text-accent fill-accent" : "text-foreground/50"} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={activeIndex <= 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border text-sm font-semibold disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={goNext}
                  disabled={activeIndex >= flatLessons.length - 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl gradient-warm text-accent-foreground text-sm font-bold disabled:opacity-40"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="bg-card border border-border rounded-2xl overflow-hidden  max-h-[calc(100vh-120px)] flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-bold text-foreground text-sm">Course content</h3>
            <p className="text-xs text-foreground/50">
              {courseProgress?.watchedLessons || 0}/{courseProgress?.totalLessons || flatLessons.length} lessons complete
            </p>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {modules.map((mod: any, mi: number) => (
              <div key={mod._id} className="rounded-xl overflow-hidden border border-border/50">
                <button
                  onClick={() => setExpandedModule(expandedModule === mi ? -1 : mi)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-secondary/40 text-left text-sm font-semibold"
                >
                  <span className="flex-1 truncate">{mod.title}</span>
                  {expandedModule === mi ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {expandedModule === mi && (
                  <div className="divide-y divide-border/50">
                    {(mod.lessons || []).map((lesson: any) => {
                      const playable = canPlayLesson(lesson);
                      const isActive = activeLessonId === lesson._id;
                      const wp = getWatchProgressForLesson(lesson);
                      return (
                        <button
                          key={lesson._id}
                          onClick={() => {
                            if(!isActive && !playable)
                              setShowReview(true);
                            
                            goToLesson(lesson);
                          }
                          }
                          className={`w-full flex flex-col gap-1 px-3 py-2.5 text-left text-xs transition-colors ${
                            isActive ? "bg-primary/10 text-primary" : playable ? "hover:bg-secondary/50" : "opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {wp.completed ? (
                              <CheckCircle2 size={12} className="text-success shrink-0" />
                            ) : playable ? (
                              <Play size={12} className={isActive ? "text-primary" : "text-foreground/40"} fill="currentColor" />
                            ) : (
                              <Lock size={12} className="text-foreground/30" />
                            )}
                            <span className="flex-1 truncate">{lesson.title}</span>
                            <span className="text-[10px] text-foreground/40 shrink-0">
                              {wp.completed ? "Done" : wp.percent ? `${wp.percent}%` : formatDuration(lesson.duration)}
                            </span>
                          </div>
                          {!wp.completed && (wp.percent || 0) > 0 && (
                            <div className="h-0.5 bg-secondary rounded-full overflow-hidden ml-5">
                              <div className="h-full bg-primary/70 rounded-full" style={{ width: `${wp.percent}%` }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {showReview && (
        <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg">Course review</h3>
            <p className="text-sm text-foreground/60">Rate this course to unlock the final lesson</p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className={`text-3xl ${n <= rating ? "text-accent" : "text-foreground/20"}`}>
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience (optional)"
              className="w-full bg-secondary rounded-xl p-3 text-sm min-h-[90px] border border-border"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowReview(false)} className="flex-1 py-2.5 rounded-xl border font-semibold text-sm">
                Cancel
              </button>
              <button disabled={reviewPending} onClick={handleSubmitReview} className="flex-1 py-2.5 rounded-xl gradient-warm font-bold text-sm">
                Submit review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursePlayerScreen;
