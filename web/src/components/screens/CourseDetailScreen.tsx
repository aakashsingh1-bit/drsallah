import { useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Star,
  Clock,
  Users,
  Play,
  Lock,
  ShieldCheck,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Award,
  Globe,
  Video,
} from "lucide-react";
import { PageHeader } from "../PageHeader";
import { useGetCourse, useGetCourseContent, useGetCourseReviews } from "@/hooks/useCoursesHooks";
import { formatDuration, formatPrice } from "@/lib/format";
import { Loader2 } from "lucide-react";

const CourseDetailScreen = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const location = useLocation();
  const stateCourse = (location.state as { course?: any })?.course;
  const [activeTab, setActiveTab] = useState<"overview" | "curriculum" | "reviews">("overview");
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({ 0: true });

  const { data: courseData, isLoading } = useGetCourse(id);
  const { data: content, isLoading: contentLoading } = useGetCourseContent(id);
  const { data: reviews = [] } = useGetCourseReviews(id);

  const course = courseData || stateCourse;
  const modules = content?.modules || [];
  const hasAccess = content?.access?.hasAccess ?? course?.access?.hasAccess;
  const activeTiers = (course?.priceTiers || []).filter((t: any) => t.isActive);

  const stats = useMemo(() => {
    const lessonCount = modules.reduce((n: number, m: any) => n + (m.lessons?.length || 0), 0);
    const freeCount = modules.reduce(
      (n: number, m: any) => n + (m.lessons || []).filter((l: any) => l.isFree).length,
      0
    );
    return { lessonCount, freeCount, moduleCount: modules.length };
  }, [modules]);

  const toggleModule = (i: number) => {
    setExpandedModules((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const playLesson = (lesson: any) => {
    if (!lesson.isFree && !hasAccess) {
      navigate(`/purchase-course/${id}`, { state: { course } });
      return;
    }
    navigate(`/course-player/${id}`, { state: { lessonId: lesson._id, course } });
  };

  if (isLoading && !course) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!course) {
    return <div className="p-8 text-center">Course not found</div>;
  }

  const includes = [
    `${stats.lessonCount || course.totalLessons} on-demand video lessons`,
    "DRM protected secure streaming",
    "Watch on mobile, tablet & desktop",
    "Progress tracking & resume playback",
    stats.freeCount > 0 ? `${stats.freeCount} free preview lesson(s)` : "Lifetime access during enrollment",
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={course.title}
        subtitle="Course details"
        onBack={() => navigate(-1)}
        badge=""
        right={
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10">
            <ShieldCheck size={12} className="text-primary" />
            <span className="text-xs font-bold text-primary">DRM Protected</span>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto p-5 lg:p-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero */}
            <div className="relative rounded-2xl overflow-hidden border border-border">
              <img src={course.thumbnail} alt={course.title} className="w-full h-56 sm:h-72 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                {course.category && (
                  <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-accent text-accent-foreground mb-2">
                    {course.category}
                  </span>
                )}
                <h1 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground mb-3">{course.title}</h1>
                <p className="text-sm text-primary-foreground/80 line-clamp-2 mb-3">{course.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-accent font-bold">
                    <Star size={14} fill="currentColor" /> {course.rating?.average?.toFixed(1) || "—"}
                    {reviews.length > 0 && (
                      <span className="text-primary-foreground/70 font-normal">({reviews.length} reviews)</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-primary-foreground/80">
                    <Users size={14} /> {course.totalEnrolled || 0} students
                  </span>
                  <span className="flex items-center gap-1 text-primary-foreground/80">
                    <Clock size={14} /> {formatDuration(course.totalDuration)}
                  </span>
                  <span className="flex items-center gap-1 text-primary-foreground/80">
                    <Video size={14} /> {stats.lessonCount || course.totalLessons} lessons
                  </span>
                </div>
              </div>
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border">
              <img src={course.thumbnail} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-accent/30" />
              <div>
                <p className="text-xs text-foreground/50 font-medium">Instructor</p>
                <p className="font-bold text-foreground">{course.instructor || "Dr. Salah Alzait"}</p>
                <p className="text-xs text-foreground/60">Clinical exam preparation specialist</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              {(["overview", "curriculum", "reviews"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-foreground/50 hover:text-foreground"
                  }`}
                >
                  {tab}
                  {tab === "reviews" && reviews.length > 0 && (
                    <span className="ml-1 text-xs">({reviews.length})</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-3">What you&apos;ll learn</h2>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {includes.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm text-foreground/75">
                        <CheckCircle size={16} className="text-success shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-2">About this course</h2>
                  <p className="text-sm text-foreground/65 leading-relaxed whitespace-pre-line">{course.description}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: BookOpen, label: "Modules", value: String(stats.moduleCount) },
                    { icon: Video, label: "Lessons", value: String(stats.lessonCount || course.totalLessons) },
                    { icon: Clock, label: "Duration", value: formatDuration(course.totalDuration) },
                    { icon: Globe, label: "Language", value: "English" },
                  ].map((s) => (
                    <div key={s.label} className="bg-secondary/50 rounded-xl p-3 text-center">
                      <s.icon size={18} className="mx-auto text-primary mb-1" />
                      <p className="font-bold text-foreground text-sm">{s.value}</p>
                      <p className="text-[10px] text-foreground/50">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "curriculum" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-foreground">Course content</h2>
                  <p className="text-xs text-foreground/50">
                    {stats.moduleCount} modules · {stats.lessonCount} lessons · {formatDuration(course.totalDuration)}
                  </p>
                </div>
                {contentLoading ? (
                  <Loader2 className="animate-spin mx-auto" />
                ) : (
                  <div className="space-y-2">
                    {modules.map((mod: any, mi: number) => (
                      <div key={mod._id || mi} className="bg-card rounded-xl border border-border overflow-hidden">
                        <button
                          onClick={() => toggleModule(mi)}
                          className="w-full px-4 py-3 bg-secondary/40 flex items-center gap-2 text-left hover:bg-secondary/60"
                        >
                          <div className="w-7 h-7 rounded-md gradient-primary flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary-foreground">{mi + 1}</span>
                          </div>
                          <h4 className="text-sm font-bold text-foreground flex-1">{mod.title}</h4>
                          <span className="text-xs text-foreground/50 mr-2">
                            {mod.lessons?.length || 0} lessons
                          </span>
                          {expandedModules[mi] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expandedModules[mi] && (
                          <div className="divide-y divide-border">
                            {(mod.lessons || []).map((l: any) => {
                              const locked = !l.isFree && !hasAccess;
                              return (
                                <button
                                  key={l._id}
                                  onClick={() => playLesson(l)}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 text-left transition-colors"
                                >
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      locked ? "bg-muted" : "bg-primary/10"
                                    }`}
                                  >
                                    {locked ? (
                                      <Lock size={13} className="text-foreground/30" />
                                    ) : (
                                      <Play size={14} className="text-primary ml-0.5" fill="currentColor" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{l.title}</p>
                                    <span className="text-xs text-foreground/40">{formatDuration(l.duration)}</span>
                                  </div>
                                  {l.isFree && (
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                      Preview
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-4">Student reviews</h2>
                {reviews.length === 0 ? (
                  <p className="text-sm text-foreground/50 py-8 text-center">No reviews yet. Be the first after completing the course!</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((r: any) => (
                      <div key={r._id} className="bg-card rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full gradient-warm flex items-center justify-center text-xs font-bold text-accent-foreground">
                              {(r.user?.name || "S").charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-foreground">{r.user?.name || "Student"}</span>
                          </div>
                          <span className="text-accent text-sm">{"★".repeat(r.rating)}</span>
                        </div>
                        {r.comment && <p className="text-sm text-foreground/65 leading-relaxed">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 self-start">
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="relative">
                <img src={course.thumbnail} alt="" className="w-full h-40 object-cover" />
                {stats.freeCount > 0 && !hasAccess && (
                  <button
                    onClick={() => {
                      const free = modules.flatMap((m: any) => m.lessons || []).find((l: any) => l.isFree);
                      if (free) playLesson(free);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-foreground/30 hover:bg-foreground/40 transition-colors group"
                  >
                    <div className="w-16 h-16 rounded-full gradient-warm flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                      <Play size={28} className="text-accent-foreground ml-1" fill="currentColor" />
                    </div>
                  </button>
                )}
              </div>
              <div className="p-6 space-y-4">
                {hasAccess ? (
                  <>
                    <div className="flex items-center gap-2 text-success text-sm font-bold">
                      <Award size={16} /> You&apos;re enrolled
                    </div>
                    <button
                      onClick={() => navigate(`/course-player/${id}`, { state: { course } })}
                      className="w-full gradient-warm text-accent-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                      <Play size={16} /> Continue learning
                    </button>
                  </>
                ) : (
                  <>
                    {activeTiers.length > 0 && (
                      <div>
                        <p className="text-3xl font-extrabold text-primary">
                          {formatPrice(activeTiers[0].price, activeTiers[0].currency)}
                        </p>
                        {activeTiers.length > 1 && (
                          <p className="text-xs text-foreground/50 mt-1">
                            From {activeTiers.length} plan options
                          </p>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/purchase-course/${id}`, { state: { course } })}
                      className="w-full gradient-warm text-accent-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                      <BookOpen size={16} /> Enroll now
                    </button>
                    {stats.freeCount > 0 && (
                      <button
                        onClick={() => {
                          const free = modules.flatMap((m: any) => m.lessons || []).find((l: any) => l.isFree);
                          if (free) playLesson(free);
                        }}
                        className="w-full py-3 rounded-xl border border-primary text-primary text-sm font-bold hover:bg-primary/5"
                      >
                        Preview free lessons
                      </button>
                    )}
                  </>
                )}
                <div className="space-y-2 text-xs border-t border-border pt-4">
                  {includes.slice(0, 4).map((item) => (
                    <p key={item} className="flex items-center gap-2 text-foreground/70">
                      <CheckCircle size={14} className="text-success shrink-0" /> {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailScreen;
