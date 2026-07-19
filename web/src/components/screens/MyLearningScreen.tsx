import { motion } from "framer-motion";
import { Play, CheckCircle, Clock, BookOpen, Loader2, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGetMyLearning, useGetWatchHistory } from "@/hooks/useCoursesHooks";
import { formatDuration, timeAgo } from "@/lib/format";

const MyLearningScreen = () => {
  const navigate = useNavigate();
  const { data: learningRes, isLoading } = useGetMyLearning();
  const { data: watchHistory = [] } = useGetWatchHistory();

  const enrolled = learningRes?.data || [];
  const totalCompleted = enrolled.reduce((s: number, e: any) => s + (e.progress?.watchedLessons || 0), 0);
  const inProgress = enrolled.filter((e: any) => {
    const pct = e.progress?.percentComplete || 0;
    return pct > 0 && pct < 100;
  }).length;

  return (
    <div className="pb-4">
      <div className="gradient-hero px-5 pt-4 pb-5 rounded-b-[2rem]">
        <h1 className="text-lg font-bold text-primary-foreground mb-1">My Learning</h1>
        <p className="text-xs text-primary-foreground/70 font-medium mb-4">Track your progress</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { value: String(totalCompleted), label: "Completed", color: "text-accent" },
            { value: String(inProgress), label: "In Progress", color: "text-primary-foreground" },
            { value: String(enrolled.length), label: "Enrolled", color: "text-primary-foreground" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-3 text-center"
            >
              <span className={`text-lg font-extrabold ${stat.color}`}>{stat.value}</span>
              <p className="text-[10px] text-primary-foreground/60 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5 mb-5">
        <h2 className="text-sm font-bold text-foreground mb-3">Enrolled Courses</h2>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin" />
          </div>
        ) : enrolled.length === 0 ? (
          <div className="text-center py-10 text-foreground/50 text-sm">
            No enrolled courses yet.{" "}
            <button onClick={() => navigate("/dashboard/courses")} className="text-primary font-semibold">
              Browse courses
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {enrolled.map((item: any, i: number) => {
              const pct = item.progress?.percentComplete || 0;
              const lastLessonId =
                typeof item.progress?.lastLessonId === "string"
                  ? item.progress.lastLessonId
                  : item.progress?.lastLessonId?._id || item.progress?.lastLessonId?.toString?.();
              return (
                <motion.button
                  key={item.enrollment?.purchaseId || item.course._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() =>
                    navigate(`/course-player/${item.course._id}`, {
                      state: {
                        course: item.course,
                        lessonId: lastLessonId,
                        from: "/dashboard/learning",
                      },
                    })
                  }
                  className="w-full text-left bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="relative">
                    <img src={item.course.thumbnail} alt="" className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-foreground/30 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full gradient-warm flex items-center justify-center shadow-xl">
                        <Play size={22} className="text-accent-foreground ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                    {pct > 0 && pct < 100 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        Continue
                      </span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-sm font-bold text-foreground line-clamp-1">{item.course.title}</h3>
                      <span className="text-xs font-bold text-accent shrink-0 ml-2">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                      <div className="h-full gradient-warm rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-foreground/50">
                      <span>
                        {item.progress?.watchedLessons || 0}/{item.progress?.totalLessons || 0} lessons complete
                      </span>
                      <span>{item.enrollment?.daysRemaining} days left</span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {watchHistory.length > 0 && (
        <div className="px-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {watchHistory.slice(0, 5).map((entry: any) => {
              const lessonId = entry.lesson?._id || entry.lesson;
              const courseId = entry.lesson?.course;
              const completed = entry.watchProgress?.completed;
              const percent = entry.watchProgress?.percent || 0;
              return (
                <button
                  key={`${lessonId}-${entry.watchedAt}`}
                  onClick={() => {
                    if (courseId && lessonId) {
                      navigate(`/course-player/${courseId}`, {
                        state: { lessonId, from: "/dashboard/learning" },
                      });
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border text-left hover:bg-secondary/30 transition-colors"
                >
                  {completed ? (
                    <CheckCircle size={16} className="text-success shrink-0" />
                  ) : percent > 0 ? (
                    <Clock size={16} className="text-primary shrink-0" />
                  ) : (
                    <Circle size={16} className="text-foreground/30 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.lesson?.title || "Lesson"}</p>
                    <p className="text-xs text-foreground/50">
                      {completed ? "Completed" : percent > 0 ? `${percent}% watched` : "Started"} · {timeAgo(entry.watchedAt)}
                    </p>
                  </div>
                  <span className="text-xs text-foreground/40 shrink-0">
                    {formatDuration(entry.watchProgress?.position ?? entry.progress)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLearningScreen;
