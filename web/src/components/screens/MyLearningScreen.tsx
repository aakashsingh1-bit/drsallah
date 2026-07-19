import { motion } from "framer-motion";
import { Play, CheckCircle, Clock, Loader2, Circle, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGetMyLearning, useGetWatchHistory } from "@/hooks/useCoursesHooks";
import { formatDuration, timeAgo } from "@/lib/format";

const MyLearningScreen = () => {
  const navigate = useNavigate();
  const { data: learningRes, isLoading } = useGetMyLearning();
  const { data: watchHistory = [] } = useGetWatchHistory();

  const enrolled = learningRes?.data || [];
  const totalCompleted = enrolled.reduce(
    (s: number, e: any) => s + (e.progress?.watchedLessons || 0),
    0
  );
  const inProgress = enrolled.filter((e: any) => {
    const pct = e.progress?.percentComplete || 0;
    return pct > 0 && pct < 100;
  }).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">My Learning</h1>
        <p className="text-sm text-foreground/55 mt-1">Track progress across your enrolled courses</p>
      </div>

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {[
          { value: String(totalCompleted), label: "Completed", icon: CheckCircle },
          { value: String(inProgress), label: "In progress", icon: Clock },
          { value: String(enrolled.length), label: "Enrolled", icon: BookOpen },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center"
          >
            <stat.icon size={16} className="mx-auto text-primary mb-1.5" />
            <p className="text-lg sm:text-xl font-extrabold text-foreground leading-none">{stat.value}</p>
            <p className="text-[10px] sm:text-[11px] text-foreground/45 font-medium mt-1.5">{stat.label}</p>
          </motion.div>
        ))}
      </section>

      <section>
        <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">Enrolled courses</h2>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : enrolled.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <p className="text-sm text-foreground/50 mb-3">No enrolled courses yet.</p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/courses")}
              className="text-sm font-bold text-primary"
            >
              Browse courses
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {enrolled.map((item: any, i: number) => {
              const pct = item.progress?.percentComplete || 0;
              const lastLessonId =
                typeof item.progress?.lastLessonId === "string"
                  ? item.progress.lastLessonId
                  : item.progress?.lastLessonId?._id || item.progress?.lastLessonId?.toString?.();
              return (
                <motion.button
                  key={item.enrollment?.purchaseId || item.course._id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() =>
                    navigate(`/course-player/${item.course._id}`, {
                      state: {
                        course: item.course,
                        lessonId: lastLessonId,
                        from: "/dashboard/learning",
                      },
                    })
                  }
                  className="text-left bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div className="relative aspect-[16/9] bg-secondary">
                    {item.course.thumbnail ? (
                      <img src={item.course.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/65 via-foreground/15 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg">
                        <Play size={18} className="ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                    {pct > 0 && pct < 100 && (
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
                        Continue
                      </span>
                    )}
                    <span className="absolute bottom-2.5 right-2.5 text-[11px] font-bold text-white bg-foreground/50 backdrop-blur px-2 py-0.5 rounded-md">
                      {pct}%
                    </span>
                  </div>
                  <div className="p-3.5 sm:p-4">
                    <h3 className="text-sm font-bold text-foreground line-clamp-1">{item.course.title}</h3>
                    <div className="mt-2.5 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-foreground/45 mt-2 gap-2">
                      <span>
                        {item.progress?.watchedLessons || 0}/{item.progress?.totalLessons || 0} lessons
                      </span>
                      {item.enrollment?.daysRemaining != null && (
                        <span className="shrink-0">{item.enrollment.daysRemaining}d left</span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>

      {watchHistory.length > 0 && (
        <section>
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">Recent activity</h2>
          <div className="space-y-2">
            {watchHistory.slice(0, 8).map((entry: any) => {
              const lessonId = entry.lesson?._id || entry.lesson;
              const courseId = entry.lesson?.course;
              const completed = entry.watchProgress?.completed;
              const percent = entry.watchProgress?.percent || 0;
              return (
                <button
                  key={`${lessonId}-${entry.watchedAt}`}
                  type="button"
                  onClick={() => {
                    if (courseId && lessonId) {
                      navigate(`/course-player/${courseId}`, {
                        state: { lessonId, from: "/dashboard/learning" },
                      });
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 sm:p-3.5 bg-card rounded-xl border border-border text-left hover:bg-secondary/40 transition-colors"
                >
                  {completed ? (
                    <CheckCircle size={16} className="text-success shrink-0" />
                  ) : percent > 0 ? (
                    <Clock size={16} className="text-primary shrink-0" />
                  ) : (
                    <Circle size={16} className="text-foreground/30 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {entry.lesson?.title || "Lesson"}
                    </p>
                    <p className="text-[11px] text-foreground/45">
                      {completed ? "Completed" : percent > 0 ? `${percent}% watched` : "Started"} ·{" "}
                      {timeAgo(entry.watchedAt)}
                    </p>
                  </div>
                  <span className="text-[11px] text-foreground/40 shrink-0">
                    {formatDuration(entry.watchProgress?.position ?? entry.progress)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default MyLearningScreen;
