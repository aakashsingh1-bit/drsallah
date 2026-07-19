import { motion } from "framer-motion";
import { BookOpen, CheckCircle, Clock, Award, ArrowRight, Play, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CourseCard } from "@/components/CourseCard";
import { useGetProfile } from "@/hooks/userAuthHooks";
import { useGetCourses, useGetMyLearning } from "@/hooks/useCoursesHooks";
import { useGetGallery } from "@/hooks/useApi";

const HomeScreen = () => {
  const navigate = useNavigate();
  const { data: profile } = useGetProfile();
  const { data: coursesRes, isLoading: coursesLoading } = useGetCourses();
  const { data: learningRes, isLoading: learningLoading } = useGetMyLearning();
  const { data: gallery = [] } = useGetGallery();

  const courses = coursesRes?.data || [];
  const enrolled = learningRes?.data || [];
  const name = profile?.name || localStorage.getItem("eduUsername") || "Student";

  const totalCompleted = enrolled.reduce(
    (sum: number, e: any) => sum + (e.progress?.watchedLessons || 0),
    0
  );
  const totalLessons = enrolled.reduce(
    (sum: number, e: any) => sum + (e.progress?.totalLessons || 0),
    0
  );
  const avgProgress = enrolled.length
    ? Math.round(
        enrolled.reduce((s: number, e: any) => s + (e.progress?.percentComplete || 0), 0) /
          enrolled.length
      )
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent via-transparent to-transparent" />
        <div className="relative z-10 p-5 sm:p-7 lg:p-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-primary-foreground/65 mb-1.5">
              Your learning hub
            </p>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight truncate">
              Hi, {name.split(" ")[0]}
            </h1>
            <p className="mt-1.5 text-sm text-primary-foreground/80 max-w-md">
              {enrolled.length
                ? "Pick up where you left off and keep your momentum."
                : "Explore courses and start your preparation today."}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate(enrolled.length ? "/dashboard/learning" : "/dashboard/courses")
            }
            className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-accent text-accent-foreground shadow-lg hover:opacity-95 transition-opacity w-full sm:w-auto"
          >
            {enrolled.length ? "Continue learning" : "Browse courses"}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Stats — compact strip on mobile */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { label: "Courses", value: String(enrolled.length), icon: BookOpen },
          { label: "Watched", value: String(totalCompleted), icon: CheckCircle },
          { label: "Lessons", value: String(totalLessons), icon: Clock },
          { label: "Progress", value: `${avgProgress}%`, icon: Award },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex sm:block items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <s.icon size={16} />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-extrabold text-foreground leading-none">{s.value}</p>
              <p className="text-[11px] text-foreground/45 font-medium mt-1">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Continue learning */}
      {enrolled.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Continue learning</h2>
            <button
              type="button"
              onClick={() => navigate("/dashboard/learning")}
              className="text-xs sm:text-sm text-primary font-semibold"
            >
              View all
            </button>
          </div>

          {learningLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
              {enrolled.slice(0, 4).map((item: any) => {
                const pct = item.progress?.percentComplete || 0;
                return (
                  <button
                    key={item.enrollment?.purchaseId || item.course._id}
                    type="button"
                    onClick={() =>
                      navigate(`/course-player/${item.course._id}`, {
                        state: { course: item.course, from: "/dashboard" },
                      })
                    }
                    className="snap-start shrink-0 w-[min(85%,300px)] sm:w-auto text-left bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md hover:border-primary/20 transition-all"
                  >
                    <div className="relative aspect-[16/9] bg-secondary">
                      {item.course.thumbnail ? (
                        <img
                          src={item.course.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg">
                          <Play size={18} className="ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                      <span className="absolute bottom-2.5 right-2.5 text-[11px] font-bold text-white bg-foreground/50 backdrop-blur px-2 py-0.5 rounded-md">
                        {pct}%
                      </span>
                    </div>
                    <div className="p-3.5 sm:p-4">
                      <h3 className="font-bold text-foreground text-sm line-clamp-1">
                        {item.course.title}
                      </h3>
                      <div className="mt-2.5 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-foreground/45 mt-2">
                        {item.progress?.watchedLessons || 0}/{item.progress?.totalLessons || 0} lessons
                        {item.enrollment?.daysRemaining != null
                          ? ` · ${item.enrollment.daysRemaining}d left`
                          : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Recommended */}
      <section>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            {enrolled.length ? "More courses" : "Recommended for you"}
          </h2>
          <button
            type="button"
            onClick={() => navigate("/dashboard/courses")}
            className="text-xs sm:text-sm text-primary font-semibold"
          >
            Browse all
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {coursesLoading ? (
            <div className="col-span-full flex justify-center py-10">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : courses.length === 0 ? (
            <p className="col-span-full text-sm text-foreground/50 text-center py-8">
              No courses available yet.
            </p>
          ) : (
            courses.slice(0, 6).map((c: any) => (
              <CourseCard
                key={c._id}
                course={c}
                onClick={() => navigate(`/course-detail/${c._id}`, { state: { course: c } })}
              />
            ))
          )}
        </div>
      </section>

      {gallery.length > 0 && (
        <section>
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 sm:mb-4">
            Academy gallery
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {gallery.slice(0, 8).map((img: any) => (
              <div
                key={img._id}
                className="rounded-xl overflow-hidden border border-border aspect-square bg-secondary"
              >
                <img
                  src={img.imageUrl || img.thumbnail}
                  alt={img.title || ""}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomeScreen;
